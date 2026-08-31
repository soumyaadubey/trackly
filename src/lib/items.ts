export const KINDS = ["opportunity", "course", "roadmap"] as const;
export type Kind = (typeof KINDS)[number];

type KindConfig = {
  label: string;
  pluralLabel: string;
  statuses: string[];
  activeStatuses: string[];
  archiveStatuses: string[];
  statusLabels: Record<string, string>;
  statusBadge: Record<string, string>;
};

export const KIND_CONFIG: Record<Kind, KindConfig> = {
  opportunity: {
    label: "Opportunity",
    pluralLabel: "Opportunities",
    statuses: ["saved", "applying", "applied", "interview", "accepted", "rejected", "ghosted"],
    activeStatuses: ["saved", "applying", "applied", "interview"],
    archiveStatuses: ["accepted", "rejected", "ghosted"],
    statusLabels: {
      saved: "Saved",
      applying: "Applying",
      applied: "Applied",
      interview: "Interview",
      accepted: "Accepted",
      rejected: "Rejected",
      ghosted: "Ghosted",
    },
    statusBadge: {
      saved: "badge-neutral",
      applying: "badge-applying",
      applied: "badge-applied",
      interview: "badge-interview",
      accepted: "badge-applied",
      rejected: "badge-danger",
      ghosted: "badge-neutral",
    },
  },
  course: {
    label: "Course",
    pluralLabel: "Courses",
    statuses: ["saved", "in_progress", "completed", "abandoned"],
    activeStatuses: ["saved", "in_progress"],
    archiveStatuses: ["completed", "abandoned"],
    statusLabels: {
      saved: "Saved",
      in_progress: "In progress",
      completed: "Completed",
      abandoned: "Abandoned",
    },
    statusBadge: {
      saved: "badge-neutral",
      in_progress: "badge-applying",
      completed: "badge-applied",
      abandoned: "badge-danger",
    },
  },
  roadmap: {
    label: "Roadmap",
    pluralLabel: "Roadmaps",
    statuses: ["saved", "in_progress", "completed"],
    activeStatuses: ["saved", "in_progress"],
    archiveStatuses: ["completed"],
    statusLabels: {
      saved: "Saved",
      in_progress: "In progress",
      completed: "Completed",
    },
    statusBadge: {
      saved: "badge-neutral",
      in_progress: "badge-applying",
      completed: "badge-applied",
    },
  },
};

export const KIND_ROUTE: Record<Kind, string> = {
  opportunity: "/opportunities",
  course: "/courses",
  roadmap: "/roadmaps",
};

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export type Item = {
  id: string;
  user_id: string;
  kind: Kind;
  title: string;
  url: string;
  status: string;
  tags: string[];
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function isStatusForKind(kind: Kind, value: string): boolean {
  return KIND_CONFIG[kind].statuses.includes(value);
}

export type Urgency = "overdue" | "soon" | "normal" | "none";

export function deadlineUrgency(deadline: string | null): Urgency {
  if (!deadline) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "normal";
}

export function formatDeadline(deadline: string, urgency: Urgency): string {
  const due = new Date(deadline + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const dateLabel = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (urgency === "overdue") {
    const daysAgo = Math.abs(diffDays);
    return `${daysAgo} day${daysAgo === 1 ? "" : "s"} overdue`;
  }
  if (urgency === "soon") {
    if (diffDays === 0) return "Due today";
    return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }
  return dateLabel;
}
