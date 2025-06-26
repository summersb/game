import React, { useEffect, useState } from 'react'
import { CreateGameMessage, ServerMessage, wsService } from '../services/websocket.ts'
import ThemeButton from '../components/ThemeButton.tsx'
import ThemeLinkButton from '../components/ThemeLinkButton.tsx'

const CreateGame = (): React.ReactNode => {
  const [numPlayers, setNumPlayers] = useState(2)
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState<string>()

  const createNewGame = () => {
    const createGame: CreateGameMessage = {
      action: 'createGame',
      numPlayers: 4,
      playerName: 'bob',
    }

    wsService.sendMessage(createGame)
  }
  useEffect(() => {
    wsService.connect()
    const handleMessage = (message: ServerMessage) => {
      console.log('handleMessage message:', message)

      if (message.messageType === 'error') {
        setError(message.error)
        return
      }

      // If we don't have a session ID yet, store it
      if (!wsService.getSessionId() && message.gameState.players.length > 0) {
        wsService.setSessionId(message.sessionId)
        wsService.setPlayerId(message.gameState.players[0].id)
      }
    }

    wsService.addMessageHandler(handleMessage)
    return () => {
      wsService.removeMessageHandler(handleMessage)
      wsService.disconnect()
    }
  }, [])

  return (
    <div>
      <ThemeLinkButton to="/">Home</ThemeLinkButton>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <select
              value={numPlayers}
              onChange={e => setNumPlayers(Number(e.target.value))}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {[2, 3, 4].map(num => (
                <option key={num} value={num}>
                  {num} Players
                </option>
              ))}
            </select>
          </>
        <ThemeButton onClick={createNewGame}>Create Game</ThemeButton>
      </div>
    </div>
  )
}

export default CreateGame
