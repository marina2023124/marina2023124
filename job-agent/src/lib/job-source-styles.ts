import type { JobSource } from "./job-source";

export const SOURCE_BADGE_COLORS: Record<
  JobSource,
  "slate" | "indigo" | "amber" | "green" | "red"
> = {
  boss: "indigo",
  xiaohongshu: "red",
  lagou: "green",
  liepin: "amber",
  maimai: "slate",
  company_site: "green",
  manual: "slate",
  other: "slate",
};
