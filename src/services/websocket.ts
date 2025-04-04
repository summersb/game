import { GameState, ShipCard, SalvoCard } from '../types/game'

export type ClientMessage = {
  action: 'startGame' | 'drawSalvo' | 'drawShip' | 'fireSalvo' | 'discardSalvo' | 'joinGame'
  sessionId?: string
  playerId?: string
}

export type StartGameMessage = ClientMessage & {
  action: 'startGame'
  numPlayers: number
}

export type JoinGameMessage = ClientMessage & {
  action: 'joinGame'
  gameId: string
}

export type DrawSalvoMessage = ClientMessage & {
  action: 'drawSalvo'
}

export type DrawShipMessage = ClientMessage & {
  action: 'drawShip'
}

export type FireSalvoMessage = ClientMessage & {
  action: 'fireSalvo'
  salvo: SalvoCard
  target: ShipCard
}

export type DiscardSalvoMessage = ClientMessage & {
  action: 'discardSalvo'
  salvo: SalvoCard
}

export type ClientMessageType = StartGameMessage | JoinGameMessage | DrawSalvoMessage | DrawShipMessage | FireSalvoMessage | DiscardSalvoMessage

export type ServerMessage = {
  gameState: GameState
  shipDeckCount: number
  playDeckCount: number
  discardCount: number
  sessionId: string
}

class WebSocketService {
  private ws: WebSocket | null = null
  private messageHandlers: ((message: ServerMessage) => void)[] = []
  private sessionId: string | null = null
  private playerId: string | null = null

  connect() {
    this.ws = new WebSocket('ws://localhost:8080/ws')

    this.ws.onmessage = event => {
      const message: ServerMessage = JSON.parse(event.data)
      console.log('Received message:', message)
      this.messageHandlers.forEach(handler => handler(message))
    }

    this.ws.onerror = error => {
      console.error('WebSocket error:', error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket connection closed')
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000)
    }
  }

  sendMessage(message: ClientMessageType): void {
    console.log('Sending message:', message)
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Add session and player information to all messages
      const messageWithSession = {
        ...message,
        playerId: this.playerId,
      }
      this.ws.send(JSON.stringify(messageWithSession))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  addMessageHandler(handler: (message: ServerMessage) => void) {
    this.messageHandlers.push(handler)
  }

  removeMessageHandler(handler: (message: ServerMessage) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
  }

  disconnect() {
    console.log('Disconnecting from WebSocket')
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  // New methods for session management
  setSessionId(sessionId: string) {
    this.sessionId = sessionId
  }

  setPlayerId(playerId: string) {
    this.playerId = playerId
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  getPlayerId(): string | null {
    return this.playerId
  }
}

export const wsService = new WebSocketService()
