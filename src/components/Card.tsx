import styled from '@emotion/styled';
import { Card as CardType } from '../types/game';
import { useTheme } from '../context/ThemeContext';

const CardContainer = styled.div<{ faceUp: boolean; themeColors: any }>`
    width: 60px;
    height: 90px;
    border: 1px solid ${props => props.themeColors.cardText}33;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: ${props => props.faceUp ? props.themeColors.cardBackground : props.themeColors.buttonBackground};
    color: ${props => props.faceUp ? (props.color === 'red' ? '#d32f2f' : props.themeColors.cardText) : props.themeColors.buttonText};
    cursor: pointer;
    user-select: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s ease;

    &:hover {
        transform: translateY(-5px);
    }
`;

const Rank = styled.div`
    font-size: 1.5em;
    font-weight: bold;
`;

const Suit = styled.div`
    font-size: 1.2em;
`;

interface CardProps {
    card: CardType;
    onClick?: () => void;
}

const getSuitSymbol = (suit: string): string => {
    switch (suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
};

const Card: React.FC<CardProps> = ({ card, onClick }) => {
    const { themeColors } = useTheme();
    const suitSymbol = getSuitSymbol(card.suit);
    const color = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';

    return (
        <CardContainer 
            faceUp={card.faceUp} 
            onClick={onClick}
            color={color}
            themeColors={themeColors}
        >
            {card.faceUp ? (
                <>
                    <Rank>{card.rank}</Rank>
                    <Suit>{suitSymbol}</Suit>
                </>
            ) : (
                <div>🎴</div>
            )}
        </CardContainer>
    );
};

export default Card; 