/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        radar: {
          50: '#e6fff9',
          100: '#b3ffec',
          200: '#80ffdf',
          300: '#4dffd2',
          400: '#00ffc8',
          500: '#00d9aa',
          600: '#00b38b',
          700: '#008c6d',
          800: '#00664f',
          900: '#003f31',
        },
        amber: {
          350: '#fbbf24',
        },
        void: {
          950: '#020409',
          900: '#030712',
          850: '#060c18',
          800: '#0a1120',
          700: '#0f172a',
          600: '#1e293b',
          500: '#334155',
        },
        hud: {
          panel: 'rgba(6, 12, 24, 0.85)',
          border: 'rgba(0, 255, 200, 0.08)',
          'border-active': 'rgba(0, 255, 200, 0.2)',
          glass: 'rgba(15, 23, 42, 0.6)',
          surface: 'rgba(10, 17, 32, 0.9)',
        },
      },
      fontFamily: {
        display: ['Chakra Petch', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'sweep': 'sweep 4s linear infinite',
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite alternate',
        'scan': 'scan 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'blink': 'blink 1.2s step-end infinite',
        'grain': 'grain 0.5s steps(1) infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%': { boxShadow: '0 0 4px rgba(0, 255, 200, 0.15), inset 0 0 4px rgba(0, 255, 200, 0.05)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 200, 0.25), inset 0 0 8px rgba(0, 255, 200, 0.08)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -10%)' },
          '20%': { transform: 'translate(-15%, 5%)' },
          '30%': { transform: 'translate(7%, -25%)' },
          '40%': { transform: 'translate(-5%, 25%)' },
          '50%': { transform: 'translate(-15%, 10%)' },
          '60%': { transform: 'translate(15%, 0%)' },
          '70%': { transform: 'translate(0%, 15%)' },
          '80%': { transform: 'translate(3%, 35%)' },
          '90%': { transform: 'translate(-10%, 10%)' },
        },
      },
      backgroundImage: {
        'hex-grid': `url("data:image/svg+xml,%3Csvg width='60' height='40' viewBox='0 0 60 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 15V35L30 40L0 35V15Z' fill='none' stroke='rgba(0,255,200,0.03)' stroke-width='0.5'/%3E%3C/svg%3E")`,
      },
      boxShadow: {
        'glow': '0 0 15px rgba(0, 255, 200, 0.15), 0 0 30px rgba(0, 255, 200, 0.05)',
        'glow-strong': '0 0 20px rgba(0, 255, 200, 0.3), 0 0 40px rgba(0, 255, 200, 0.1)',
        'glow-danger': '0 0 15px rgba(239, 68, 68, 0.3), 0 0 30px rgba(239, 68, 68, 0.1)',
        'glow-amber': '0 0 15px rgba(245, 158, 11, 0.3), 0 0 30px rgba(245, 158, 11, 0.1)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 0 20px rgba(0, 255, 200, 0.02)',
        'panel': '0 4px 30px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 255, 200, 0.05)',
      },
    },
  },
  plugins: [],
}
