"use client";

import { useEffect, useState } from "react";
import { Bike, Loader2, MapPin, TrainFront } from "lucide-react";
import type { CommuteEstimate } from "@/lib/commute";
import { COMMUTE_HOME, formatCommuteMinutes } from "@/lib/commute";

export function CommuteInfo({ workAddress }: { workAddress?: string }) {
  const [estimate, setEstimate] = useState<CommuteEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const address = workAddress?.trim();
    if (!address || address.length < 4) {
      setEstimate(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/commute?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CommuteEstimate | null) => {
        if (!cancelled) setEstimate(data);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workAddress]);

  if (!workAddress?.trim()) return null;

  return (
    <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
      <div className="mb-2 flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
        <div>
          <p className="font-medium text-sky-900">工作地址</p>
          <p className="text-sky-800">{workAddress}</p>
        </div>
      </div>

      <p className="mb-2 text-xs text-sky-700/80">
        参照：{COMMUTE_HOME.label}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-sky-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          正在估算通勤...
        </div>
      ) : estimate ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-sm">
            <TrainFront className="h-4 w-4 text-indigo-600" />
            <div>
              <p className="text-xs text-slate-500">地铁</p>
              <p className="font-medium text-slate-900">{formatCommuteMinutes(estimate.subwayMinutes)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-sm">
            <Bike className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-slate-500">电动车</p>
              <p className="font-medium text-slate-900">{formatCommuteMinutes(estimate.eBikeMinutes)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {estimate && (
        <p className="mt-2 text-xs text-sky-600/80">
          直线距离约 {estimate.distanceKm} km · {estimate.note}
        </p>
      )}
    </div>
  );
}
