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

export { audioExtension, textDir, canRecognizeSpeech, formatClock, hasUrduVoice, speak, useRecorder } from "./voice";
