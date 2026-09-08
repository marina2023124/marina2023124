import type { JobStatus } from "./types";

export const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "saved", label: "已收藏" },
  { value: "applied", label: "已投递" },
  { value: "interview", label: "面试中" },
  { value: "declined", label: "已拒绝" },
  { value: "rejected", label: "已被拒" },
  { value: "offer", label: "已获 Offer" },
];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = Object.fromEntries(
  JOB_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<JobStatus, string>;

export const JOB_STATUS_COLOR: Record<
  JobStatus,
  "slate" | "indigo" | "amber" | "red" | "green" | "orange"
> = {
  saved: "slate",
  applied: "indigo",
  interview: "amber",
  declined: "orange",
  rejected: "red",
  offer: "green",
};

export function getJobStatusLabel(status: JobStatus | string | undefined): string {
  if (!status) return "已收藏";
  return JOB_STATUS_LABEL[status as JobStatus] ?? status;
}
