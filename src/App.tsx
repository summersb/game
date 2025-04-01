import styled from '@emotion/styled'
import Game from './components/Game'
import { ThemeProvider } from './context/ThemeContext'
import { useTheme } from './context/ThemeContext'

const AppContainer = styled.div<{ themeColors: any }>`
  min-height: 100vh;
  background-color: ${props => props.themeColors.background};
  padding: 20px;
`

const Title = styled.h1<{ themeColors: any }>`
  text-align: center;
  color: ${props => props.themeColors.text};
  margin-bottom: 30px;
`

const ThemedApp = () => {
  const { themeColors } = useTheme()

  return (
    <AppContainer themeColors={themeColors}>
      <Title themeColors={themeColors}>Naval Combat Card Game</Title>
      <Game />
    </AppContainer>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  )
}

export default App
