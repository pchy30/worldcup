/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0D1B2A",
        accent: "#F5B700",
        surface: "#1A2D42",
        muted: "#4A6080",
      },
    },
  },
  plugins: [],
};
