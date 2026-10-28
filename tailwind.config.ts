import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        flash: {
          "0%, 100%": { backgroundColor: "#fee2e2" },
          "50%": { backgroundColor: "#fca5a5" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        flash: "flash 1s ease-in-out infinite",
        blink: "blink 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
