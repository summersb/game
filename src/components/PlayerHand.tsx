import styled from '@emotion/styled';
import { Player, ShipCard } from '../types/game';
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
`;

interface PlayerHandProps {
    player: Player;
    isCurrentPlayer: boolean;
    onShipClick?: (ship: ShipCard) => void;
    onSalvoClick?: (cardIndex: number) => void;
    selectedShip?: ShipCard | null;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
    player, 
    isCurrentPlayer, 
    onShipClick,
    onSalvoClick,
    selectedShip 
}) => {
    const { themeColors } = useTheme();
    
    return (
        <HandContainer themeColors={themeColors}>
            <PlayerName themeColors={themeColors}>
                {player.name} {isCurrentPlayer ? '(Your Turn)' : ''}
            </PlayerName>
            <Section>
                <SectionTitle themeColors={themeColors}>Ships</SectionTitle>
                <CardsContainer>
                    {player.ships.map((ship, index) => (
                        <Card
                            key={`ship-${index}`}
                            card={ship}
                            onClick={() => onShipClick && !isCurrentPlayer && onShipClick(ship)}
                        />
                    ))}
                </CardsContainer>
            </Section>
            {isCurrentPlayer && (
                <Section>
                    <SectionTitle themeColors={themeColors}>Salvos</SectionTitle>
                    <CardsContainer>
                        {player.hand.map((salvo, index) => (
                            <Card
                                key={`salvo-${index}`}
                                card={salvo}
                                onClick={() => onSalvoClick && selectedShip && onSalvoClick(index)}
                            />
                        ))}
                    </CardsContainer>
                </Section>
            )}
        </HandContainer>
    );
};

export default PlayerHand; 