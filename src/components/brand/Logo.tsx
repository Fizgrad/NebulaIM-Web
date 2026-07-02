import { cn } from "../../utils/cn";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-primary-gradient shadow-glow">
        <span className="absolute h-16 w-16 rotate-12 border border-white/[0.18]" />
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-100" />
        <span className="absolute bottom-2 right-2 h-1 w-1 rounded-full bg-white/70" />
        <span className="relative text-lg font-black text-white">N</span>
      </div>
      {!compact ? (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-normal text-nebula-text">NebulaIM</div>
          <div className="text-xs text-nebula-muted">Distributed Messaging</div>
        </div>
      ) : null}
    </div>
  );
}
