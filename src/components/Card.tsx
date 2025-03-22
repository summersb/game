import styled from '@emotion/styled';
import { ShipCard, SalvoCard } from '../types/game';
import { useTheme } from '../context/ThemeContext';

const CardContainer = styled.div<{ faceUp: boolean; themeColors: any }>`
    width: 120px;
    height: 180px;
    border: 1px solid ${props => props.themeColors.cardText}33;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    padding: 10px;
    background-color: ${props => props.faceUp ? props.themeColors.cardBackground : props.themeColors.buttonBackground};
    color: ${props => props.faceUp ? props.themeColors.cardText : props.themeColors.buttonText};
    cursor: pointer;
    user-select: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s ease;

    &:hover {
        transform: translateY(-5px);
    }
`;

const CardTitle = styled.div`
    font-size: 1.2em;
    font-weight: bold;
    text-align: center;
    margin-bottom: 10px;
`;

const CardStats = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: center;
    flex-grow: 1;
    justify-content: center;
`;

const StatLine = styled.div`
    font-size: 1em;
    display: flex;
    gap: 5px;
    align-items: center;
`;

interface CardProps {
    card: ShipCard | SalvoCard;
    onClick?: () => void;
}

const isShipCard = (card: ShipCard | SalvoCard): card is ShipCard => {
    return 'hitPoints' in card;
};

const Card: React.FC<CardProps> = ({ card, onClick }) => {
    const { themeColors } = useTheme();

    return (
        <CardContainer 
            faceUp={card.faceUp} 
            onClick={onClick}
            themeColors={themeColors}
        >
            {card.faceUp ? (
                <>
                    <CardTitle>
                        {isShipCard(card) ? card.name : 'Salvo'}
                    </CardTitle>
                    <CardStats>
                        <StatLine>
                            🎯 {card.gunSize}" guns
                        </StatLine>
                        {isShipCard(card) ? (
                            <StatLine>
                                ❤️ {card.hitPoints} HP
                            </StatLine>
                        ) : (
                            <StatLine>
                                💥 {card.damage} damage
                            </StatLine>
                        )}
                    </CardStats>
                </>
            ) : (
                <CardStats>
                    <div>{isShipCard(card) ? '🚢' : '💥'}</div>
                </CardStats>
            )}
        </CardContainer>
    );
};

export default Card; 