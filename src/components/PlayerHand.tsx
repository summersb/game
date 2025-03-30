import styled from '@emotion/styled';
import { Player, ShipCard, SalvoCard } from '../types/game';
import Card from './Card';
import { useTheme } from '../context/ThemeContext';

const PlayerContainer = styled.div<{ themeColors: any }>`
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
`;

const BattleArea = styled.div<{ themeColors: any }>`
    padding: 20px;
    background-color: ${props => props.themeColors.handBackground};
    border-radius: 12px;
    margin: 10px;
`;

const PlayArea = styled.div<{ themeColors: any }>`
    padding: 20px;
    background-color: ${props => props.themeColors.handBackground};
    border-radius: 12px;
    margin: 10px;
`;

const PlayerName = styled.h3<{ themeColors: any }>`
    margin: 0 0 10px 0;
    color: ${props => props.themeColors.text};
`;

const CardsContainer = styled.div`
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
`;

const Section = styled.div`
    margin: 10px 0;
`;

const SectionTitle = styled.h4<{ themeColors: any }>`
    color: ${props => props.themeColors.text};
    margin: 5px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const SubSection = styled.div`
    margin: 5px 0;
`;

const SubSectionTitle = styled.h5<{ themeColors: any }>`
    color: ${props => props.themeColors.text};
    margin: 5px 0;
    font-size: 0.9em;
`;

interface PlayerHandProps {
    player: Player;
    isCurrentPlayer: boolean;
    onShipClick?: (ship: ShipCard) => void;
    onCardClick?: (cardIndex: number) => void;
    selectedSalvo?: SalvoCard | null;
    devMode: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
    player, 
    isCurrentPlayer, 
    onShipClick,
    onCardClick,
    selectedSalvo,
    devMode 
}) => {
    const { themeColors } = useTheme();
    
    // Separate normal ships and carriers and sort by gun size
    const normalShips = player.playedShips
        .filter(ship => ship.type === 'normal')
        .sort((a, b) => b.gunSize - a.gunSize);
    const carriers = player.playedShips
        .filter(ship => ship.type === 'carrier')
        .sort((a, b) => b.gunSize - a.gunSize);
    
    // Sort deep six pile by gun size
    const sortedDeepSixPile = [...player.deepSixPile].sort((a, b) => b.gunSize - a.gunSize);
    
    // Get all unique gun sizes from deployed ships
    const deployedGunSizes = new Set(player.playedShips.map(ship => ship.gunSize));

    // Sort undeployed ships by gun size
    const sortedUndeployedShips = [...player.ships].sort((a, b) => b.gunSize - a.gunSize);

    // Only show play area if it's the current player or dev mode is on
    const showPlayArea = isCurrentPlayer || devMode;
    
    return (
        <PlayerContainer themeColors={themeColors}>
            <PlayerName themeColors={themeColors}>
                {player.name} {isCurrentPlayer ? '(Your Turn)' : ''}
                {selectedSalvo && isCurrentPlayer && (
                    <span style={{ fontSize: '0.8em', marginLeft: '10px' }}>
                        (Selected: {selectedSalvo.gunSize}" Salvo)
                    </span>
                )}
            </PlayerName>

            {/* Battle Area - Contains all deployed ships */}
            <BattleArea themeColors={themeColors}>
                <SectionTitle themeColors={themeColors}>Battle Line</SectionTitle>
                <Section>
                    <SubSectionTitle themeColors={themeColors}>Normal Ships</SubSectionTitle>
                    <CardsContainer>
                        {normalShips.map((ship, index) => (
                            <Card
                                key={`deployed-ship-${index}`}
                                card={ship}
                                onClick={() => onShipClick && !isCurrentPlayer && onShipClick(ship)}
                                disabled={isCurrentPlayer || !selectedSalvo}
                            />
                        ))}
                    </CardsContainer>
                </Section>
                <Section>
                    <SubSectionTitle themeColors={themeColors}>Aircraft Carriers</SubSectionTitle>
                    <CardsContainer>
                        {carriers.map((ship, index) => (
                            <Card
                                key={`deployed-carrier-${index}`}
                                card={ship}
                                onClick={() => {
                                    if (!isCurrentPlayer && onShipClick && normalShips.length === 0) {
                                        onShipClick(ship);
                                    } else if (!isCurrentPlayer && normalShips.length > 0) {
                                        alert("Cannot target Aircraft Carriers while other ships remain!");
                                    }
                                }}
                                disabled={isCurrentPlayer || !selectedSalvo || normalShips.length > 0}
                            />
                        ))}
                    </CardsContainer>
                </Section>
                {sortedDeepSixPile.length > 0 && (
                    <Section>
                        <SubSectionTitle themeColors={themeColors}>
                            Deep Six Pile ({sortedDeepSixPile.length} ships)
                        </SubSectionTitle>
                        <CardsContainer>
                            {sortedDeepSixPile.map((ship, index) => (
                                <Card
                                    key={`deep-six-${index}`}
                                    card={ship}
                                    disabled={true}
                                />
                            ))}
                        </CardsContainer>
                    </Section>
                )}
            </BattleArea>

            {/* Play Area - Contains salvo cards and undeployed ships */}
            {showPlayArea && (
                <PlayArea themeColors={themeColors}>
                    <SectionTitle themeColors={themeColors}>Play Cards</SectionTitle>
                    <Section>
                        <SubSectionTitle themeColors={themeColors}>Undeployed Ships</SubSectionTitle>
                        <CardsContainer>
                            {sortedUndeployedShips.map((ship, index) => (
                                <Card
                                    key={`hand-ship-${index}`}
                                    card={ship}
                                    onClick={() => {
                                        if (!isCurrentPlayer) return;
                                        onCardClick && onCardClick(player.ships.indexOf(ship));
                                    }}
                                    disabled={!isCurrentPlayer || selectedSalvo !== null}
                                />
                            ))}
                        </CardsContainer>
                    </Section>
                    <Section>
                        <SubSectionTitle themeColors={themeColors}>
                            Salvo Cards 
                            {isCurrentPlayer && (
                                <span style={{ fontSize: '0.8em', marginLeft: '10px' }}>
                                    (Must match your deployed ship gun size)
                                </span>
                            )}
                        </SubSectionTitle>
                        <CardsContainer>
                            {player.hand.sort((a, b) => b.gunSize - a.gunSize).map((salvo, index) => (
                                <Card
                                    key={`salvo-${index}`}
                                    card={salvo}
                                    disabled={!isCurrentPlayer}
                                    onClick={() => {
                                        if (!isCurrentPlayer) return;
                                        onCardClick && onCardClick(player.ships.length + index);
                                    }}
                                />
                            ))}
                        </CardsContainer>
                    </Section>
                </PlayArea>
            )}
        </PlayerContainer>
    );
};

export default PlayerHand; 