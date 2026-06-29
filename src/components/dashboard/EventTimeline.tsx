import type { DashboardEvent } from "../../types/metrics";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { formatRelativeTime } from "../../utils/time";

type EventTimelineProps = {
  events: DashboardEvent[];
};

const toneByType = {
  "user login": "cyan",
  "message sent": "emerald",
  "push delivered": "violet",
  "kafka retry": "amber",
  "offline saved": "slate"
} as const;

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-nebula-text">Recent Events</h2>
      <div className="mt-4 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="relative border-l border-nebula-border pl-4">
            <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneByType[event.type]}>{event.type}</Badge>
              <span className="text-xs text-nebula-muted">{event.service}</span>
            </div>
            <p className="mt-2 text-sm text-slate-200">{event.message}</p>
            <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(event.createdAt)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
