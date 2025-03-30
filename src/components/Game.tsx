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
    align-items: center;
`;

const DeckLabel = styled.div<{ themeColors: any }>`
    color: ${props => props.themeColors.text};
    font-size: 0.9em;
    text-align: center;
    margin-top: 5px;
`;

const DeckStack = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
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

const EmptyCard = styled.div<{ themeColors: any }>`
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
`;

const Game: React.FC = () => {
    const { themeColors, toggleTheme, theme } = useTheme();
    const [devMode, setDevMode] = useState(false);
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        shipDeck: [],
        playDeck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        gameStarted: false
    });

    const [selectedSalvo, setSelectedSalvo] = useState<{card: SalvoCard, index: number} | null>(null);
    const [hasDrawnCard, setHasDrawnCard] = useState(false);

    const startGame = () => {
        const shipDeck = createShipDeck();
        const playDeck = createPlayDeck();
        const { playerShips, playerHands, remainingShipDeck, remainingPlayDeck } = dealInitialHands(shipDeck, playDeck, 2);
        
        // Modify the initial setup to respect dev mode
        const players: Player[] = [
            { 
                id: '1', 
                name: 'Player 1', 
                ships: [], // Start with empty ships array
                hand: playerHands[0].map(card => ({ ...card, faceUp: devMode || card.faceUp })), 
                playedShips: playerShips[0].map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })), // Place initial ships here
                discardedSalvos: [],
                deepSixPile: []
            },
            { 
                id: '2', 
                name: 'Player 2', 
                ships: [], // Start with empty ships array
                hand: playerHands[1].map(card => ({ ...card, faceUp: devMode || card.faceUp })), 
                playedShips: playerShips[1].map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })), // Place initial ships here
                discardedSalvos: [],
                deepSixPile: []
            }
        ];

        setGameState({
            players,
            shipDeck: remainingShipDeck.map(ship => ({ ...ship, faceUp: devMode || ship.faceUp })),
            playDeck: remainingPlayDeck.map(card => ({ ...card, faceUp: devMode || card.faceUp })),
            discardPile: [],
            currentPlayerIndex: 0,
            gameStarted: true
        });
        setHasDrawnCard(false); // Initialize hasDrawnCard state
    };

    const drawSalvo = () => {
        if (gameState.playDeck.length === 0) {
            // If play deck is empty, shuffle discard pile back in
            if (gameState.discardPile.length === 0) {
                alert("No cards left to draw!");
                return;
            }
            const newState = { ...gameState };
            newState.playDeck = [...gameState.discardPile].map(card => ({ ...card, faceUp: false }));
            newState.discardPile = [];
            setGameState(newState);
        }

        const newState = { ...gameState };
        const drawnCard = newState.playDeck.pop()!;
        drawnCard.faceUp = devMode || true;

        newState.players[newState.currentPlayerIndex].hand.push(drawnCard);
        setGameState(newState);
        setHasDrawnCard(true);
    };

    const drawShip = () => {
        if (gameState.shipDeck.length === 0) return;

        const newState = { ...gameState };
        const drawnShip = newState.shipDeck.pop()!;
        drawnShip.faceUp = devMode || true; // Make ship face up in dev mode

        newState.players[newState.currentPlayerIndex].ships.push(drawnShip);
        setGameState(newState);
    };

    const selectSalvo = (salvo: SalvoCard, index: number) => {
        // For targeting, check if the salvo's gun size matches any deployed ship
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const hasMatchingShip = currentPlayer.playedShips.some(ship => ship.gunSize === salvo.gunSize);
        
        setSelectedSalvo(selectedSalvo?.card === salvo ? null : {card: salvo, index});
    };

    const discardSalvo = () => {
        if (!hasDrawnCard) {
            alert("You must draw a card at the start of your turn!");
            return;
        }

        // If discarding but no salvo selected, show message
        if (!selectedSalvo) {
            alert("Please select a salvo card to discard!");
            return;
        }

        const newState = { ...gameState };
        const currentPlayer = newState.players[newState.currentPlayerIndex];
        
        // Remove the salvo from hand and add to discard pile
        const updatedHand = [...currentPlayer.hand];
        const discardedCard = updatedHand.splice(selectedSalvo.index, 1)[0];
        
        newState.players[newState.currentPlayerIndex].hand = updatedHand;
        newState.discardPile.push(discardedCard);

        // Move to next player
        newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
        setGameState(newState);
        setSelectedSalvo(null);
        setHasDrawnCard(false);
    };

    const selectShip = (ship: ShipCard) => {
        if (!hasDrawnCard) {
            alert("You must draw a card at the start of your turn!");
            return;
        }

        if (!selectedSalvo) {
            alert("Please select a salvo card first!");
            return;
        }

        const currentPlayer1 = gameState.players[gameState.currentPlayerIndex];
        const hasMatchingShip = currentPlayer1.playedShips.some(ship => ship.gunSize === selectedSalvo.card.gunSize);
        if (!hasMatchingShip) {
            alert("You must have a ship with matching gun size to fire this salvo!");
            return;
        }

        const targetPlayer = gameState.players[(gameState.currentPlayerIndex + 1) % 2];
        const normalShips = targetPlayer.playedShips.filter(s => s.type === 'normal');

        // Only allow targeting carriers if no other ships remain
        if (ship.type === 'carrier' && normalShips.length > 0) {
            alert("Cannot target Aircraft Carriers while other ships remain!");
            return;
        }

        // Apply damage and handle the salvo card
        const newState = { ...gameState };
        const currentPlayer = newState.players[newState.currentPlayerIndex];
        
        // Remove the salvo from hand and add to discard pile
        currentPlayer.hand = currentPlayer.hand.filter((_, idx) => idx !== selectedSalvo.index);
        newState.discardPile.push(selectedSalvo.card);

        // Find and update the target ship
        const shipIndex = targetPlayer.playedShips.findIndex(s => s === ship);
        if (shipIndex !== -1) {
            const updatedShip = { ...ship };
            updatedShip.hitPoints -= selectedSalvo.card.damage;

            if (updatedShip.hitPoints <= 0) {
                // Remove the destroyed ship and add it to the current player's deep six pile
                newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips =
                    targetPlayer.playedShips.filter((_, index) => index !== shipIndex);
                // Make the sunken ship face up and add it to the deep six pile
                updatedShip.faceUp = true;
                newState.players[gameState.currentPlayerIndex].deepSixPile.push(updatedShip);
            } else {
                // Update the damaged ship
                newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips =
                    targetPlayer.playedShips.map((s, index) => 
                        index === shipIndex ? updatedShip : s
                    );
            }
        }

        // Check for game over
        const remainingShips = newState.players[(gameState.currentPlayerIndex + 1) % 2].playedShips;
        if (remainingShips.length === 0) {
            alert(`${currentPlayer.name} wins!`);
            newState.gameStarted = false;
        } else {
            // Move to next player
            newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
            setHasDrawnCard(false);
        }

        setGameState(newState);
        setSelectedSalvo(null);
    };

    const playCard = (cardIndex: number) => {
        if (!hasDrawnCard && gameState.gameStarted) {
            alert("You must draw a card at the start of your turn!");
            return;
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];

        // Check if we're playing a ship from hand
        if (cardIndex < currentPlayer.ships.length) {
            const ship = currentPlayer.ships[cardIndex];
            
            // Move ship from hand to played ships
            const newState = { ...gameState };
            newState.players[gameState.currentPlayerIndex].ships = 
                currentPlayer.ships.filter((_, index) => index !== cardIndex);
            newState.players[gameState.currentPlayerIndex].playedShips.push(ship);
            
            // Move to next player
            newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
            setGameState(newState);
            setSelectedSalvo(null);
            setHasDrawnCard(false);
            return;
        }

        // If it's a salvo card, select it
        const salvoIndex = cardIndex - currentPlayer.ships.length;
        const salvo = currentPlayer.hand[salvoIndex];
        selectSalvo(salvo, salvoIndex);
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
                    discardedSalvos: player.discardedSalvos.map(card => ({ ...card, faceUp: newDevMode || card.faceUp })),
                    deepSixPile: player.deepSixPile.map(ship => ({ ...ship, faceUp: newDevMode || ship.faceUp }))
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
                        {!hasDrawnCard && <span style={{ color: 'red' }}> - Draw a card to start your turn!</span>}
                        {selectedSalvo && (
                            <span> - Selected: {selectedSalvo.card.gunSize}" Salvo</span>
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
                        selectedSalvo={selectedSalvo?.card}
                        devMode={devMode}
                    />
                    <CenterArea>
                        <DeckArea>
                            <DeckStack>
                                {gameState.shipDeck.length > 0 && (
                                    <>
                                        <Card 
                                            card={{ 
                                                gunSize: 14, 
                                                hitPoints: 5, 
                                                name: "Ship", 
                                                faceUp: devMode,
                                                type: 'normal'
                                            } as ShipCard}
                                            onClick={drawShip}
                                        />
                                        <DeckLabel themeColors={themeColors}>
                                            Harbor ({gameState.shipDeck.length})
                                        </DeckLabel>
                                    </>
                                )}
                            </DeckStack>
                            <DeckStack>
                                {gameState.playDeck.length > 0 && (
                                    <>
                                        <Card 
                                            card={{ gunSize: 11, damage: 0, faceUp: devMode } as SalvoCard}
                                            onClick={drawSalvo}
                                            disabled={hasDrawnCard}
                                        />
                                        <DeckLabel themeColors={themeColors}>
                                            Salvos ({gameState.playDeck.length})
                                        </DeckLabel>
                                    </>
                                )}
                            </DeckStack>
                            <DeckStack>
                                {gameState.discardPile.length > 0 ? (
                                    <Card 
                                        card={gameState.discardPile[gameState.discardPile.length - 1]}
                                        onClick={discardSalvo}
                                        disabled={!hasDrawnCard}
                                    />
                                ) : (
                                    <EmptyCard 
                                        themeColors={themeColors}
                                        onClick={discardSalvo}
                                        style={{ opacity: !hasDrawnCard ? 0.5 : 1 }}
                                    >
                                        Discard
                                    </EmptyCard>
                                )}
                                <DeckLabel themeColors={themeColors}>
                                    Discard ({gameState.discardPile.length})
                                </DeckLabel>
                            </DeckStack>
                        </DeckArea>
                    </CenterArea>
                    <PlayerHand
                        player={gameState.players[gameState.currentPlayerIndex]}
                        isCurrentPlayer={true}
                        onCardClick={playCard}
                        selectedSalvo={selectedSalvo?.card}
                        devMode={devMode}
                    />
                </GameBoard>
            )}
        </GameContainer>
    );
};

export default Game; 