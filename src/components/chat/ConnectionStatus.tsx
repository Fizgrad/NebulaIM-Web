import { Activity, Clock3, Radio, Server } from "lucide-react";
import type { GatewayStatus } from "../../services/gatewayClient";
import { cn } from "../../utils/cn";
import { formatShortTime } from "../../utils/time";

type ConnectionStatusProps = {
  status: GatewayStatus;
  compact?: boolean;
};

export function ConnectionStatus({ status, compact = false }: ConnectionStatusProps) {
  const connected = status.state === "connected";
  const warning = status.state === "reconnecting";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-xs",
        compact ? "text-nebula-muted" : "rounded-lg border border-nebula-border bg-white/[0.04] px-3 py-2"
      )}
      title={status.error}
    >
      <span className="inline-flex items-center gap-1.5">
        <Radio className={cn("h-3.5 w-3.5", connected ? "text-emerald-300" : warning ? "text-amber-300" : "text-red-300")} />
        <span>
          {status.mode === "real" ? (status.transport === "direct" ? "Direct Gateway" : "Real Bridge") : "Example Mode"}
        </span>
        <span>{connected ? "Connected" : status.state === "reconnecting" ? "Reconnecting" : "Disconnected"}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-cyan-200" />
        <span>{status.heartbeatOk ? "Heartbeat OK" : "Heartbeat waiting"}</span>
      </span>
      <span className="text-cyan-100">Latency {status.latency || 18}ms</span>
      {status.lastHeartbeatAt ? (
        <span className="inline-flex items-center gap-1.5 text-nebula-muted">
          <Clock3 className="h-3.5 w-3.5" />
          {formatShortTime(status.lastHeartbeatAt)}
        </span>
      ) : null}
      {status.bridgeUrl ? (
        <span className="hidden max-w-[220px] items-center gap-1.5 truncate text-nebula-muted xl:inline-flex">
          <Server className="h-3.5 w-3.5" />
          <span className="truncate">{status.bridgeUrl}</span>
        </span>
      ) : null}
    </div>
  );
}
