import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd3ff',
          300: '#90b6ff',
          400: '#5b8dff',
          500: '#3564f6',
          600: '#1f44eb',
          700: '#1a35d7',
          800: '#1c2eae',
          900: '#1c2d89',
          950: '#151c4f',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
