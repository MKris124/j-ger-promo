/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'jager-orange': '#F37021', // Megtartjuk a gomboknak/fő akcentusnak
        'jager-amber': '#C66C23',  // ÚJ: Az ital elegáns borostyán színe (finomabb ragyogás)
        
        'jager-dark': '#060B08',   // Majdnem fekete, de valójában nagyon sötét zöld
        'jager-green': '#112217',  // A klasszikus sötét üvegzöld
        'jager-green-light': '#1A3323', // Világosabb zöld a kártyákhoz/keretekhez
        
        'jager-light': '#E8EDE9'   // Törtfehér, leheletnyi zöldes-szürkés hűvösséggel
      }
    },
  },
  plugins: [],
}