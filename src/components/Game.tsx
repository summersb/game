import { useState } from 'react';
import styled from '@emotion/styled';
import { GameState, Player, ShipCard, SalvoCard, createShipDeck, createPlayDeck, dealInitialHands } from '../types/game';
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
        shipDeck: [],
        playDeck: [],
        currentPlayerIndex: 0,
        gameStarted: false
    });

    const [selectedShip, setSelectedShip] = useState<ShipCard | null>(null);

    const startGame = () => {
        const shipDeck = createShipDeck();
        const playDeck = createPlayDeck();
        const { playerShips, playerHands, remainingShipDeck, remainingPlayDeck } = dealInitialHands(shipDeck, playDeck, 2);
        
        const players: Player[] = [
            { id: '1', name: 'Player 1', ships: playerShips[0], hand: playerHands[0], discardedSalvos: [] },
            { id: '2', name: 'Player 2', ships: playerShips[1], hand: playerHands[1], discardedSalvos: [] }
        ];

        setGameState({
            players,
            shipDeck: remainingShipDeck,
            playDeck: remainingPlayDeck,
            currentPlayerIndex: 0,
            gameStarted: true
        });
    };

    const drawSalvo = () => {
        if (gameState.playDeck.length === 0) return;

        const newState = { ...gameState };
        const drawnCard = newState.playDeck.pop()!;
        drawnCard.faceUp = true;

        newState.players[newState.currentPlayerIndex].hand.push(drawnCard);
        setGameState(newState);
    };

    const playSalvo = (cardIndex: number) => {
        if (!selectedShip) return;

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const targetPlayer = gameState.players[(gameState.currentPlayerIndex + 1) % 2];
        const salvoCard = currentPlayer.hand[cardIndex];

        // Check if the salvo matches the selected ship's gun size
        if (salvoCard.gunSize !== selectedShip.gunSize) {
            alert("Salvo gun size must match the target ship's gun size!");
            return;
        }

        const newState = { ...gameState };
        
        // Remove the salvo card from hand and add to discarded
        newState.players[gameState.currentPlayerIndex].hand = 
            currentPlayer.hand.filter((_, index) => index !== cardIndex);
        newState.players[gameState.currentPlayerIndex].discardedSalvos.push(salvoCard);

        // Apply damage to the ship
        const shipIndex = targetPlayer.ships.findIndex(ship => ship === selectedShip);
        if (shipIndex !== -1) {
            const updatedShip = { ...selectedShip };
            updatedShip.hitPoints -= salvoCard.damage;

            if (updatedShip.hitPoints <= 0) {
                // Remove the destroyed ship
                newState.players[(gameState.currentPlayerIndex + 1) % 2].ships =
                    targetPlayer.ships.filter((_, index) => index !== shipIndex);
            } else {
                // Update the damaged ship
                newState.players[(gameState.currentPlayerIndex + 1) % 2].ships =
                    targetPlayer.ships.map((ship, index) => 
                        index === shipIndex ? updatedShip : ship
                    );
            }
        }

        // Check for game over
        if (newState.players[(gameState.currentPlayerIndex + 1) % 2].ships.length === 0) {
            alert(`${currentPlayer.name} wins!`);
            newState.gameStarted = false;
        } else {
            // Move to next player
            newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
        }

        setGameState(newState);
        setSelectedShip(null);
    };

    const selectShip = (ship: ShipCard) => {
        setSelectedShip(ship === selectedShip ? null : ship);
    };

    return (
        <GameContainer>
            <Controls>
                {!gameState.gameStarted ? (
                    <Button themeColors={themeColors} onClick={startGame}>Start Game</Button>
                ) : (
                    <div>
                        Current Turn: {gameState.players[gameState.currentPlayerIndex].name}
                        {selectedShip && (
                            <span> - Target: {selectedShip.name}</span>
                        )}
                    </div>
                )}
                <Button themeColors={themeColors} onClick={toggleTheme}>
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </Button>
            </Controls>
            {gameState.gameStarted && (
                <GameBoard>
                    <PlayerHand
                        player={gameState.players[(gameState.currentPlayerIndex + 1) % 2]}
                        isCurrentPlayer={false}
                        onShipClick={selectShip}
                        selectedShip={selectedShip}
                    />
                    <CenterArea>
                        <DeckArea>
                            {gameState.playDeck.length > 0 && (
                                <Card 
                                    card={{ gunSize: 11, damage: 0, faceUp: false } as SalvoCard}
                                    onClick={drawSalvo}
                                />
                            )}
                        </DeckArea>
                    </CenterArea>
                    <PlayerHand
                        player={gameState.players[gameState.currentPlayerIndex]}
                        isCurrentPlayer={true}
                        onSalvoClick={playSalvo}
                    />
                </GameBoard>
            )}
        </GameContainer>
    );
};

export default Game; 