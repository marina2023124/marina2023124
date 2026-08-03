"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobInterestRatingProps {
  value?: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
}

export function JobInterestRating({
  value = 0,
  onChange,
  size = "md",
  readOnly = false,
}: JobInterestRatingProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1" title="个人意愿度">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={`意愿度 ${star} 星`}
            onClick={() => {
              if (readOnly || !onChange) return;
              onChange(star === value ? 0 : star);
            }}
            className={cn(
              "rounded p-0.5 transition-colors",
              readOnly ? "cursor-default" : "hover:scale-110",
              active ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
            )}
          >
            <Star className={cn(iconSize, active && "fill-current")} />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-1 text-xs text-slate-500">{value} 星</span>
      )}
    </div>
  );
}
