import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nebula: {
          bg: "rgb(var(--nebula-bg) / <alpha-value>)",
          panel: "rgb(var(--nebula-panel) / <alpha-value>)",
          panelLight: "rgb(var(--nebula-panel-light) / <alpha-value>)",
          primary: "rgb(var(--nebula-primary) / <alpha-value>)",
          secondary: "rgb(var(--nebula-secondary) / <alpha-value>)",
          accent: "rgb(var(--nebula-accent) / <alpha-value>)",
          text: "rgb(var(--nebula-text) / <alpha-value>)",
          muted: "rgb(var(--nebula-muted) / <alpha-value>)",
          border: "rgb(var(--nebula-border) / var(--nebula-border-alpha))"
        }
      },
      boxShadow: {
        glow: "var(--nebula-shadow-glow)",
        panel: "var(--nebula-shadow-panel)"
      },
      backgroundImage: {
        "nebula-grid":
          "linear-gradient(rgb(var(--nebula-grid) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--nebula-grid) / 0.08) 1px, transparent 1px)",
        "primary-gradient":
          "linear-gradient(135deg, rgb(var(--nebula-primary)) 0%, rgb(var(--nebula-accent)) 54%, rgb(var(--nebula-secondary)) 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;
