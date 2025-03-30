import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { GameState, Player, ShipCard, SalvoCard, createShipDeck, createPlayDeck, dealInitialHands } from '../types/game';
import PlayerHand from './PlayerHand';
import Card from './Card';
import { useTheme } from '../context/ThemeContext';
import { wsService, ServerMessage } from '../services/websocket';

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
    const [deckCounts, setDeckCounts] = useState({
        shipDeck: 0,
        playDeck: 0,
        discardPile: 0
    });

    useEffect(() => {
        wsService.connect();
        const handleMessage = (message: ServerMessage) => {
            setGameState(message.gameState);
            setDeckCounts({
                shipDeck: message.shipDeckCount,
                playDeck: message.playDeckCount,
                discardPile: message.discardCount
            });
        };

        wsService.addMessageHandler(handleMessage);
        return () => {
            wsService.removeMessageHandler(handleMessage);
            wsService.disconnect();
        };
    }, []);

    const startGame = () => {
        wsService.sendMessage({ action: 'startGame' });
    };

    const drawSalvo = () => {
        wsService.sendMessage({ action: 'drawSalvo' });
        setHasDrawnCard(true);
    };

    const drawShip = () => {
        wsService.sendMessage({ action: 'drawShip' });
    };

    const selectSalvo = (salvo: SalvoCard, index: number) => {
        setSelectedSalvo(selectedSalvo?.card === salvo ? null : {card: salvo, index});
    };

    const discardSalvo = () => {
        if (!hasDrawnCard) {
            alert("You must draw a card at the start of your turn!");
            return;
        }

        if (!selectedSalvo) {
            alert("Please select a salvo card to discard!");
            return;
        }

        wsService.sendMessage({
            action: 'discardSalvo',
            card: selectedSalvo.card
        });

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

        wsService.sendMessage({
            action: 'fireSalvo',
            card: selectedSalvo.card,
            target: ship
        });

        setSelectedSalvo(null);
        setHasDrawnCard(false);
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
            // Ship playing will be handled by the server
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
                                            Harbor ({deckCounts.shipDeck})
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
                                            Salvos ({deckCounts.playDeck})
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
                                    Discard ({deckCounts.discardPile})
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