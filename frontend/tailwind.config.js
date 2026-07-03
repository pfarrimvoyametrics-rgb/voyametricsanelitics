/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Base neutra para que as cores de estado de SLA carreguem o significado.
        ink: '#0f172a',
        canvas: '#f4f6fb',
      },
    },
  },
  plugins: [],
};
