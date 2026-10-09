// Tailwind build config (replaces the in-browser CDN). Build: npm run build:css → css/tailwind.css
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './admin.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A552E', // primary buttons, chips, active states
          deep: '#164E2A',    // hover / pressed
          band: '#1F4028',    // footer band
          soft: '#EBF2E6',    // "Create your own bundle" card
          mist: '#E2EBD9',    // featured card footer strip
        },
        gold: { DEFAULT: '#A3713F', deep: '#8C5F33', soft: '#F9EEDC', cream: '#E8DACB' },
        sand: '#F2EDE4',      // category cards
        paper: '#FCFBF9',     // page background
        ink: { DEFAULT: '#131918', soft: '#4A544E', mute: '#6B746E' },
        line: '#E6E3DC',
      },
      fontFamily: {
        script: ['"Kaushan Script"', 'cursive'],
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        price: ['Montserrat', '"Nunito Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Nunito Sans"', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
};
