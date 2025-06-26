import styled from '@emotion/styled'
import { ShipCard, SalvoCard } from '../types/game'
import { ThemeColors } from '../types/theme'
import { useTheme } from '../context/useTheme'
import React from 'react'

const CardContainer = styled.div<{ themeColors: ThemeColors; disabled?: boolean }>`
  width: 120px;
  height: 180px;
  border: 1px solid ${props => props.themeColors.cardText}33;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 10px;
  background-color: ${props => {
    if (props.disabled) return props.themeColors.handBackground
    return props.themeColors.cardBackground
  }};
  color: ${props => {
    if (props.disabled) return props.themeColors.cardText + '66'
    return props.themeColors.cardText
  }};
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  opacity: ${props => (props.disabled ? 0.6 : 1)};

  &:hover {
    transform: ${props => (props.disabled ? 'none' : 'translateY(-5px)')};
  }
`

const CardTitle = styled.div`
  font-size: 1.2em;
  font-weight: bold;
  text-align: center;
  margin-bottom: 10px;
`

const CardStats = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;
  flex-grow: 1;
  justify-content: center;
`

const StatLine = styled.div`
  font-size: 1em;
  display: flex;
  gap: 5px;
  align-items: center;
`

interface CardProps {
  card?: ShipCard | SalvoCard
  type: 'ship' | 'salvo'
  onClick?: () => void
  disabled?: boolean
}

const isShipCard = (card: ShipCard | SalvoCard): card is ShipCard => {
  return 'hitPoints' in card
}

const Card: React.FC<CardProps> = ({ card, type, onClick, disabled }: CardProps) => {
  const { themeColors } = useTheme()

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  return (
    <CardContainer onClick={handleClick} themeColors={themeColors} disabled={disabled}>
      {!card && (
        <CardStats>
          <div>{type === 'ship' ? '🚢' : '💥'}</div>
        </CardStats>
      )}
      {card && (
        <>
          <CardTitle>{isShipCard(card) ? card.name : 'Salvo'}</CardTitle>
          <CardStats>
            <StatLine>🎯 {card?.gunSize}" guns</StatLine>
            {isShipCard(card) ? (
              <StatLine>❤️ {card?.hitPoints} HP</StatLine>
            ) : (
              <StatLine>💥 {card?.damage} damage</StatLine>
            )}
          </CardStats>
        </>
      )}
    </CardContainer>
  )
}

export default Card
