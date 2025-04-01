export type GunSize = 11 | 12.6 | 14 | 15 | 16 | 18
export type ShipType = 'normal' | 'carrier'

export type ShipCard = {
  gunSize: number
  hitPoints: number
  name: string
  faceUp: boolean
  type: 'normal' | 'carrier'
}

export type SalvoCard = {
  gunSize: number
  damage: number
  faceUp: boolean
}

export type Player = {
  id: string
  name: string
  ships: ShipCard[]
  hand: SalvoCard[]
  playedShips: ShipCard[]
  discardedSalvos: SalvoCard[]
  deepSixPile: ShipCard[]
}

export type GameState = {
  players: Player[]
  shipDeck: ShipCard[]
  playDeck: SalvoCard[]
  discardPile: SalvoCard[]
  currentPlayerID: string
  gameStarted: boolean
}

export const createShipDeck = (): ShipCard[] => {
  const ships: ShipCard[] = [
    // Aircraft Carriers (2 cards)
    ...Array(2)
      .fill(null)
      .map(() => ({
        gunSize: 14 as GunSize,
        hitPoints: 8,
        name: 'Aircraft Carrier',
        faceUp: false,
        type: 'carrier' as ShipType,
      })),
    // 11-inch gun ships (10 cards)
    ...Array(10)
      .fill(null)
      .map(() => ({
        gunSize: 11 as GunSize,
        hitPoints: 3,
        name: 'Light Cruiser',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
    // 12.6-inch gun ships (10 cards)
    ...Array(10)
      .fill(null)
      .map(() => ({
        gunSize: 12.6 as GunSize,
        hitPoints: 4,
        name: 'Heavy Cruiser',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
    // 14-inch gun ships (12 cards)
    ...Array(12)
      .fill(null)
      .map(() => ({
        gunSize: 14 as GunSize,
        hitPoints: 5,
        name: 'Battlecruiser',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
    // 15-inch gun ships (8 cards)
    ...Array(8)
      .fill(null)
      .map(() => ({
        gunSize: 15 as GunSize,
        hitPoints: 6,
        name: 'Battleship',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
    // 16-inch gun ships (8 cards)
    ...Array(8)
      .fill(null)
      .map(() => ({
        gunSize: 16 as GunSize,
        hitPoints: 7,
        name: 'Super Battleship',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
    // 18-inch gun ships (6 cards)
    ...Array(6)
      .fill(null)
      .map(() => ({
        gunSize: 18 as GunSize,
        hitPoints: 9,
        name: 'Super Dreadnought',
        faceUp: false,
        type: 'normal' as ShipType,
      })),
  ]

  return shuffle(ships)
}

export const createPlayDeck = (): SalvoCard[] => {
  const salvos: SalvoCard[] = [
    // 11-inch salvos (24 cards)
    ...Array(24)
      .fill(null)
      .map(() => ({ gunSize: 11 as GunSize, damage: Math.floor(Math.random() * 2) + 1, faceUp: false })),
    // 12.6-inch salvos (20 cards)
    ...Array(20)
      .fill(null)
      .map(() => ({ gunSize: 12.6 as GunSize, damage: Math.floor(Math.random() * 2) + 1, faceUp: false })),
    // 14-inch salvos (24 cards)
    ...Array(24)
      .fill(null)
      .map(() => ({ gunSize: 14 as GunSize, damage: Math.floor(Math.random() * 3) + 1, faceUp: false })),
    // 15-inch salvos (16 cards)
    ...Array(16)
      .fill(null)
      .map(() => ({ gunSize: 15 as GunSize, damage: Math.floor(Math.random() * 3) + 2, faceUp: false })),
    // 16-inch salvos (16 cards)
    ...Array(16)
      .fill(null)
      .map(() => ({ gunSize: 16 as GunSize, damage: Math.floor(Math.random() * 3) + 2, faceUp: false })),
    // 18-inch salvos (8 cards)
    ...Array(8)
      .fill(null)
      .map(() => ({ gunSize: 18 as GunSize, damage: Math.floor(Math.random() * 2) + 3, faceUp: false })),
  ]

  return shuffle(salvos)
}

export const shuffle = <T>(deck: T[]): T[] => {
  const newDeck = [...deck]
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
  }
  return newDeck
}

export const dealInitialHands = (
  shipDeck: ShipCard[],
  playDeck: SalvoCard[],
  numPlayers: number
): {
  playerShips: ShipCard[][]
  playerHands: SalvoCard[][]
  remainingShipDeck: ShipCard[]
  remainingPlayDeck: SalvoCard[]
} => {
  const playerShips: ShipCard[][] = Array(numPlayers)
    .fill([])
    .map(() => [])
  const playerPlayedShips: ShipCard[][] = Array(numPlayers)
    .fill([])
    .map(() => [])
  const playerHands: SalvoCard[][] = Array(numPlayers)
    .fill([])
    .map(() => [])
  const remainingShipDeck = [...shipDeck]
  const remainingPlayDeck = [...playDeck]

  // Deal 5 ships to each player's battle line
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < numPlayers; j++) {
      if (remainingShipDeck.length > 0) {
        const ship = remainingShipDeck.pop()!
        playerPlayedShips[j] = [...playerPlayedShips[j], { ...ship, faceUp: true }]
      }
    }
  }

  // Deal 5 salvo cards to each player
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < numPlayers; j++) {
      if (remainingPlayDeck.length > 0) {
        const salvo = remainingPlayDeck.pop()!
        playerHands[j] = [...playerHands[j], { ...salvo, faceUp: true }]
      }
    }
  }

  return {
    playerShips: playerPlayedShips, // Return played ships instead of unplayed ships
    playerHands,
    remainingShipDeck,
    remainingPlayDeck,
  }
}
