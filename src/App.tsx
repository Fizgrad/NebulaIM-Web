import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { useSettingsStore } from "./store/settingsStore";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const theme = useSettingsStore((state) => state.theme);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const ensureFreshToken = useAuthStore((state) => state.ensureFreshToken);

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const useLight = theme === "light" || (theme === "system" && prefersLight);
    document.documentElement.classList.toggle("light", useLight);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void ensureFreshToken();
    const timer = window.setInterval(() => {
      void ensureFreshToken();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [ensureFreshToken, isAuthenticated]);

  return <RouterProvider router={router} />;
}
