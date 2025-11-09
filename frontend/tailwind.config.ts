import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#3b82f6",
          light: "#60a5fa",
          dark: "#1e3a8a",
          hover: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;

