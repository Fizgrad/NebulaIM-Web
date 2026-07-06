import type { DashboardEvent } from "../../types/metrics";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { formatRelativeTime } from "../../utils/time";
import { useI18n } from "../../i18n";

type EventTimelineProps = {
  events: DashboardEvent[];
};

const toneByType = {
  "admin audit": "cyan",
  "admin health": "cyan",
  "system stats": "emerald",
  "outbox status": "violet",
  "kafka lag": "amber",
  "bridge health": "slate"
} as const;

export function EventTimeline({ events }: EventTimelineProps) {
  const { t, language } = useI18n();

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-nebula-text">{t("events.adminAudit")}</h2>
      <div className="mt-4 space-y-4">
        {events.length > 0 ? events.map((event) => (
          <div key={event.id} className="relative border-l border-nebula-border pl-4">
            <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneByType[event.type]}>{event.type}</Badge>
              <span className="text-xs text-nebula-muted">{event.service}</span>
            </div>
            <p className="mt-2 text-sm text-slate-200">{event.message}</p>
            <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(event.createdAt, language)}</p>
          </div>
        )) : (
          <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-sm text-nebula-muted">
            {t("events.empty")}
          </div>
        )}
      </div>
    </Card>
  );
}
