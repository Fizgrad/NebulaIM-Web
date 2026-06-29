import { cn } from "../../utils/cn";

type AvatarProps = {
  name: string;
  src?: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl"
};

export function Avatar({ name, src, color = "from-violet-500 to-cyan-400", size = "md", online, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img src={src} alt={name} className={cn("rounded-lg object-cover", sizes[size])} />
      ) : (
        <span className={cn("inline-flex items-center justify-center rounded-lg bg-gradient-to-br font-semibold text-white", color, sizes[size])}>
          {initials}
        </span>
      )}
      {online !== undefined ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-nebula-panel",
            online ? "bg-emerald-400" : "bg-slate-500"
          )}
        />
      ) : null}
    </span>
  );
}
