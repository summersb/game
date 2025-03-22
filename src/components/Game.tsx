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

// Add new styled component for dev controls
const DevControls = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;
    margin-left: 20px;
`;

const Game: React.FC = () => {
    const { themeColors, toggleTheme, theme } = useTheme();
    const [devMode, setDevMode] = useState(false);
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
        
        // Modify the initial setup to respect dev mode
        const players: Player[] = [
            { 
                id: '1', 
                name: 'Player 1', 
                ships: playerShips[0].map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })), 
                hand: playerHands[0].map(card => ({ ...card, faceUp: devMode || card.faceUp })), 
                playedShips: [], 
                discardedSalvos: [] 
            },
            { 
                id: '2', 
                name: 'Player 2', 
                ships: playerShips[1].map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })), 
                hand: playerHands[1].map(card => ({ ...card, faceUp: devMode || card.faceUp })), 
                playedShips: [], 
                discardedSalvos: [] 
            }
        ];

        setGameState({
            players,
            shipDeck: remainingShipDeck.map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })),
            playDeck: remainingPlayDeck.map(card => ({ ...card, faceUp: devMode || card.faceUp })),
            currentPlayerIndex: 0,
            gameStarted: true
        });
    };

    const drawSalvo = () => {
        if (gameState.playDeck.length === 0) return;

        const newState = { ...gameState };
        const drawnCard = newState.playDeck.pop()!;
        drawnCard.faceUp = devMode || true; // Make card face up in dev mode

        newState.players[newState.currentPlayerIndex].hand.push(drawnCard);
        setGameState(newState);
    };

    const playCard = (cardIndex: number) => {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const newState = { ...gameState };

        // Check if we're playing a ship from hand
        if (cardIndex < currentPlayer.ships.length) {
            const ship = currentPlayer.ships[cardIndex];
            
            // Move ship from hand to played ships
            newState.players[gameState.currentPlayerIndex].ships = 
                currentPlayer.ships.filter((_, index) => index !== cardIndex);
            newState.players[gameState.currentPlayerIndex].playedShips.push(ship);
            
            // Move to next player
            newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
            setGameState(newState);
            setSelectedShip(null);
            return;
        }

        // Playing a salvo card
        const salvoIndex = cardIndex - currentPlayer.ships.length;
        const salvo = currentPlayer.hand[salvoIndex];

        if (!selectedShip) {
            alert("Please select a target ship first!");
            return;
        }

        // Check if trying to target a carrier when other ships exist
        const targetPlayer = gameState.players[(gameState.currentPlayerIndex + 1) % 2];
        const normalShips = targetPlayer.playedShips.filter(s => s.type === 'normal');
        if (selectedShip.type === 'carrier' && normalShips.length > 0) {
            alert("Cannot target Aircraft Carriers while other ships remain!");
            return;
        }

        // Check if the salvo matches the selected ship's gun size
        if (salvo.gunSize !== selectedShip.gunSize) {
            alert("Salvo gun size must match the target ship's gun size!");
            return;
        }

        // Remove the salvo card from hand and add to discarded
        newState.players[gameState.currentPlayerIndex].hand = 
            currentPlayer.hand.filter((_, index) => index !== salvoIndex);
        newState.players[gameState.currentPlayerIndex].discardedSalvos.push(salvo);

        // Find the target ship in the opponent's played ships
        const shipIndex = targetPlayer.playedShips.findIndex(ship => ship === selectedShip);
        
        if (shipIndex !== -1) {
            const updatedShip = { ...selectedShip };
            updatedShip.hitPoints -= salvo.damage;

            if (updatedShip.hitPoints <= 0) {
                // Remove the destroyed ship
                newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips =
                    targetPlayer.playedShips.filter((_, index) => index !== shipIndex);
            } else {
                // Update the damaged ship
                newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips =
                    targetPlayer.playedShips.map((ship, index) => 
                        index === shipIndex ? updatedShip : ship
                    );
            }
        }

        // Check for game over - now includes checking both normal ships and carriers
        const remainingShips = newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips;
        if (remainingShips.length === 0) {
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
        const targetPlayer = gameState.players[(gameState.currentPlayerIndex + 1) % 2];
        const normalShips = targetPlayer.playedShips.filter(s => s.type === 'normal');

        // Only allow targeting carriers if no other ships remain
        if (ship.type === 'carrier' && normalShips.length > 0) {
            alert("Cannot target Aircraft Carriers while other ships remain!");
            return;
        }

        setSelectedShip(ship === selectedShip ? null : ship);
    };

    // Add function to toggle dev mode
    const toggleDevMode = () => {
        const newDevMode = !devMode;
        setDevMode(newDevMode);
        
        if (gameState.gameStarted) {
            // Update all cards' visibility when toggling dev mode
            const newState = {
                ...gameState,
                players: gameState.players.map(player => ({
                    ...player,
                    ships: player.ships.map(ship => ({ ...ship, faceUp: newDevMode || ship.faceUp })),
                    hand: player.hand.map(card => ({ ...card, faceUp: newDevMode || card.faceUp })),
                    playedShips: player.playedShips.map(ship => ({ ...ship, faceUp: newDevMode || ship.faceUp })),
                    discardedSalvos: player.discardedSalvos.map(card => ({ ...card, faceUp: newDevMode || card.faceUp }))
                })),
                shipDeck: gameState.shipDeck.map(ship => ({ ...ship, faceUp: newDevMode || ship.faceUp })),
                playDeck: gameState.playDeck.map(card => ({ ...card, faceUp: newDevMode || card.faceUp }))
            };
            setGameState(newState);
        }
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
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <DevControls>
                        <Button 
                            themeColors={themeColors} 
                            onClick={toggleDevMode}
                            style={{ backgroundColor: devMode ? themeColors.buttonHover : themeColors.buttonBackground }}
                        >
                            Dev Mode: {devMode ? 'ON' : 'OFF'}
                        </Button>
                    </DevControls>
                    <Button themeColors={themeColors} onClick={toggleTheme}>
                        Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                    </Button>
                </div>
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
                                    card={{ gunSize: 11, damage: 0, faceUp: devMode } as SalvoCard}
                                    onClick={drawSalvo}
                                />
                            )}
                        </DeckArea>
                    </CenterArea>
                    <PlayerHand
                        player={gameState.players[gameState.currentPlayerIndex]}
                        isCurrentPlayer={true}
                        onCardClick={playCard}
                    />
                </GameBoard>
            )}
        </GameContainer>
    );
};

export default Game; 