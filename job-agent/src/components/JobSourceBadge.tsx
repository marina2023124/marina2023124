"use client";

import type { JobSource } from "@/lib/job-source";
import { getJobSourceLabel, resolveJobSource } from "@/lib/job-source";
import { SOURCE_BADGE_COLORS } from "@/lib/job-source-styles";
import { Badge } from "./ui";

export function JobSourceBadge({
  source,
  url,
  fallbackText,
}: {
  source?: JobSource;
  url?: string;
  fallbackText?: string;
}) {
  const resolved = resolveJobSource({ source, url }, fallbackText);
  const label = getJobSourceLabel(resolved);

  return (
    <span title={url || label}>
      <Badge color={SOURCE_BADGE_COLORS[resolved]}>{label}</Badge>
    </span>
  );
}
