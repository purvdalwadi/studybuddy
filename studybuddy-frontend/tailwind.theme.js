const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  // Color Palette
  colors: {
    // Base colors
    transparent: 'transparent',
    current: 'currentColor',
    white: '#ffffff',
    black: '#000000',
    
    // Gray scale - for backgrounds, text, and UI elements
    gray: {
      50: '#f9fafb',  // Light background
      100: '#f3f4f6', // Page background
      200: '#e5e7eb', // Borders, dividers
      300: '#d1d5db', // Input borders
      400: '#9ca3af', // Secondary text
      500: '#6b7280', // Muted text
      600: '#4b5563', // Regular text
      700: '#374151', // Headings
      800: '#1f2937',
      900: '#111827',
    },
    
    // Primary colors - Purple to Blue gradient
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',  // Purple-500
      600: '#7c3aed',  // Purple-600
      700: '#6d28d9',  // Purple-700
      800: '#5b21b6',
      900: '#4c1d95',
    },
    
    // Secondary colors - Blue
    secondary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Blue-500
      600: '#2563eb',  // Blue-600
      700: '#1d4ed8',  // Blue-700
      800: '#1e40af',
      900: '#1e3a8a',
    },
    
    // Status colors
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',  // Green-400 (Available)
      500: '#22c55e',  // Green-500
      600: '#16a34a',  // Green-600
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',  // Yellow-400 (Almost Full)
      500: '#f59e0b',  // Yellow-500
      600: '#d97706',  // Yellow-600
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',  // Red-400 (Full)
      500: '#ef4444',  // Red-500
      600: '#dc2626',  // Red-600
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
  },
  
  // Typography
  fontFamily: {
    sans: ['Inter var', ...defaultTheme.fontFamily.sans],
    display: ['Cal Sans', ...defaultTheme.fontFamily.sans],
    heading: ['Cal Sans', 'Inter', ...defaultTheme.fontFamily.sans],
  },
  
  // Border radius
  borderRadius: {
    'none': '0px',
    'sm': '0.125rem',
    'DEFAULT': '0.25rem',
    'md': '0.375rem',
    'lg': '0.5rem',
    'xl': '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    'full': '9999px',
  },
  
  // Box shadow
  boxShadow: {
    'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  
  // Animation
  keyframes: {
    'accordion-down': {
      from: { height: 0 },
      to: { height: 'var(--radix-accordion-content-height)' },
    },
    'accordion-up': {
      from: { height: 'var(--radix-accordion-content-height)' },
      to: { height: 0 },
    },
    'fade-in': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    'slide-up': {
      '0%': { transform: 'translateY(10px)', opacity: '0' },
      '100%': { transform: 'translateY(0)', opacity: '1' },
    },
  },
  
  animation: {
    'accordion-down': 'accordion-down 0.2s ease-out',
    'accordion-up': 'accordion-up 0.2s ease-out',
    'fade-in': 'fade-in 0.2s ease-out',
    'slide-up': 'slide-up 0.2s ease-out',
  },
};
