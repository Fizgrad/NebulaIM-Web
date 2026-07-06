import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, MessageSquare, Settings, UserRound, UsersRound, Network } from "lucide-react";
import { Logo } from "../brand/Logo";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { cn } from "../../utils/cn";
import { useI18n, type TranslationKey } from "../../i18n";

const navItems = [
  { labelKey: "nav.chat", path: "/app/chat", icon: MessageSquare },
  { labelKey: "nav.contacts", path: "/app/contacts", icon: UserRound },
  { labelKey: "nav.groups", path: "/app/groups", icon: UsersRound },
  { labelKey: "nav.profile", path: "/app/profile", icon: Network },
  { labelKey: "nav.settings", path: "/app/settings", icon: Settings }
] satisfies Array<{ labelKey: TranslationKey; path: string; icon: typeof MessageSquare }>;

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const gatewayConnected = useChatStore((state) => state.gatewayStatus.state === "connected");
  const { t } = useI18n();

  return (
    <>
      <aside className="hidden h-screen w-[76px] shrink-0 flex-col border-r border-nebula-border bg-nebula-panel/[0.72] px-3 py-4 backdrop-blur-xl md:flex lg:w-64 lg:px-4">
        <Logo compact className="justify-center lg:hidden" />
        <Logo className="hidden lg:flex" />

        <div className="mt-7 flex items-center justify-center gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-2 lg:justify-start">
          <Avatar name={user?.nickname ?? t("sidebar.operator")} color={user?.avatarColor} online={gatewayConnected} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium text-nebula-text">{user?.nickname ?? t("sidebar.nebulaOperator")}</p>
            <p className="truncate text-xs text-nebula-muted">{gatewayConnected ? t("sidebar.gatewayConnected") : t("sidebar.gatewayDisconnected")}</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label={t("sidebar.primaryNavigation")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-sm font-medium transition lg:justify-start",
                    isActive ? "bg-cyan-300/10 text-cyan-100" : "text-nebula-muted hover:bg-white/[0.06] hover:text-nebula-text"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          className="justify-center lg:justify-start"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">{t("common.logout")}</span>
        </Button>
      </aside>

      <nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-nebula-border bg-nebula-panel/95 px-2 pt-2 shadow-panel backdrop-blur-xl md:hidden"
        aria-label={t("sidebar.mobileNavigation")}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium leading-none transition-colors",
                  isActive ? "text-cyan-200" : "text-nebula-muted hover:text-nebula-text"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="max-w-full truncate">{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
