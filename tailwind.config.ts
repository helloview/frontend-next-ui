import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rose: {
          50: "var(--rose-50)",
          100: "var(--rose-100)",
          200: "var(--rose-200)",
          300: "var(--rose-300)",
          400: "var(--rose-400)",
          500: "var(--rose-500)",
          600: "var(--rose-600)",
          700: "var(--rose-700)",
          900: "var(--rose-900)",
        },
        pink: {
          400: "var(--pink-400)",
          500: "var(--pink-500)",
        },
        white: "var(--bg-white)",
        zinc: {
          50: "var(--bg-zinc-50)",
          100: "var(--bg-zinc-50)",
          200: "var(--border-zinc-200)",
          300: "var(--text-zinc-400)",
          400: "var(--text-zinc-400)",
          500: "var(--text-zinc-500)",
          600: "var(--text-zinc-600)",
          700: "var(--text-zinc-700)",
          800: "var(--text-zinc-800)",
          900: "var(--text-zinc-900)",
        },
        ink: {
          50: "#f6f7fb",
          100: "#eaecf3",
          200: "#d2d8e8",
          300: "#b0b9d5",
          400: "#7f8ab0",
          500: "#5d6a92",
          600: "#46527b",
          700: "#373f5e",
          800: "#252b3f",
          900: "#151925",
          950: "#0b0e17",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.625rem",
        sm: "0.5rem",
      },
      boxShadow: {
        soft: "0 10px 40px -24px rgb(15 23 42 / 0.3)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};

export default config;
