/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Ebből tudja a Tailwind, hogy a mi fájljainkat kell figyelnie
  ],
  theme: {
    extend: {
      colors: {
        'jager-orange': '#F37021', // A klasszikus narancssárga szín
        'jager-dark': '#0f0f0f',   // Sötétebb lett, még jobb a kontraszt
        'jager-light': '#F5F5F5',  // Törtfehér szövegekhez
        'jager-green': '#14251a',  // Új: Klasszikus sötét üvegzöld a Jäger palackról
        'jager-green-light': '#1e3827' // Új: Világosabb zöld a hover effektekhez
      }
    },
  },
  plugins: [],
}