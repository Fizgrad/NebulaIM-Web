import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

type PageContainerProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageContainer({ title, subtitle, actions, children }: PageContainerProps) {
  return (
    <div className="min-h-screen bg-nebula-bg text-nebula-text">
      <TopBar title={title} subtitle={subtitle} actions={actions} />
      <main className="mx-auto w-full max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
