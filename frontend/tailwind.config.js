/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        'primary-dark': '#4f46e5',
        surface: '#f8fafc',
        'surface-alt': '#f1f5f9',
        card: '#ffffff',
        heading: '#1a1a2e',
        secondary: '#6b7280',
        'text-muted': '#9ca3af',
        'border-subtle': '#eef0f4',
        'accent-from': '#6366f1',
        'accent-to': '#8b5cf6',
        'accent-50': '#eef2ff',
        'accent-100': '#e0e7ff',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        'glow': '0 4px 15px rgba(99, 102, 241, 0.3)',
      },
    },
  },
  plugins: [],
}
