import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/** Runs an async loader and re-runs it when deps change or reload() is called. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

type LiveTable = "jobs" | "job_offers" | "bookings" | "messages";

/** Calls onChange whenever a row the user can see changes in one of the tables. */
export function useLive(tables: LiveTable[], onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    const channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        callback.current(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key]);
}

// Minimal typing for the browser speech recognition API (Chrome / Edge / Android).
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createRecognizer(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Records audio with the microphone and (where supported) transcribes speech live. */
export function useRecorder(lang: "en" | "ur") {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const timer = useRef<number | null>(null);
  const finalText = useRef("");
  const listening = useRef(false);

  const cleanup = () => {
    listening.current = false;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    try {
      recognizer.current?.stop();
    } catch {
      /* already stopped */
    }
  };

  useEffect(() => cleanup, []);

  const start = async () => {
    setError(null);
    setBlob(null);
    setTranscript("");
    finalText.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => setBlob(new Blob(chunks, { type: mime }));
      rec.start();
      recorder.current = rec;

      const sr = createRecognizer();
      if (sr) {
        sr.lang = lang === "ur" ? "ur-PK" : "en-US";
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            if (r.isFinal) finalText.current += r[0].transcript + " ";
            else interim += r[0].transcript;
          }
          setTranscript((finalText.current + interim).trim());
        };
        sr.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            listening.current = false;
            setError("Speech-to-text was blocked. Your voice is still recorded; you can edit the text after.");
          } else if (event.error === "language-not-supported") {
            listening.current = false;
            setError("This browser can't recognise this language. Try switching to English, or Chrome.");
          } else if (event.error === "network") {
            setError("Speech-to-text needs internet. Your voice is still recorded.");
          }
        };
        // Chrome stops listening after a pause or ~60 s; keep going until the user taps stop.
        sr.onend = () => {
          if (!listening.current) return;
          try {
            sr.start();
          } catch {
            /* already restarting */
          }
        };
        try {
          listening.current = true;
          sr.start();
          recognizer.current = sr;
        } catch {
          listening.current = false;
          recognizer.current = null;
        }
      }

      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecording(true);
    } catch {
      setError("Microphone not available. Allow mic access in your browser, or use Text instead.");
    }
  };

  const stop = () => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    cleanup();
    setRecording(false);
  };

  const reset = () => {
    setBlob(null);
    setTranscript("");
    setSeconds(0);
  };

  return { recording, seconds, blob, transcript, setTranscript, error, start, stop, reset };
}

export const formatClock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Per-device list (e.g. jobs a worker hid). Survives refresh when storage is available. */
export function useLocalList(key: string) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const add = (id: string) =>
    setItems((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  return { items, add };
}

/**
 * Reads text aloud with the browser's speech synthesis (for users who don't
 * read comfortably). Uses an Urdu voice when the device has one.
 */
export function speak(text: string, lang: "ur" | "en" = "ur") {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text.trim()) return false;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const wanted = lang === "ur" ? ["ur-PK", "ur-IN", "ur", "hi-IN"] : ["en-PK", "en-IN", "en-GB", "en-US"];
    const voice = wanted
      .map((code) => voices.find((v) => v.lang.toLowerCase().startsWith(code.toLowerCase())))
      .find(Boolean);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === "ur" ? "ur-PK" : "en-US");
    utterance.rate = 0.95;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/** True when this browser can turn speech into text (Chrome, Edge, Android, Safari 14.5+). */
export function canRecognizeSpeech() {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
