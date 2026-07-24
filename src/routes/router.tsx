import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

function lazyNamed<TModule, TName extends keyof TModule>(loader: () => Promise<TModule>, name: TName) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType<Record<string, unknown>> }));
}

const AppShell = lazyNamed(() => import("../components/layout/AppShell"), "AppShell");
const LandingPage = lazyNamed(() => import("../pages/LandingPage"), "LandingPage");
const LoginPage = lazyNamed(() => import("../pages/LoginPage"), "LoginPage");
const RegisterPage = lazyNamed(() => import("../pages/RegisterPage"), "RegisterPage");
const ChatPage = lazyNamed(() => import("../pages/ChatPage"), "ChatPage");
const ContactsPage = lazyNamed(() => import("../pages/ContactsPage"), "ContactsPage");
const GroupsPage = lazyNamed(() => import("../pages/GroupsPage"), "GroupsPage");
const ProfilePage = lazyNamed(() => import("../pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyNamed(() => import("../pages/SettingsPage"), "SettingsPage");
const DashboardPage = lazyNamed(() => import("../pages/DashboardPage"), "DashboardPage");
const AdminPage = lazyNamed(() => import("../pages/AdminPage"), "AdminPage");

function routeElement(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-nebula-bg" role="status" aria-label="Loading">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-nebula-border border-t-cyan-400" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

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
  { path: "/", element: routeElement(<LandingPage />) },
  { path: "/login", element: routeElement(<LoginPage />) },
  { path: "/register", element: routeElement(<RegisterPage />) },
  {
    path: "/app",
    element: routeElement(<AppShell />),
    children: [
      { index: true, element: <Navigate to="/app/chat" replace /> },
      { path: "chat", element: routeElement(<ChatPage />) },
      { path: "contacts", element: routeElement(<ContactsPage />) },
      { path: "groups", element: routeElement(<GroupsPage />) },
      { path: "dashboard", element: routeElement(<DashboardPage embedded />) },
      { path: "profile", element: routeElement(<ProfilePage />) },
      { path: "settings", element: routeElement(<SettingsPage />) }
    ]
  },
  { path: "/dashboard", element: routeElement(<DashboardPage />) },
  { path: "/admin", element: routeElement(<AdminPage />) },
  { path: "*", element: <Navigate to="/" replace /> }
], {
  basename: getRouterBasename()
});
