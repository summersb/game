import React, { createContext, useState, useEffect } from 'react'
import { Theme, themes } from '../types/theme'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  themeColors: typeof themes.light
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if user has previously selected theme
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme) return savedTheme

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.body.style.backgroundColor = themes[theme].background
    document.body.style.color = themes[theme].text
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeColors: themes[theme] }}>{children}</ThemeContext.Provider>
  )
}

export { ThemeContext, ThemeProvider }