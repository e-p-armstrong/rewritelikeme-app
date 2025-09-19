/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'floral-white': '#FFFAF0',
        'orange': '#FFA500',
      }
    },
  },
  plugins: [],
}