export const theme = {
  containerMaxWidth: 1200,
  colors: {
    primary: '#3f51b5',
    text: '#333',
    background: '#fafbfc',
    border: '#ccc',
  },
  spacing: {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 32,
  },
} as const;

export type Theme = typeof theme;
