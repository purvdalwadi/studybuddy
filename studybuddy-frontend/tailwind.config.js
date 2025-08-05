/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');
const theme = require('./tailwind.theme');

module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: {
  			DEFAULT: '1rem',
  			sm: '2rem',
  			lg: '4rem',
  			xl: '5rem',
  			'2xl': '6rem'
  		},
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	screens: {
  		xs: '475px',
            ...defaultTheme.screens
  	},
  	extend: {
  		colors: {
                ...theme.colors,
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: 'theme.fontFamily',
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: 'theme.boxShadow',
  		keyframes: {
                ...theme.keyframes
  		},
  		animation: {
                ...theme.animation
  		},
  		backgroundImage: {
  			'gradient-primary': 'linear-gradient(to right, var(--tw-gradient-stops))',
  			'gradient-primary-45': 'linear-gradient(45deg, var(--tw-gradient-stops))',
  			'gradient-primary-90': 'linear-gradient(90deg, var(--tw-gradient-stops))'
  		},
  		transitionProperty: {
  			height: 'height',
  			spacing: 'margin, padding',
  			opacity: 'opacity',
  			transform: 'transform'
  		}
  	}
  },
  // Plugins
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/line-clamp'),
    require('tailwindcss-animate'),
    
    // Custom component utilities
    function({ addComponents }) {
      addComponents({
        // Gradient text utility
        '.text-gradient': {
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        },
        // Card component
        '.card': {
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.boxShadow.card,
          borderWidth: '1px',
          borderColor: theme.colors.gray[200],
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: theme.boxShadow['card-hover'],
            transform: 'translateY(-2px)',
          },
        },
        // Button base styles
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.borderRadius.DEFAULT,
          fontWeight: '500',
          padding: '0.5rem 1rem',
          transition: 'all 0.2s ease',
          '&:focus': {
            outline: '2px solid transparent',
            outlineOffset: '2px',
            ring: '2px',
            ringColor: theme.colors.primary[300],
          },
          '&:disabled': {
            opacity: '0.6',
            cursor: 'not-allowed',
          },
        },
        // Primary button
        '.btn-primary': {
          backgroundImage: `linear-gradient(to right, ${theme.colors.primary[500]}, ${theme.colors.secondary[500]})`,
          color: 'white',
          '&:hover': {
            backgroundImage: `linear-gradient(to right, ${theme.colors.primary[600]}, ${theme.colors.secondary[600]})`,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
      });
    },
  ],
};
