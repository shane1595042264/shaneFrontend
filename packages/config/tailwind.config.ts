import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "element-data": "#3b82f6",
        "element-gaming": "#22c55e",
        "element-creative": "#a855f7",
        "element-tools": "#f97316",
        "element-projects": "#14b8a6",
      },
    },
  },
  plugins: [],
};

export default config;
