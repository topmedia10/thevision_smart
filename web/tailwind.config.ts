import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef0ff",
          100: "#e0e1ff",
          300: "#b3b1fb",
          400: "#928ff8",
          500: "#6d6af8",
          600: "#5b54ef",
          700: "#4a43cf",
        },
        bg: "#0a0d14",
        surface: "#131824",
        surface2: "#1a2130",
        surface3: "#222a3b",
        line: "#26304400",
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 8px 24px -6px rgba(109,106,248,0.45)",
        soft: "0 1px 3px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
} satisfies Config;
