// Voice input (microphone recording + speech-to-text) and voice output (read aloud).
//
// Browser facts this code works around:
// - Speech recognition (Web Speech API) exists in Chrome, Edge, Android and
//   Safari 14.5+, but not Firefox. It needs HTTPS and an internet connection.
// - On Android, Chrome's speech recognition can't share the microphone with a
//   MediaRecorder stream: running both makes recognition silently fail. So on
//   Android we transcribe only and don't keep an audio file.
// - Chrome stops recognising after a pause (~5-10 s) or ~60 s even in
//   "continuous" mode, so we restart it until the user taps stop.
// - Android Chrome sometimes repeats earlier words in later results
//   ("my my name my name is"), so results are de-duplicated.
// - The last words arrive a moment AFTER stop() — we wait for them ("settling")
//   before anyone reads the transcript.
import { useEffect, useRef, useState } from "react";

type SpeechAlternative = { transcript: string };
type SpeechResult = { 0: SpeechAlternative; isFinal: boolean; length: number };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognizerClass() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when this browser can turn speech into text (Chrome, Edge, Android, Safari 14.5+). */
export function canRecognizeSpeech() {
  return !!recognizerClass();
}

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** Joins speech pieces, dropping a piece that just repeats (or extends) the previous one. */
function joinPieces(pieces: string[]) {
  const out: string[] = [];
  for (const raw of pieces) {
    const piece = raw.trim();
    if (!piece) continue;
    const last = out[out.length - 1];
    if (last && piece.toLowerCase().startsWith(last.toLowerCase())) out[out.length - 1] = piece;
    else if (last && last.toLowerCase().startsWith(piece.toLowerCase())) continue;
    else out.push(piece);
  }
  return out.join(" ");
}

function micErrorMessage(error: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The microphone only works on a secure (https) link.";
  }
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was denied. Tap the lock icon next to the address, allow the microphone, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The microphone is busy in another app. Close it and try again.";
  }
  return "Couldn't start the microphone. You can type instead.";
}

export type RecorderOptions = {
  /** Keep an audio file of the recording (for voice notes). Default true. */
  audio?: boolean;
  /** Stop automatically after this many seconds. Default 120. */
  maxSeconds?: number;
};

/**
 * Records the microphone and transcribes speech live.
 *
 * `transcript` is final once `recording` and `settling` are both false.
 * `hasResult` is true when there is something to use (audio and/or text).
 */
export function useRecorder(lang: "en" | "ur", options: RecorderOptions = {}) {
  const { audio = true, maxSeconds = 120 } = options;
  const canTranscribe = canRecognizeSpeech();
  // On Android, recording audio would stop speech recognition from working.
  const keepAudio = audio && !(canTranscribe && isAndroid());

  const [recording, setRecording] = useState(false);
  const [settling, setSettling] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0..1 microphone loudness (when we have the audio stream)
  const [hearing, setHearing] = useState(false); // speech detected (from the recogniser)

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const listening = useRef(false); // user wants recognition running
  const busy = useRef(false); // start() in progress or recording
  const donePieces = useRef<string[]>([]); // text from earlier recognition sessions (before restarts)
  const sessionPieces = useRef<string[]>([]); // text from the current recognition session
  const stopRef = useRef<() => void>(() => undefined);

  const publish = () => setTranscript(joinPieces([...donePieces.current, ...sessionPieces.current]));

  const releaseAudio = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLevel(0);
  };

  const finishSettling = () => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setSettling(false);
    setHearing(false);
  };

  // Stop everything if the screen closes mid-recording.
  useEffect(
    () => () => {
      listening.current = false;
      busy.current = false;
      if (timer.current) window.clearInterval(timer.current);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      try {
        recognizer.current?.abort();
      } catch {
        /* not running */
      }
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      releaseAudio();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startRecognition = () => {
    const Ctor = recognizerClass();
    if (!Ctor) return;
    const sr = new Ctor();
    sr.lang = lang === "ur" ? "ur-PK" : "en-US";
    sr.continuous = true;
    sr.interimResults = true;
    sr.maxAlternatives = 1;
    sessionPieces.current = [];
    sr.onresult = (event) => {
      // Rebuild this session's text from all results (robust to Android quirks).
      const pieces: string[] = [];
      for (let i = 0; i < event.results.length; i++) pieces.push(event.results[i][0].transcript);
      sessionPieces.current = pieces;
      publish();
    };
    sr.onspeechstart = () => setHearing(true);
    sr.onspeechend = () => setHearing(false);
    sr.onerror = (event) => {
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        listening.current = false;
        setError(
          keepAudio
            ? "Speech-to-text was blocked, but your voice is still being recorded. You can type the text after."
            : "Microphone permission was denied. Tap the lock icon next to the address, allow the microphone, then try again.",
        );
      } else if (code === "language-not-supported") {
        listening.current = false;
        setError("This browser can't recognise this language. Switch language, or use Chrome.");
      } else if (code === "audio-capture") {
        listening.current = false;
        setError("The microphone is busy or missing. Close other apps using it and try again.");
      } else if (code === "network") {
        listening.current = false;
        setError("Speech-to-text needs internet. Check your connection, or type instead.");
      }
      // "no-speech" and "aborted" are normal: onend restarts if the user is still recording.
    };
    sr.onend = () => {
      // Keep this session's words before a restart replaces them.
      donePieces.current = [...donePieces.current, ...sessionPieces.current];
      sessionPieces.current = [];
      publish();
      if (listening.current) {
        try {
          startRecognition();
          return;
        } catch {
          /* fall through: stop listening */
        }
      }
      recognizer.current = null;
      finishSettling();
    };
    recognizer.current = sr;
    sr.start();
  };

  const start = async () => {
    if (busy.current) return; // double tap
    busy.current = true;
    setError(null);
    setBlob(null);
    setTranscript("");
    setSeconds(0);
    donePieces.current = [];
    sessionPieces.current = [];
    finishSettling();

    if (!canTranscribe && !audio) {
      busy.current = false;
      setError("This browser can't turn speech into text. Please type, or open the app in Chrome.");
      return;
    }

    if (keepAudio) {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        busy.current = false;
        setError(
          window.isSecureContext
            ? "This browser can't record audio. Please type, or open the app in Chrome."
            : "The microphone only works on a secure (https) link.",
        );
        return;
      }
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.current = mic;
        const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
        const rec = mime ? new MediaRecorder(mic, { mimeType: mime }) : new MediaRecorder(mic);
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
          if (chunks.length) setBlob(new Blob(chunks, { type }));
        };
        rec.start(1000);
        recorder.current = rec;

        // Real loudness meter so people can see the phone is hearing them.
        try {
          const Ctx =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(mic).connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            const tick = () => {
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (const v of data) sum += ((v - 128) / 128) ** 2;
              setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
              frame.current = requestAnimationFrame(tick);
            };
            audioCtx.current = ctx;
            tick();
          }
        } catch {
          /* meter is optional */
        }
      } catch (e) {
        busy.current = false;
        releaseAudio();
        setError(micErrorMessage(e));
        return;
      }
    }

    if (canTranscribe) {
      listening.current = true;
      try {
        startRecognition();
      } catch {
        listening.current = false;
        recognizer.current = null;
        if (!keepAudio) {
          busy.current = false;
          setError("Couldn't start speech-to-text. Please try again, or type instead.");
          return;
        }
      }
    }

    timer.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxSeconds) stopRef.current();
        return s + 1;
      });
    }, 1000);
    setRecording(true);
  };

  const stop = () => {
    if (!busy.current) return;
    busy.current = false;
    listening.current = false;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    releaseAudio();
    setRecording(false);
    if (recognizer.current) {
      // Wait for the last words (onend), but never longer than 2.5 s.
      setSettling(true);
      settleTimer.current = window.setTimeout(() => {
        try {
          recognizer.current?.abort();
        } catch {
          /* already stopped */
        }
        recognizer.current = null;
        finishSettling();
      }, 2500);
      try {
        recognizer.current.stop();
      } catch {
        finishSettling();
      }
    }
  };
  stopRef.current = stop;

  const reset = () => {
    if (busy.current) stop();
    try {
      recognizer.current?.abort();
    } catch {
      /* not running */
    }
    recognizer.current = null;
    finishSettling();
    donePieces.current = [];
    sessionPieces.current = [];
    setBlob(null);
    setTranscript("");
    setSeconds(0);
    setError(null);
  };

  return {
    recording,
    settling,
    seconds,
    maxSeconds,
    blob,
    transcript,
    setTranscript,
    error,
    level,
    hearing,
    canTranscribe,
    keepsAudio: keepAudio,
    hasResult: !!blob || !!transcript.trim(),
    start,
    stop,
    reset,
  };
}

export const formatClock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------- read aloud

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
/** Chrome loads voices asynchronously: the first getVoices() call is often empty. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", done, { once: true });
    window.setTimeout(done, 1200);
  });
  return voicesReady;
}

/** True if the device has an Urdu voice for reading aloud. */
export async function hasUrduVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const voices = await loadVoices();
  return voices.some((v) => v.lang.toLowerCase().startsWith("ur"));
}

/**
 * Reads text aloud (for users who don't read comfortably). Uses an Urdu voice
 * when the device has one; otherwise lets the browser pick a voice for ur-PK.
 * Never uses a Hindi voice for Urdu: it can't read Urdu script.
 */
export function speak(text: string, lang: "ur" | "en" = "ur") {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  void loadVoices().then((voices) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const wanted = lang === "ur" ? ["ur-pk", "ur-in", "ur"] : ["en-pk", "en-in", "en-gb", "en-us", "en"];
    const voice = wanted
      .map((code) => voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(code)))
      .find(Boolean);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === "ur" ? "ur-PK" : "en-US");
    utterance.rate = 0.95;
    synth.speak(utterance);
  });
  return true;
}

/** File extension for a recorded audio blob (matches the storage bucket's allowed types). */
export function audioExtension(blob: Blob) {
  if (blob.type.includes("mp4") || blob.type.includes("aac")) return "m4a";
  if (blob.type.includes("ogg")) return "ogg";
  return "webm";
}

/** Right-to-left only when the text is actually in Urdu script (not Roman Urdu). */
export const textDir = (text: string) => (/[؀-ۿ]/.test(text) ? "rtl" : "ltr");
