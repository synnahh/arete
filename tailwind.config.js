/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'exo': ['"Exo 2"', 'sans-serif'],
        'dm': ['"DM Sans"', 'sans-serif'],
        'orbitron': ['Orbitron', 'sans-serif'],
        'sora': ['Sora', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'geist': ['Geist', 'sans-serif'],
      },
      colors: {
        accent: 'var(--accent)',
        'bg-base': 'var(--bg-base)',
        'bg-sidebar': 'var(--bg-sidebar)',
        'card-fill': 'var(--card-fill)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'orb-breathe': 'orb-breathe 3s ease-in-out infinite',
        'ripple': 'ripple 1.5s ease-out infinite',
        'particle-orbit': 'particle-orbit 2s linear infinite',
      },
      keyframes: {
        'orb-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        'ripple': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'particle-orbit': {
          '0%': { transform: 'rotate(0deg) translateX(24px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(24px) rotate(-360deg)' },
        },
      },
    },
  },
  plugins: [],
}
