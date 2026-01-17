export type EventStatus = "not_started" | "in_progress" | "finished" | "revealed" | "expired";

export interface EventStatusInfo {
  status: EventStatus;
  label: string;
  color: string;
  bgColor: string;
}

export function getEventStatus(
  uploadStartTime: string | null,
  uploadEndTime: string | null,
  revealTime: string,
  expiryDate: string | null
): EventStatusInfo {
  const now = new Date();
  const reveal = new Date(revealTime);
  const uploadStart = uploadStartTime ? new Date(uploadStartTime) : null;
  const uploadEnd = uploadEndTime ? new Date(uploadEndTime) : null;
  const expiry = expiryDate ? new Date(expiryDate) : null;

  // Check if expired first
  if (expiry && now >= expiry) {
    return {
      status: "expired",
      label: "Caducado",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    };
  }

  // Check if revealed
  if (now >= reveal) {
    return {
      status: "revealed",
      label: "Revelado",
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    };
  }

  // Check if finished (upload period ended but not revealed yet)
  if (uploadEnd && now >= uploadEnd) {
    return {
      status: "finished",
      label: "Finalizado",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    };
  }

  // Check if in progress
  if (uploadStart && now >= uploadStart) {
    return {
      status: "in_progress",
      label: "En curso",
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    };
  }

  // Not started yet
  return {
    status: "not_started",
    label: "No empezado",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
}
