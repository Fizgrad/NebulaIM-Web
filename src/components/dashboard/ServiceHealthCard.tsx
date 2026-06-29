import type { ServiceHealth } from "../../types/metrics";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";

type ServiceHealthCardProps = {
  service: ServiceHealth;
};

export function ServiceHealthCard({ service }: ServiceHealthCardProps) {
  const tone = service.status === "healthy" ? "emerald" : service.status === "degraded" ? "amber" : "red";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-nebula-text">{service.name}</h3>
          <p className="mt-2 text-xs text-nebula-muted">{service.detail}</p>
        </div>
        <Badge tone={tone}>{service.status}</Badge>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-primary-gradient"
          style={{ width: `${Math.max(18, 100 - service.latency)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{service.latency}ms service latency</p>
    </Card>
  );
}
