import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-nebula-border bg-nebula-panel/82 shadow-panel backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
