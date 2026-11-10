import type { ScreenId } from "../ui";
import { voiceNoteUrl, type BookingStatus, type WorkerListItem } from "../lib/api";
import { useQuery } from "../lib/hooks";
import { WorkerCard } from "../ui";

export type ScreenProps = {
  go: (id: ScreenId) => void;
  back: () => void;
  flash: (message: string) => void;
  urdu: boolean;
  openRoleSelection: () => void;
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  on_the_way: "On the way",
  working: "Working",
  done: "Completed",
  cancelled: "Cancelled",
};

export const ACTIVE_STATUSES: BookingStatus[] = ["confirmed", "on_the_way", "working"];

export const STEPS: { status: BookingStatus; label: string }[] = [
  { status: "confirmed", label: "Confirmed" },
  { status: "on_the_way", label: "On the way" },
  { status: "working", label: "Working" },
  { status: "done", label: "Done" },
];

export function StatusStepper({ status }: { status: BookingStatus }) {
  const reached = STEPS.findIndex((s) => s.status === status) + 1;
  return (
    <div className="status-stepper">
      {STEPS.map((step, index) => (
        <div className={index < reached ? "complete" : ""} key={step.status}>
          <i>{index < reached ? "✓" : index + 1}</i>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export function VoiceNote({ path }: { path: string }) {
  const url = useQuery(() => voiceNoteUrl(path), [path]);
  if (!url.data) return null;
  return <audio className="voice-audio" controls src={url.data} preload="none" />;
}

export function WorkerItem({ worker, onOpen }: { worker: WorkerListItem; onOpen: () => void }) {
  return (
    <WorkerCard
      name={worker.profile?.full_name || "Worker"}
      avatar={worker.profile?.avatar_url}
      service={worker.service?.name}
      rating={Number(worker.rating_avg)}
      ratingCount={worker.rating_count}
      price={worker.fixed_rate_from ?? worker.hourly_rate}
      available={worker.is_available}
      onClick={onOpen}
    />
  );
}

export function readError(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
