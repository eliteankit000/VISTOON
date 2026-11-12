import type { Config } from "tailwindcss";

// VISTOON light-only design tokens (plan section 4). No dark mode by design.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "#FAF9F6",
        sidebar: "#F5F4F0",
        surface: "#FFFFFF",
        ink: "#262624",
        muted: "#77756F",
        line: "#E8E6E1",
        accent: { DEFAULT: "#D97757", dark: "#C4663F", soft: "#FBEEE8" },
        hover: "#F0EFEB",
        success: { DEFAULT: "#39845A", soft: "#E8F3EC" },
        danger: { DEFAULT: "#C45454", soft: "#F9EAEA" },
        warn: { DEFAULT: "#9A6B1F", soft: "#FAF1DE" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "8px", lg: "12px" },
      boxShadow: { soft: "0 1px 2px rgba(38,38,36,0.04)" },
    },
  },
  plugins: [],
};
export default config;
