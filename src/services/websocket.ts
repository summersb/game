import { GameState, ShipCard, SalvoCard } from '../types/game';

export type ClientMessage = {
    action: 'startGame' | 'drawSalvo' | 'drawShip' | 'fireSalvo' | 'discardSalvo';
    card?: SalvoCard | ShipCard;
    target?: ShipCard;
};

export type ServerMessage = {
    gameState: GameState;
    shipDeckCount: number;
    playDeckCount: number;
    discardCount: number;
};

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: ServerMessage) => void)[] = [];

    connect() {
        this.ws = new WebSocket('ws://localhost:8080/ws');

        this.ws.onmessage = (event) => {
            const message: ServerMessage = JSON.parse(event.data);
            this.messageHandlers.forEach(handler => handler(message));
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
        };
    }

    sendMessage(message: ClientMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    addMessageHandler(handler: (message: ServerMessage) => void) {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (message: ServerMessage) => void) {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const wsService = new WebSocketService(); 