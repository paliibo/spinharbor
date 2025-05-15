/** Brand tokens shared by the player app, admin area and e-mail/preview surfaces. */
export const brand = {
  name: 'SpinHarbor',
  colors: {
    bg: '#0b0b10',
    surface: '#13131b',
    surfaceAlt: '#1a1a25',
    border: '#272736',
    purple: '#6d3df5',
    violet: '#9b6bff',
    gold: '#d4a84b',
    cyan: '#36d6e7',
    text: '#f2f1f7',
    muted: '#9a98ad',
    success: '#3ad28c',
    danger: '#ff5c7a',
  },
} as const;

export const tierColors: Record<string, string> = {
  BRONZE: '#c47a3c',
  SILVER: '#b7bcc9',
  GOLD: '#d4a84b',
  PLATINUM: '#9ad8ff',
};
