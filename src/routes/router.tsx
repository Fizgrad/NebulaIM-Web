import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ChatPage } from "../pages/ChatPage";
import { ContactsPage } from "../pages/ContactsPage";
import { GroupsPage } from "../pages/GroupsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SettingsPage } from "../pages/SettingsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AdminPage } from "../pages/AdminPage";

function getRouterBasename() {
  const baseUrl = import.meta.env.BASE_URL;
  if (!baseUrl || baseUrl === "/") return undefined;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function restoreGitHubPagesRedirect() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return;

  const basePath = getRouterBasename() ?? "";
  window.history.replaceState(null, "", `${basePath}${redirect}`);
}

restoreGitHubPagesRedirect();

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/chat" replace /> },
      { path: "chat", element: <ChatPage /> },
      { path: "contacts", element: <ContactsPage /> },
      { path: "groups", element: <GroupsPage /> },
      { path: "dashboard", element: <DashboardPage embedded /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  },
  { path: "/dashboard", element: <DashboardPage /> },
  { path: "/admin", element: <AdminPage /> },
  { path: "*", element: <Navigate to="/" replace /> }
], {
  basename: getRouterBasename()
});
