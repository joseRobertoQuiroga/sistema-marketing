/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#051424",
        "on-background": "#d4e4fa",
        primary: "#c0c1ff",
        secondary: "#4edea3",
        tertiary: "#ffb2b7",
        "surface-container": "#122131",
        "surface-container-low": "#0d1c2d",
        "on-surface": "#d4e4fa",
        outline: "#908fa0",
      }
    },
  },
  plugins: [],
}
