/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7B1E1E', // Primary Maroon
          dark: '#5E1515',    // Dark Maroon
          accent: '#A52A2A',  // Accent Maroon
        },
        bg: {
          page: '#FAF8F4',    // Off-White
          card: '#FFFFFF',    // White
        },
        border: {
          DEFAULT: '#E8E1D9', // Custom border
        },
        text: {
          primary: '#2F2F2F', // Main text
          muted: '#6B6460',   // Secondary/muted text
          hint: '#9E9590',    // Placeholder/hint text
        },
        success: {
          DEFAULT: '#1A7A4A',
        },
        warning: {
          DEFAULT: '#C47A00',
        },
        danger: {
          DEFAULT: '#B02020',
        }
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
        'input': '8px',
        'badge': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06)',
        'popup': '0 8px 32px rgba(0,0,0,0.12)',
      }
    },
  },
  plugins: [],
}
