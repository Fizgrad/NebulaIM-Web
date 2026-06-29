import { cn } from "../../utils/cn";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {compact ? (
        <div className="h-11 w-11 overflow-hidden rounded-lg bg-white shadow-glow">
          <img
            src="/logo.png"
            alt="NebulaIM"
            className="h-11 max-w-none select-none object-left"
            draggable={false}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="NebulaIM"
            className="h-11 w-auto select-none rounded-lg bg-white px-2 py-1 shadow-panel"
            draggable={false}
          />
          <div className="hidden leading-tight xl:block">
            <div className="text-xs text-nebula-muted">Distributed Messaging</div>
          </div>
        </div>
      )}
    </div>
  );
}
