import React, { useEffect, useState } from 'react'
import styled from '@emotion/styled'
import { wsService } from '../services/websocket.ts'
import { ThemeColors } from '../types/theme.ts'
import ThemeLinkButton from '../components/ThemeLinkButton.tsx'
import { useTheme } from '../context/useTheme.tsx'

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
`

const GameList = styled.div<{ themeColors: ThemeColors }>`
  width: 100%;
  max-width: 600px;
  margin: 20px 0;
  padding: 20px;
  background-color: ${props => props.themeColors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`

const GameItem = styled.div<{ themeColors: ThemeColors }>`
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
  id: string
  name: string
  playerCount: number
  currentPlayers: number
  status: 'waiting' | 'in_progress' | 'finished'
}

interface WelcomeProps {
  onStartGame: () => void
}

const Welcome: React.FC<WelcomeProps> = () => {
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

    fetchGames().catch(console.error)
    // Refresh games list every 5 seconds
    const interval = setInterval(fetchGames, 5000)
    return () => clearInterval(interval)
  }, [])

  const joinGame = async (gameId: string) => {
    try {
      await wsService.sendMessage({ action: 'joinGame', sessionId: gameId, playerName: 'test' })
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
            <GameItem key={game.id} themeColors={themeColors} onClick={() => joinGame(game.id)}>
              <GameInfo>
                <span>Game {game.id}</span>
                <span>
                  {game.currentPlayers}/{game.playerCount} players
                </span>
                <span>{game.status}</span>
              </GameInfo>
            </GameItem>
          ))
        )}
      </GameList>

      <ThemeLinkButton to="/creategame">Create New Game</ThemeLinkButton>
    </WelcomeContainer>
  )
}

export default Welcome
