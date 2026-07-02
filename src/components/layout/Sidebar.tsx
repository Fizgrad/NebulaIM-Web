import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, LogOut, MessageSquare, Settings, UserRound, UsersRound, Network, ShieldCheck } from "lucide-react";
import { Logo } from "../brand/Logo";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../utils/cn";

const navItems = [
  { label: "Chat", path: "/app/chat", icon: MessageSquare },
  { label: "Contacts", path: "/app/contacts", icon: UserRound },
  { label: "Groups", path: "/app/groups", icon: UsersRound },
  { label: "Dashboard", path: "/app/dashboard", icon: BarChart3 },
  { label: "Admin", path: "/admin", icon: ShieldCheck },
  { label: "Profile", path: "/app/profile", icon: Network },
  { label: "Settings", path: "/app/settings", icon: Settings }
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-[76px] shrink-0 flex-col border-r border-nebula-border bg-nebula-panel/[0.72] px-3 py-4 backdrop-blur-xl lg:w-64 lg:px-4">
      <Logo compact className="justify-center lg:hidden" />
      <Logo className="hidden lg:flex" />

      <div className="mt-7 flex items-center justify-center gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-2 lg:justify-start">
        <Avatar name={user?.nickname ?? "Operator"} color={user?.avatarColor} online />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-medium text-nebula-text">{user?.nickname ?? "Nebula Operator"}</p>
          <p className="truncate text-xs text-nebula-muted">Gateway connected</p>
        </div>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
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
              <span className="hidden lg:inline">{item.label}</span>
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
        <span className="hidden lg:inline">Logout</span>
      </Button>
    </aside>
  );
}
