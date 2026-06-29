import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nebula: {
          bg: "#070A13",
          panel: "#0F172A",
          panelLight: "#111827",
          primary: "#7C3AED",
          secondary: "#06B6D4",
          accent: "#3B82F6",
          text: "#F8FAFC",
          muted: "#94A3B8",
          border: "rgba(148, 163, 184, 0.18)"
        }
      },
      boxShadow: {
        glow: "0 18px 80px rgba(6, 182, 212, 0.13)",
        panel: "0 16px 48px rgba(0, 0, 0, 0.28)"
      },
      backgroundImage: {
        "nebula-grid":
          "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
        "primary-gradient": "linear-gradient(135deg, #7C3AED 0%, #3B82F6 54%, #06B6D4 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;
