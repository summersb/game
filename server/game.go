package main

import (
	"fmt"
	"math/rand"
	"sync"
)

type ShipCard struct {
	GunSize   float64 `json:"gunSize"`
	HitPoints int     `json:"hitPoints"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
}

type SalvoCard struct {
	GunSize float64 `json:"gunSize"`
	Damage  int     `json:"damage"`
}

type Player struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Ships           []ShipCard  `json:"ships"`
	Hand            []SalvoCard `json:"hand"`
	PlayedShips     []ShipCard  `json:"playedShips"`
	DiscardedSalvos []SalvoCard `json:"discardedSalvos"`
	DeepSixPile     []ShipCard  `json:"deepSixPile"`
}

type GameState struct {
	Players         []Player    `json:"players"`
	ShipDeck        []ShipCard  `json:"-"`
	PlayDeck        []SalvoCard `json:"-"`
	DiscardPile     []SalvoCard `json:"-"`
	CurrentPlayerId string      `json:"currentPlayerId"`
	GameStarted     bool        `json:"gameStarted"`
	mu              sync.RWMutex
}

func createShipDeck() []ShipCard {
	ships := []ShipCard{
		// Aircraft Carriers (2 cards)
		{GunSize: 14, HitPoints: 8, Name: "Aircraft Carrier", Type: "carrier"},
		{GunSize: 14, HitPoints: 8, Name: "Aircraft Carrier", Type: "carrier"},
	}

	// Add normal ships
	normalShips := []struct {
		count     int
		gunSize   float64
		hitPoints int
		name      string
	}{
		{10, 11, 3, "Light Cruiser"},
		{10, 12.6, 4, "Heavy Cruiser"},
		{12, 14, 5, "Battlecruiser"},
		{8, 15, 6, "Battleship"},
		{8, 16, 7, "Super Battleship"},
		{6, 18, 9, "Super Dreadnought"},
	}

	for _, ship := range normalShips {
		for i := 0; i < ship.count; i++ {
			ships = append(ships, ShipCard{
				GunSize:   ship.gunSize,
				HitPoints: ship.hitPoints,
				Name:      ship.name,
				Type:      "normal",
			})
		}
	}

	return shuffle(ships)
}

func createPlayDeck() []SalvoCard {
	salvos := []SalvoCard{}

	// Define salvo types
	salvoTypes := []struct {
		count     int
		gunSize   float64
		minDamage int
		maxDamage int
	}{
		{24, 11, 1, 2},   // 11-inch salvos
		{20, 12.6, 1, 2}, // 12.6-inch salvos
		{24, 14, 1, 3},   // 14-inch salvos
		{16, 15, 2, 4},   // 15-inch salvos
		{16, 16, 2, 4},   // 16-inch salvos
		{8, 18, 3, 4},    // 18-inch salvos
	}

	for _, salvo := range salvoTypes {
		for i := 0; i < salvo.count; i++ {
			damage := rand.Intn(salvo.maxDamage-salvo.minDamage+1) + salvo.minDamage
			salvos = append(salvos, SalvoCard{
				GunSize: salvo.gunSize,
				Damage:  damage,
			})
		}
	}

	return shuffle(salvos)
}

func shuffle[T any](deck []T) []T {
	shuffled := make([]T, len(deck))
	copy(shuffled, deck)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	return shuffled
}

func dealInitialHands(shipDeck []ShipCard, playDeck []SalvoCard, numPlayers int) ([]Player, []ShipCard, []SalvoCard) {
	players := make([]Player, numPlayers)
	for i := range players {
		players[i] = Player{
			ID:              fmt.Sprintf("%d", i+1),
			Name:            fmt.Sprintf("Player %d", i+1),
			Ships:           make([]ShipCard, 0),
			Hand:            make([]SalvoCard, 0),
			PlayedShips:     make([]ShipCard, 0),
			DiscardedSalvos: make([]SalvoCard, 0),
			DeepSixPile:     make([]ShipCard, 0),
		}
	}

	// Deal 5 ships to each player's battle line
	for i := 0; i < 5; i++ {
		for j := range players {
			if len(shipDeck) > 0 {
				ship := shipDeck[len(shipDeck)-1]
				players[j].PlayedShips = append(players[j].PlayedShips, ship)
				shipDeck = shipDeck[:len(shipDeck)-1]
			}
		}
	}

	// Deal 5 salvo cards to each player
	for i := 0; i < 5; i++ {
		for j := range players {
			if len(playDeck) > 0 {
				salvo := playDeck[len(playDeck)-1]
				players[j].Hand = append(players[j].Hand, salvo)
				playDeck = playDeck[:len(playDeck)-1]
			}
		}
	}

	return players, shipDeck, playDeck
} 