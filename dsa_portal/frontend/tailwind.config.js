/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Navdhan "white concrete, single ember" system — matches the marketing site.
        ember: { DEFAULT: '#F6931E', hover: '#DB7D12' },
        abyss: '#000710',
        carbon: '#15191E',
        ink: '#0B0F14',
        paper: '#FFFFFF',
        fog: '#F3F3F7',
        mist: '#D9DBE3',
        steel: '#8B8D98',
        pewter: '#6F737B',
        graphite: '#60646C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
