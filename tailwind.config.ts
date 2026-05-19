import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7fb',
          100: '#e9ecf4',
          200: '#c9d1e1',
          300: '#9ba6c0',
          400: '#6c7997',
          500: '#4b5775',
          600: '#34405c',
          700: '#222b42',
          800: '#161c2d',
          900: '#0c1020',
          950: '#070914',
        },
        accent: {
          400: '#7cdcff',
          500: '#34c2ff',
          600: '#149dde',
        },
        success: { 500: '#22c55e', 600: '#16a34a' },
        warning: { 500: '#f59e0b', 600: '#d97706' },
        danger: { 500: '#ef4444', 600: '#dc2626' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(52,194,255,0.25), 0 8px 32px rgba(52,194,255,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
