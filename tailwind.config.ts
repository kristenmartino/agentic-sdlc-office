import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Agent palette
        cora: "#E6A23C",
        piper: "#FF6B6B",
        nova: "#3B5BDB",
        theo: "#495057",
        iris: "#9775FA",
        mira: "#37B24D",
        tess: "#0CA678",
        rune: "#5F3DC4",
        // Office shell
        "office-bg": "#0F1115",
        "office-panel": "#1A1D23",
        "office-line": "#2A2E36",
        "office-text": "#E6E8EC",
        "office-muted": "#8A8F9A",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        breathe: "breathe 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
