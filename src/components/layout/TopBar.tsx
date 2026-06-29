import type { ReactNode } from "react";

type TopBarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-nebula-border px-5 py-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-nebula-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-nebula-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
