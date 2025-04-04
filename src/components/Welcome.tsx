import { useState, useEffect } from 'react'
import styled from '@emotion/styled'
import { useTheme } from '../context/ThemeContext'
import { wsService } from '../services/websocket'

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
`

const Title = styled.h1<{ themeColors: any }>`
  color: ${props => props.themeColors.text};
  margin-bottom: 20px;
`

const Button = styled.button<{ themeColors: any }>`
  padding: 15px 30px;
  background-color: ${props => props.themeColors.buttonBackground};
  color: ${props => props.themeColors.buttonText};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2em;

  &:hover {
    background-color: ${props => props.themeColors.buttonHover};
  }
`

const GameList = styled.div<{ themeColors: any }>`
  width: 100%;
  max-width: 600px;
  margin: 20px 0;
  padding: 20px;
  background-color: ${props => props.themeColors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`

const GameItem = styled.div<{ themeColors: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin: 5px 0;
  background-color: ${props => props.themeColors.buttonBackground};
  color: ${props => props.themeColors.buttonText};
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: ${props => props.themeColors.buttonHover};
  }
`

const GameInfo = styled.div`
  display: flex;
  gap: 20px;
`

interface Game {
  id: string;
  name: string;
  playerCount: number;
  currentPlayers: number;
  status: 'waiting' | 'in_progress' | 'finished';
}

interface WelcomeProps {
  onStartGame: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onStartGame }) => {
  const { themeColors } = useTheme()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/sessions')
        const data = await response.json()
        setGames(data.sessions)
      } catch (error) {
        console.error('Error fetching games:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
    // Refresh games list every 5 seconds
    const interval = setInterval(fetchGames, 5000)
    return () => clearInterval(interval)
  }, [])

  const joinGame = async (gameId: string) => {
    try {
      await wsService.sendMessage({ action: 'joinGame', gameId })
    } catch (error) {
      console.error('Error joining game:', error)
    }
  }

  return (
    <WelcomeContainer>
      <GameList themeColors={themeColors}>
        <h2 style={{ color: themeColors.text, marginBottom: '15px' }}>Available Games</h2>
        {loading ? (
          <div style={{ color: themeColors.text }}>Loading games...</div>
        ) : games.length === 0 ? (
          <div style={{ color: themeColors.text }}>No games available</div>
        ) : (
          games.map(game => (
            <GameItem 
              key={game.id} 
              themeColors={themeColors}
              onClick={() => joinGame(game.id)}
            >
              <GameInfo>
                <span>Game {game.id}</span>
                <span>{game.currentPlayers}/{game.playerCount} players</span>
                <span>{game.status}</span>
              </GameInfo>
            </GameItem>
          ))
        )}
      </GameList>

      <Button themeColors={themeColors} onClick={onStartGame}>
        Create New Game
      </Button>
    </WelcomeContainer>
  )
}

export default Welcome 