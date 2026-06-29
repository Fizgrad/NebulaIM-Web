import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary-gradient text-white shadow-glow hover:brightness-110 focus-visible:ring-cyan-300/60",
  secondary:
    "border-nebula-border bg-white/8 text-nebula-text hover:bg-white/12 focus-visible:ring-cyan-300/40",
  ghost:
    "border-transparent bg-transparent text-nebula-muted hover:bg-white/8 hover:text-nebula-text focus-visible:ring-cyan-300/30",
  danger:
    "border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/16 focus-visible:ring-red-300/40",
  outline:
    "border-nebula-border bg-transparent text-nebula-text hover:border-cyan-300/40 hover:bg-cyan-300/8 focus-visible:ring-cyan-300/40"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  icon: "h-10 w-10 p-0"
};

export function Button({ className, variant = "secondary", size = "md", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-medium outline-none transition",
        "focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
