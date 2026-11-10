import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getMyAccount, listServices, type Profile, type Service, type WorkerProfile } from "./api";

/** Things one screen picks and the next screen needs (which worker, job, booking...). */
export type Selection = {
  workerId?: string;
  jobId?: string;
  bookingId?: string;
  serviceId?: number | null;
  chatWith?: { id: string; name: string; avatar: string | null };
  requestWorker?: { id: string; name: string; serviceId: number } | null;
  voiceDraft?: { transcript: string; blob: Blob | null };
};

type SessionValue = {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  worker: WorkerProfile | null;
  services: Service[];
  /** True once profile/worker rows for the current user have been fetched. */
  accountReady: boolean;
  refreshAccount: () => Promise<void>;
  selection: Selection;
  select: (patch: Partial<Selection>) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  // Which user's profile/worker rows are currently loaded (undefined = nothing yet).
  // Comparing against the live userId avoids acting on the previous account's data
  // in the render right after a sign-in or sign-out.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;
  const accountReady = ready && loadedFor === userId;
  const latestUserId = useRef(userId);
  latestUserId.current = userId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    listServices().then(setServices).catch(() => setServices([]));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setWorker(null);
      return;
    }
    const account = await getMyAccount(userId);
    if (latestUserId.current !== userId) return; // user changed while loading
    setProfile(account.profile);
    setWorker(account.worker);
  }, [userId]);

  useEffect(() => {
    let current = true;
    refreshAccount()
      .catch(() => undefined)
      .finally(() => {
        if (current) setLoadedFor(userId);
      });
    return () => {
      current = false;
    };
  }, [refreshAccount, userId]);

  const select = useCallback(
    (patch: Partial<Selection>) => setSelection((prev) => ({ ...prev, ...patch })),
    [],
  );

  return (
    <SessionContext.Provider
      value={{
        ready,
        session,
        userId,
        profile,
        worker,
        services,
        accountReady,
        refreshAccount,
        selection,
        select,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
