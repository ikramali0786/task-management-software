import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ember — confident vermilion accent, replaces the generic indigo.
        brand: {
          50: '#fff3ee',
          100: '#ffe3d6',
          200: '#ffc2ad',
          300: '#ff9b7b',
          400: '#fb7350',
          500: '#e8502e',
          600: '#c93d1f',
          700: '#a52f17',
          800: '#802716',
          900: '#5e2014',
        },
        // Warm neutral — re-maps Tailwind's cold slate to a paper/ink scale so
        // every existing `slate-*` utility inherits the warm Atelier palette.
        slate: {
          50: '#faf8f4',
          100: '#f3f0ea',
          200: '#e7e1d7',
          300: '#d4ccbe',
          400: '#a89f8f',
          500: '#837a6b',
          600: '#645c50',
          700: '#49433a',
          800: '#312d26',
          900: '#211e19',
          950: '#141210',
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Hanken Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        // Warm-tuned elevation, replaces cold default shadows.
        soft: '0 1px 2px rgba(33, 30, 25, 0.04), 0 4px 16px rgba(33, 30, 25, 0.06)',
        lift: '0 4px 12px rgba(33, 30, 25, 0.08), 0 16px 40px rgba(33, 30, 25, 0.10)',
        ember: '0 6px 20px rgba(232, 80, 46, 0.30)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
