import { Badge } from "../components/common/Badge";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { PageContainer } from "../components/layout/PageContainer";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { formatMessageTime } from "../utils/time";
import { maskToken } from "../utils/format";
import { useI18n } from "../i18n";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const gatewayConnected = useChatStore((state) => state.gatewayStatus.state === "connected");
  const { t, locale } = useI18n();

  return (
    <PageContainer title={t("profile.title")} subtitle={t("profile.subtitle")}>
      <Card className="max-w-3xl p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <Avatar name={user?.nickname ?? t("sidebar.nebulaOperator")} color={user?.avatarColor} size="xl" online={gatewayConnected} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-nebula-text">{user?.nickname ?? t("sidebar.nebulaOperator")}</h2>
              <Badge tone={gatewayConnected ? "emerald" : "slate"}>{gatewayConnected ? t("common.online") : t("common.offline")}</Badge>
            </div>
            <p className="mt-2 text-sm text-nebula-muted">@{user?.username ?? "demo"}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {[
            [t("profile.userId"), user?.id ?? "u-current"],
            [t("profile.username"), user?.username ?? "demo"],
            [t("profile.nickname"), user?.nickname ?? t("sidebar.nebulaOperator")],
            [t("profile.registered"), formatMessageTime(user?.registeredAt ?? Date.now(), locale)],
            [t("profile.gateway"), user?.gateway ?? "gateway-shanghai-01:9000"],
            [t("profile.connectionId"), user?.connectionId ?? "conn_7f3a9c2e"],
            [t("profile.token"), maskToken(token)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-nebula-muted">{label}</p>
              <p className="mt-2 break-words text-sm font-medium text-nebula-text">{value}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
