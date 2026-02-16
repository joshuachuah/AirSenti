/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aviation-inspired color palette
        radar: {
          50: '#e6fff9',
          100: '#b3ffec',
          200: '#00ffc8',
          300: '#00e6b4',
          400: '#00cc9f',
          500: '#00b38b',
          600: '#009977',
          700: '#008063',
          800: '#00664f',
          900: '#004d3b',
        },
        altitude: {
          low: '#22c55e',
          mid: '#eab308',
          high: '#ef4444',
        },
        sky: {
          dark: '#0a0f1a',
          darker: '#050810',
          panel: '#111827',
          border: '#1f2937',
        }
      },
      fontFamily: {
        'display': ['Orbitron', 'monospace'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sweep': 'sweep 4s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 200, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 200, 0.8), 0 0 30px rgba(0, 255, 200, 0.4)' },
        },
      },
      backgroundImage: {
        'radar-grid': `
          linear-gradient(rgba(0, 255, 200, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 200, 0.03) 1px, transparent 1px)
        `,
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      },
      backgroundSize: {
        'radar-grid': '50px 50px',
      },
    },
  },
  plugins: [],
}
