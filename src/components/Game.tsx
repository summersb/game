import { useState } from 'react';
import styled from '@emotion/styled';
import { GameState, Player, createDeck, dealCards } from '../types/game';
import PlayerHand from './PlayerHand';
import Card from './Card';
import { useTheme } from '../context/ThemeContext';

const GameContainer = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
`;

const GameBoard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const CenterArea = styled.div`
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
`;

const DeckArea = styled.div`
    display: flex;
    gap: 20px;
`;

const Button = styled.button<{ themeColors: any }>`
    padding: 10px 20px;
    background-color: ${props => props.themeColors.buttonBackground};
    color: ${props => props.themeColors.buttonText};
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
    
    &:hover {
        background-color: ${props => props.themeColors.buttonHover};
    }
    
    &:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }
`;

const Controls = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
`;

const Game: React.FC = () => {
    const { themeColors, toggleTheme, theme } = useTheme();
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        deck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        gameStarted: false
    });

    const startGame = () => {
        const deck = createDeck();
        const { hands, remainingDeck } = dealCards(deck, 2); // Start with 2 players
        
        const players: Player[] = [
            { id: '1', name: 'Player 1', hand: hands[0], playedCards: [] },
            { id: '2', name: 'Player 2', hand: hands[1], playedCards: [] }
        ];

        setGameState({
            players,
            deck: remainingDeck,
            discardPile: [],
            currentPlayerIndex: 0,
            gameStarted: true
        });
    };

    const drawCard = () => {
        if (gameState.deck.length === 0) return;

        const newState = { ...gameState };
        const drawnCard = newState.deck.pop()!;
        drawnCard.faceUp = true;

        newState.players[newState.currentPlayerIndex].hand.push(drawnCard);
        setGameState(newState);
    };

    const playCard = (cardIndex: number) => {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const newState = { ...gameState };
        
        const playedCard = currentPlayer.hand[cardIndex];
        newState.players[gameState.currentPlayerIndex].hand = 
            currentPlayer.hand.filter((_, index) => index !== cardIndex);
        newState.discardPile = [...newState.discardPile, playedCard];
        
        // Move to next player
        newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
        
        setGameState(newState);
    };

    return (
        <GameContainer>
            <Controls>
                {!gameState.gameStarted ? (
                    <Button themeColors={themeColors} onClick={startGame}>Start Game</Button>
                ) : (
                    <div /> // Empty div for spacing
                )}
                <Button themeColors={themeColors} onClick={toggleTheme}>
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </Button>
            </Controls>
            {gameState.gameStarted && (
                <GameBoard>
                    {gameState.players.map((player, index) => (
                        <PlayerHand
                            key={player.id}
                            player={player}
                            isCurrentPlayer={index === gameState.currentPlayerIndex}
                            onCardClick={index === gameState.currentPlayerIndex ? playCard : undefined}
                        />
                    ))}
                    <CenterArea>
                        <DeckArea>
                            {gameState.deck.length > 0 && (
                                <Card 
                                    card={{ ...gameState.deck[gameState.deck.length - 1], faceUp: false }}
                                    onClick={drawCard}
                                />
                            )}
                            {gameState.discardPile.length > 0 && (
                                <Card 
                                    card={gameState.discardPile[gameState.discardPile.length - 1]}
                                />
                            )}
                        </DeckArea>
                    </CenterArea>
                </GameBoard>
            )}
        </GameContainer>
    );
};

export default Game; 