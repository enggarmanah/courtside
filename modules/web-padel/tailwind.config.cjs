/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          150: 'rgb(var(--brand-150) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        steel: {
          50: '#EEF2FC', 100: '#E0E7F8', 200: '#C4D1F1', 300: '#9CB3EA', 400: '#7292E4',
          500: '#5375E2', 600: '#3F5BC0', 700: '#334998', 800: '#293976', 900: '#222D5A',
        },
      },
      fontSize: {
        'xs': ['0.6875rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'md': ['0.9375rem', { lineHeight: '1.25rem' }],
        'lg': ['1.0625rem', { lineHeight: '1.5rem' }],
        'xl': ['1.1875rem', { lineHeight: '1.75rem' }],
      },
    }
  },
  plugins: [],
};