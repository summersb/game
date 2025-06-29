import React, { useEffect, useState } from 'react'
import styled from '@emotion/styled'
import { GameState, SalvoCard } from '../types/game.ts'
import PlayerHand from '../components/PlayerHand.tsx'
import Card from '../components/Card.tsx'
import { ServerMessage, wsService } from '../services/websocket.ts'
import Welcome from './Welcome.tsx'
import { Controls } from '../components/Controls.tsx'
import ThemeButton from '../components/ThemeButton.tsx'
import { ThemeColors } from '../types/theme.ts'
import { useTheme } from '../context/useTheme.tsx'

const GameContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`

const GameBoard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const CenterArea = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
`

const DeckArea = styled.div`
  display: flex;
  gap: 20px;
  align-items: center;
`

const DeckLabel = styled.div<{ themeColors: ThemeColors }>`
  color: ${props => props.themeColors.text};
  font-size: 0.9em;
  text-align: center;
  margin-top: 5px;
`

const DeckStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`

const EmptyCard = styled.div<{ themeColors: ThemeColors }>`
  width: 120px;
  height: 180px;
  border: 2px dashed ${props => props.themeColors.text};
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const Game: React.FC = () => {
  const { themeColors, toggleTheme, theme } = useTheme()
  const [gameState, setGameState] = useState<GameState>()
  const [sessionId, setSessionId] = useState<string>()
  const [selectedSalvo, setSelectedSalvo] = useState<{ card: SalvoCard; index: number } | null>(null)
  const [hasDrawnCard, setHasDrawnCard] = useState(false)
  const [deckCounts, setDeckCounts] = useState({
    shipDeck: 0,
    playDeck: 0,
    discardPile: 0,
  })
  const [error, setError] = useState<string>()

  useEffect(() => {
    wsService.connect()
    const handleMessage = (message: ServerMessage) => {
      console.log('handleMessage message:', message)

      if (message.messageType === 'error') {
        setError(message.error)
        return
      }

      setGameState(message.gameState)
      setSessionId(message.sessionId)
      setDeckCounts({
        shipDeck: message.shipDeckCount,
        playDeck: message.playDeckCount,
        discardPile: message.discardCount,
      })

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

  const startGame = () => {
    wsService.sendMessage({ action: 'startGame', numPlayers: 4 })
  }

  const drawSalvo = () => {
    if (!gameState) {
      alert('No game state found')
      return
    }
    wsService.sendMessage({ action: 'drawSalvo', sessionId: sessionId })
    setHasDrawnCard(true)
  }

  const drawShip = () => {
    if (!gameState) {
      alert('No game state found')
      return
    }
    wsService.sendMessage({ action: 'drawShip', sessionId: sessionId })
  }

  const selectSalvo = (salvo: SalvoCard, index: number) => {
    setSelectedSalvo(selectedSalvo?.card === salvo ? null : { card: salvo, index })
  }

  const discardSalvo = () => {
    if (!gameState) {
      alert('No game state found')
      return
    }

    if (!hasDrawnCard) {
      alert('You must draw a card at the start of your turn!')
      return
    }

    if (!selectedSalvo) {
      alert('Please select a salvo card to discard!')
      return
    }

    wsService.sendMessage({
      action: 'discardSalvo',
      sessionId: sessionId,
      salvo: selectedSalvo.card,
    })

    setSelectedSalvo(null)
    setHasDrawnCard(false)
  }

  const playCard = (cardIndex: number) => {
    if (!hasDrawnCard && gameState?.gameStarted) {
      alert('You must draw a card at the start of your turn!')
      return
    }

    const currentPlayer = gameState?.players.find(p => p.id === gameState?.currentPlayerId)
    if (!currentPlayer) return

    // If it's a salvo card, select it
    const salvoIndex = cardIndex - currentPlayer.ships.length
    const salvo = currentPlayer.hand[salvoIndex]
    selectSalvo(salvo, salvoIndex)
  }

  if (gameState === undefined || gameState === null) {
    return <Welcome onStartGame={startGame} />
  }

  return (
    <GameContainer>
      <Controls>
        <div>
          Current Turn: {gameState.players.find(p => p.id === gameState.currentPlayerId)?.name}
          {!hasDrawnCard && <span style={{ color: 'red' }}> - Draw a card to start your turn!</span>}
          {selectedSalvo && <span> - Selected: {selectedSalvo.card.gunSize}" Salvo</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThemeButton onClick={toggleTheme}>Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode</ThemeButton>
        </div>
      </Controls>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <GameBoard>
        {gameState.players
          .filter(p => p.id !== gameState.currentPlayerId)
          .map(player => (
            <PlayerHand key={player.id} player={player} isCurrentPlayer={false} selectedSalvo={selectedSalvo?.card} />
          ))}
        <CenterArea>
          <DeckArea>
            <DeckStack>
              {deckCounts.shipDeck > 0 && (
                <>
                  <Card type="ship" onClick={drawShip} />
                  <DeckLabel themeColors={themeColors}>Harbor ({deckCounts.shipDeck})</DeckLabel>
                </>
              )}
            </DeckStack>
            <DeckStack>
              {deckCounts.playDeck > 0 && (
                <>
                  <Card type="salvo" onClick={drawSalvo} disabled={hasDrawnCard} />
                  <DeckLabel themeColors={themeColors}>Salvos ({deckCounts.playDeck})</DeckLabel>
                </>
              )}
            </DeckStack>
            <DeckStack>
              {deckCounts.discardPile > 0 ? (
                <Card type="salvo" card={gameState.discardPile} onClick={discardSalvo} disabled={!hasDrawnCard} />
              ) : (
                <EmptyCard
                  themeColors={themeColors}
                  onClick={discardSalvo}
                  style={{ opacity: !hasDrawnCard ? 0.5 : 1 }}
                >
                  Discard
                </EmptyCard>
              )}
              <DeckLabel themeColors={themeColors}>Discard ({deckCounts.discardPile})</DeckLabel>
            </DeckStack>
          </DeckArea>
        </CenterArea>
        <PlayerHand
          player={gameState.players.find(p => p.id === gameState.currentPlayerId)!}
          isCurrentPlayer={true}
          onCardClick={playCard}
          selectedSalvo={selectedSalvo?.card}
        />
      </GameBoard>
    </GameContainer>
  )
}

export default Game
