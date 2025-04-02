export type GunSize = 11 | 12.6 | 14 | 15 | 16 | 18
export type ShipType = 'normal' | 'carrier'

export type ShipCard = {
  gunSize: number
  hitPoints: number
  name: string
  type: 'normal' | 'carrier'
}

export type SalvoCard = {
  gunSize: GunSize
  damage: number
}

export type Player = {
  id: string
  name: string
  ships: ShipCard[]
  hand: SalvoCard[]
  playedShips: ShipCard[]
  deepSixPile: ShipCard[]
}

export type GameState = {
  players: Player[]
  currentPlayerId: string
  gameStarted: boolean
  discardPile?: SalvoCard
}
