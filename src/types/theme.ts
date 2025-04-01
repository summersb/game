export type Theme = 'light' | 'dark'

export interface ThemeColors {
  background: string
  text: string
  cardBackground: string
  cardText: string
  handBackground: string
  buttonBackground: string
  buttonText: string
  buttonHover: string
}

export const themes: Record<Theme, ThemeColors> = {
  light: {
    background: '#f5f5f5',
    text: '#333',
    cardBackground: '#fff',
    cardText: '#000',
    handBackground: 'rgba(0, 0, 0, 0.05)',
    buttonBackground: '#2962ff',
    buttonText: '#fff',
    buttonHover: '#1565c0',
  },
  dark: {
    background: '#1a1a1a',
    text: '#fff',
    cardBackground: '#424242',
    cardText: '#fff',
    handBackground: 'rgba(255, 255, 255, 0.05)',
    buttonBackground: '#3d5afe',
    buttonText: '#fff',
    buttonHover: '#536dfe',
  },
}
