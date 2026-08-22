/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        room: {
          dark: '#1a1814',
          mid: '#2a2520',
          light: '#3a332c',
        },
        creature: {
          glow: '#e8d5b7',
          dim: '#8a7e6b',
        },
        warm: {
          50: '#faf6f1',
          100: '#f0e6d6',
          200: '#e0cbb0',
          300: '#c9a87c',
          400: '#b0865a',
          500: '#966a40',
        }
      },
      animation: {
        'breathe': 'breathe 4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.8s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'cue-pop': 'cuePop 0.28s cubic-bezier(0.2, 0.9, 0.25, 1.2)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cuePop: {
          '0%': { opacity: '0', transform: 'translateY(5px) scale(0.86)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
