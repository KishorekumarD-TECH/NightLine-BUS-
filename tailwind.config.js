/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',        // dark text (slate-900)
        brand: '#2563eb',      // blue
        branddark: '#1d4ed8',
        accent: '#f97316',     // orange
        accentdark: '#ea580c',
        mist: '#f8fafc',       // page background (slate-50)
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
