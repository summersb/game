import React, { useState } from 'react'
import ThemeButton from '../components/ThemeButton.tsx'
import { JoinGameMessage, wsService } from '../services/websocket.ts'

type Props = {
  sessionId: string
}

const JoinGame: React.FC<Props> = ({sessionId}) => {
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState<string>()

  const joinGame = () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    wsService.sendMessage({
      action: 'joinGame',
      sessionId: sessionId,
      playerName: playerName.trim(),
    } as JoinGameMessage)
  }
  return (
      <>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
        <input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <ThemeButton onClick={joinGame}>Join Game</ThemeButton>
      </>
  )
}

export default JoinGame