# Game Server

This is the WebSocket server for the naval combat card game. It handles game state management and communicates with the client through WebSocket connections.

## Prerequisites

- Go 1.21 or later
- The Gorilla WebSocket package (will be installed automatically)

## Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
go mod tidy
```

3. Run the server:
```bash
go run main.go
```

The server will start on port 8080 and listen for WebSocket connections at `ws://localhost:8080/ws`.

## Development

The server implements the following WebSocket message types:

### Client Messages
```typescript
{
    action: 'startGame' | 'drawSalvo' | 'drawShip' | 'fireSalvo' | 'discardSalvo';
    card?: SalvoCard | ShipCard;
    target?: ShipCard;
}
```

### Server Messages
```typescript
{
    gameState: GameState;
    shipDeckCount: number;
    playDeckCount: number;
    discardCount: number;
}
```

## Game State Management

The server maintains the game state and handles:
- Deck management (ship deck, play deck, discard pile)
- Player turns
- Card drawing and playing
- Combat resolution
- Game win conditions

## Security

In development mode, the server accepts WebSocket connections from any origin. For production, you should configure the `CheckOrigin` function in the WebSocket upgrader to only accept connections from trusted domains. 