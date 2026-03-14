/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Ebből tudja a Tailwind, hogy a mi fájljainkat kell figyelnie
  ],
  theme: {
    extend: {
      colors: {
        'jager-orange': '#F37021', // A klasszikus narancssárga szín
        'jager-dark': '#1A1A1A',   // Sötétszürke/fekete háttér
        'jager-light': '#F5F5F5'   // Törtfehér szövegekhez
      }
    },
  },
  plugins: [],
}