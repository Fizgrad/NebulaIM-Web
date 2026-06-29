import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { MetricsPoint } from "../../types/metrics";
import { Card } from "../common/Card";

type MetricsChartProps = {
  data: MetricsPoint[];
};

export function MetricsChart({ data }: MetricsChartProps) {
  return (
    <Card className="p-4">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-nebula-text">Runtime Metrics</h2>
        <p className="mt-1 text-sm text-nebula-muted">Message QPS, P99 latency and online users</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis dataKey="time" stroke="#64748B" tickLine={false} axisLine={false} />
            <YAxis stroke="#64748B" tickLine={false} axisLine={false} width={42} />
            <Tooltip
              contentStyle={{
                background: "#0F172A",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                borderRadius: 8,
                color: "#F8FAFC"
              }}
            />
            <Line type="monotone" dataKey="messageQps" stroke="#06B6D4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="latency" stroke="#A78BFA" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="onlineUsers" stroke="#34D399" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
