/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981', // Primary Green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
          DEFAULT: '#10b981',
          dark: '#1a1a1a', 
          primary: '#10b981',
          secondary: '#84cc16',
          gradient_start: '#0f766e',
          gradient_end: '#a3e635',
        },
        neon: {
          green: '#39ff14',
          blue: '#00f3ff',
          purple: '#bc13fe',
        },
        dark: {
          bg: '#0a0a0a',
          card: '#1a1a1a',
          input: '#2a2a2a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0f766e 0%, #84cc16 100%)',
      }
    },
  },
  plugins: [],
}