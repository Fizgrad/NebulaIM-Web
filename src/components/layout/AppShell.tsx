import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { NebulaBackground } from "../brand/NebulaBackground";
import { useAuthStore } from "../../store/authStore";

export function AppShell() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-nebula-bg text-nebula-text">
      <NebulaBackground />
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
