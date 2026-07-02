import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "violet" | "cyan" | "emerald" | "amber" | "slate" | "red";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
};

const tones: Record<BadgeTone, string> = {
  violet: "border-violet-300/25 bg-violet-400/10 text-violet-100",
  cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  slate: "border-slate-300/[0.16] bg-slate-400/[0.08] text-slate-200",
  red: "border-red-300/25 bg-red-400/10 text-red-100"
};

export function Badge({ tone = "slate", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)}
      {...props}
    >
      {children}
    </span>
  );
}
