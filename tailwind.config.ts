import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f8f6",
        ink: "#212934",
        muted: "#6b7076",
        line: "#e3e4e1",
        surface: "#ffffff",
        brand: { DEFAULT: "#65bc7b", dark: "#4a9a5e", light: "#eaf6ee" },
        danger: { DEFAULT: "#e2574c", light: "#fdecea" },
        warn: { DEFAULT: "#e9a13b", dark: "#b45309", light: "#fdf3e3" },
        sky: { DEFAULT: "#569ff7", light: "#e8f2fe" },
        plum: { DEFAULT: "#c594c5", light: "#f7ecf7" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "Helvetica", "sans-serif"],
        heading: ["var(--font-outfit)", "var(--font-inter)", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,41,52,0.05), 0 4px 16px rgba(33,41,52,0.07)",
        pop: "0 8px 30px rgba(33,41,52,0.16)",
      },
      keyframes: {
        flash: {
          "0%, 100%": { backgroundColor: "#fdecea" },
          "50%": { backgroundColor: "#f5c1bb" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        flash: "flash 1s ease-in-out infinite",
        blink: "blink 1.1s ease-in-out infinite",
        fadeUp: "fadeUp 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
