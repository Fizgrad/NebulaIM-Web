import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  error?: string;
  icon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className, ...props }, ref) => {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-nebula-text">{label}</span> : null}
      <span className="relative block">
        {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span> : null}
        <input
          ref={ref}
          className={cn(
            "h-11 w-full rounded-lg border border-nebula-border bg-white/[0.06] px-3 text-sm text-nebula-text outline-none",
            "placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15",
            icon && "pl-10",
            error && "border-red-400/50 focus:border-red-300/60 focus:ring-red-300/15",
            className
          )}
          {...props}
        />
      </span>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
});

Input.displayName = "Input";
