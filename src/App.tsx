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

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`

const Button = styled.button<{ themeColors: any }>`
  padding: 10px 20px;
  background-color: ${props => props.themeColors.buttonBackground};
  color: ${props => props.themeColors.buttonText};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;

  &:hover {
    background-color: ${props => props.themeColors.buttonHover};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

const ThemedApp = () => {
  const { themeColors, toggleTheme, theme } = useTheme()

  return (
    <AppContainer themeColors={themeColors}>
      <Title themeColors={themeColors}>Naval Combat Card Game</Title>
      <Controls>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button themeColors={themeColors} onClick={toggleTheme}>
            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
          </Button>
        </div>
      </Controls>
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
