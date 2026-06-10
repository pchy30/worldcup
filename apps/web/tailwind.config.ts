import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0A1628",
        accent: "#F5B700",
        surface: "#112240",
        muted: "#4A6080",
        "wc-blue": "#003DA5",
        "wc-red": "#E5001B",
        "wc-gold": "#F5B700",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "wc-gradient": "linear-gradient(135deg, #003DA5 0%, #0A1628 50%, #E5001B 100%)",
      },
      boxShadow: {
        "glow-gold": "0 0 20px rgba(245, 183, 0, 0.3)",
        "glow-blue": "0 0 20px rgba(0, 61, 165, 0.4)",
      },
      animation: {
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
