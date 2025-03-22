export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
    faceUp: boolean;
}

export interface Player {
    id: string;
    name: string;
    hand: Card[];
    playedCards: Card[];
}

export interface GameState {
    players: Player[];
    deck: Card[];
    discardPile: Card[];
    currentPlayerIndex: number;
    gameStarted: boolean;
}

export const createDeck = (): Card[] => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank, faceUp: false });
        }
    }

    return shuffle(deck);
};

export const shuffle = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export const dealCards = (deck: Card[], numPlayers: number): { hands: Card[][], remainingDeck: Card[] } => {
    const hands: Card[][] = Array(numPlayers).fill([]).map(() => []);
    const remainingDeck = [...deck];
    
    // Deal 10 cards to each player
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < numPlayers; j++) {
            if (remainingDeck.length > 0) {
                const card = remainingDeck.pop()!;
                hands[j] = [...hands[j], { ...card, faceUp: true }];
            }
        }
    }

    return { hands, remainingDeck };
}; 