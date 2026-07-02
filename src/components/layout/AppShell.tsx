import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { NebulaBackground } from "../brand/NebulaBackground";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../utils/cn";

export function AppShell() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const isChatRoute = location.pathname === "/app/chat";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-nebula-bg text-nebula-text">
      <NebulaBackground />
      <Sidebar />
      <main
        className={cn(
          "min-w-0 flex-1 overflow-x-hidden md:h-screen md:overflow-hidden",
          isChatRoute ? "chat-shell-main" : "app-shell-main"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
