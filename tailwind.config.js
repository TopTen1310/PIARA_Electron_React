const flattenColorPalette =
  require('tailwindcss/lib/util/flattenColorPalette').default;
const safeListFile = 'safelist.txt';
module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.html',
    './src/**/*.js',
    './src/**/*.jsx',
    './src/**/*.ts',
    './src/**/*.tsx',
    './safelist.txt',
  ],
  theme: {
    fontFamily: {
      body: ['Poppins', 'sans'],
    },
    screens: {
      xs: '576',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        highlight: {
          date: '#f44336', // Red
          time: '#E91E63', // Pink
          domain: '#9C27B0', // Purple
          per: '#673AB7', // Deep Purple
          misc: '#3F51B5', // Indigo
          org: '#2196F3', // Blue
          loc: '#FF5722', // Deep Orange
          email: '#00BCD4', // Cyan
          phone: '#607d8b', // Blue Grey
          custom0: '#795548', // Brown
          custom1: '#009688', // Teal
          custom2: '#4CAF50', // Green
          custom3: '#8BC34A', // Light Green
          custom4: '#CDDC39', // Lime
          custom5: '#FFEB3B', // Yellow
          custom6: '#FFC107', // Amber
          custom7: '#FF9800', // Orange
        },
      },
    },
  },
  variants: {},
  plugins: [
    ({ addUtilities, e, theme, variants }) => {
      const colors = flattenColorPalette(theme('borderColor'));
      delete colors['default'];

      const colorMap = Object.keys(colors).map((color) => ({
        [`.border-t-${color}`]: { borderTopColor: colors[color] },
        [`.border-r-${color}`]: { borderRightColor: colors[color] },
        [`.border-b-${color}`]: { borderBottomColor: colors[color] },
        [`.border-l-${color}`]: { borderLeftColor: colors[color] },
      }));
      const utilities = Object.assign({}, ...colorMap);

      addUtilities(utilities, variants('borderColor'));
    },
    // If your application does not require multiple theme selection,
    // you can replace {color} to your theme color value
    // this can drastically reduces the size of the output css file
    // e.g 'text-{colors}' --> 'text-emerald'
    require('tailwind-safelist-generator')({
      path: safeListFile,
      patterns: [
        'text-{colors}',
        'bg-{colors}',
        'dark:bg-{colors}',
        'dark:hover:bg-{colors}',
        'dark:active:bg-{colors}',
        'hover:text-{colors}',
        'hover:bg-{colors}',
        'active:bg-{colors}',
        'ring-{colors}',
        'hover:ring-{colors}',
        'focus:ring-{colors}',
        'focus-within:ring-{colors}',
        'border-{colors}',
        'focus:border-{colors}',
        'focus-within:border-{colors}',
        'dark:text-{colors}',
        'dark:hover:text-{colors}',
        'h-{height}',
        'w-{width}',
      ],
    }),
    require('@tailwindcss/aspect-ratio'),
    require('tailwindcss-gradients'),
  ],
};
