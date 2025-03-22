import styled from '@emotion/styled';
import { Player, ShipCard, SalvoCard } from '../types/game';
import Card from './Card';
import { useTheme } from '../context/ThemeContext';

const HandContainer = styled.div<{ themeColors: any }>`
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
    selectedShip?: ShipCard | null;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
    player, 
    isCurrentPlayer, 
    onShipClick,
    onCardClick,
    selectedShip 
}) => {
    const { themeColors } = useTheme();
    
    // Separate normal ships and carriers
    const normalShips = player.playedShips.filter(ship => ship.type === 'normal');
    const carriers = player.playedShips.filter(ship => ship.type === 'carrier');
    const normalShipsInHand = player.ships.filter(ship => ship.type === 'normal');
    const carriersInHand = player.ships.filter(ship => ship.type === 'carrier');
    
    return (
        <HandContainer themeColors={themeColors}>
            <PlayerName themeColors={themeColors}>
                {player.name} {isCurrentPlayer ? '(Your Turn)' : ''}
            </PlayerName>
            <Section>
                <SectionTitle themeColors={themeColors}>
                    Battle Line Ships
                </SectionTitle>
                <SubSection>
                    <SubSectionTitle themeColors={themeColors}>In Hand</SubSectionTitle>
                    <CardsContainer>
                        {normalShipsInHand.map((ship, index) => (
                            <Card
                                key={`hand-ship-${index}`}
                                card={ship}
                                onClick={() => {
                                    if (!isCurrentPlayer) return;
                                    onCardClick && onCardClick(player.ships.indexOf(ship));
                                }}
                            />
                        ))}
                    </CardsContainer>
                </SubSection>
                <SubSection>
                    <SubSectionTitle themeColors={themeColors}>Deployed</SubSectionTitle>
                    <CardsContainer>
                        {normalShips.map((ship, index) => (
                            <Card
                                key={`deployed-ship-${index}`}
                                card={ship}
                                onClick={() => onShipClick && !isCurrentPlayer && onShipClick(ship)}
                            />
                        ))}
                    </CardsContainer>
                </SubSection>
            </Section>
            <Section>
                <SectionTitle themeColors={themeColors}>
                    Aircraft Carriers
                </SectionTitle>
                <SubSection>
                    <SubSectionTitle themeColors={themeColors}>In Hand</SubSectionTitle>
                    <CardsContainer>
                        {carriersInHand.map((ship, index) => (
                            <Card
                                key={`hand-carrier-${index}`}
                                card={ship}
                                onClick={() => {
                                    if (!isCurrentPlayer) return;
                                    onCardClick && onCardClick(player.ships.indexOf(ship));
                                }}
                            />
                        ))}
                    </CardsContainer>
                </SubSection>
                <SubSection>
                    <SubSectionTitle themeColors={themeColors}>Deployed</SubSectionTitle>
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
                            />
                        ))}
                    </CardsContainer>
                </SubSection>
            </Section>
            <Section>
                <SectionTitle themeColors={themeColors}>Salvos</SectionTitle>
                <CardsContainer>
                    {player.hand.map((salvo, index) => (
                        <Card
                            key={`salvo-${index}`}
                            card={salvo}
                            onClick={() => {
                                if (!isCurrentPlayer) return;
                                if (!selectedShip && onCardClick) {
                                    alert("Please select a target ship first!");
                                    return;
                                }
                                onCardClick && onCardClick(player.ships.length + index);
                            }}
                        />
                    ))}
                </CardsContainer>
            </Section>
        </HandContainer>
    );
};

export default PlayerHand; 