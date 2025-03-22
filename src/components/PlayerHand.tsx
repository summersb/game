import styled from '@emotion/styled';
import { Player } from '../types/game';
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

interface PlayerHandProps {
    player: Player;
    isCurrentPlayer: boolean;
    onCardClick?: (cardIndex: number) => void;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ player, isCurrentPlayer, onCardClick }) => {
    const { themeColors } = useTheme();
    
    return (
        <HandContainer themeColors={themeColors}>
            <PlayerName themeColors={themeColors}>
                {player.name} {isCurrentPlayer ? '(Your Turn)' : ''}
            </PlayerName>
            <CardsContainer>
                {player.hand.map((card, index) => (
                    <Card
                        key={`${card.suit}-${card.rank}-${index}`}
                        card={card}
                        onClick={() => onCardClick && onCardClick(index)}
                    />
                ))}
            </CardsContainer>
        </HandContainer>
    );
};

export default PlayerHand; 