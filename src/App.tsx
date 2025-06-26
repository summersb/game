import Game from './features/Game.tsx'
import { Controls } from './components/Controls.tsx'
import ThemeButton from './components/ThemeButton.tsx'
import { useTheme } from './context/useTheme.tsx'

const ThemedApp = () => {
  const { toggleTheme, theme } = useTheme()

  return (
    <>
      <Controls>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThemeButton onClick={toggleTheme}>Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode</ThemeButton>
        </div>
      </Controls>
      <Game />
    </>
  )
}

function App() {
  return <ThemedApp />
}

export default App
