package main

import (
	"encoding/json"
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

type DrawSalvoMessage struct {
	ClientMessage
}

type DrawShipMessage struct {
	ClientMessage
}

type FireSalvoMessage struct {
	ClientMessage
	Salvo  SalvoCard `json:"salvo"`
	Target ShipCard  `json:"target"`
}

type DiscardSalvoMessage struct {
	ClientMessage
	Salvo SalvoCard `json:"salvo"`
}

type ServerMessage struct {
	GameState     GameState `json:"gameState"`
	ShipDeckCount int       `json:"shipDeckCount"`
	PlayDeckCount int       `json:"playDeckCount"`
	DiscardCount  int       `json:"discardCount"`
	SessionID     string    `json:"sessionId"`
	MessageType   string    `json:"messageType"`
	Error         string    `json:"error,omitempty"`
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

func dealInitialHands(shipDeck []ShipCard, playDeck []SalvoCard, session *GameSession) ([]Player, []ShipCard, []SalvoCard) {
  var numPlayers = len(session.GameState.Players)
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

func handleMessage(session *GameSession, msg ClientMessage, p []byte) {
	session.GameState.mu.Lock()
	defer session.GameState.mu.Unlock()

	fmt.Println("Received message:", msg)

	switch msg.Action {
	case "startGame":
		// Only allow starting the game if all players have joined
		if len(session.GameState.Players) < session.NumberOfPlayers {
			sendError(session.Clients[msg.PlayerID], "Waiting for all players to join")
			return
		}
		var startGameMessage StartGameMessage
		if err := json.Unmarshal(p, &startGameMessage); err != nil {
			fmt.Println("Error parsing StartGameMessage:", err)
			return
		}
		startGame(session, startGameMessage)
	case "drawSalvo":
		drawSalvo(session)
	case "drawShip":
		drawShip(session)
	case "fireSalvo":
		var fireMsg FireSalvoMessage
		if err := json.Unmarshal(p, &fireMsg); err != nil {
			fmt.Println("Error parsing FireSalvoMessage:", err)
			return
		}
		fireSalvo(session, fireMsg.Salvo, fireMsg.Target)
	case "discardSalvo":
		var discardMsg DiscardSalvoMessage
		if err := json.Unmarshal(p, &discardMsg); err != nil {
			fmt.Println("Error parsing DiscardSalvoMessage:", err)
			return
		}
		discardSalvo(session, discardMsg.Salvo)
	}
}

func drawSalvo(session *GameSession) {
	if len(session.GameState.PlayDeck) == 0 {
		if len(session.GameState.DiscardPile) == 0 {
			return
		}
		// Shuffle discard pile back into play deck
		session.GameState.PlayDeck = session.GameState.DiscardPile
		session.GameState.DiscardPile = nil
	}

	// Draw a card
	if len(session.GameState.PlayDeck) > 0 {
		card := session.GameState.PlayDeck[len(session.GameState.PlayDeck)-1]
		session.GameState.PlayDeck = session.GameState.PlayDeck[:len(session.GameState.PlayDeck)-1]

		// Add to current player's hand
		for i := range session.GameState.Players {
			if session.GameState.Players[i].ID == session.GameState.CurrentPlayerId {
				session.GameState.Players[i].Hand = append(session.GameState.Players[i].Hand, card)
				break
			}
		}
	}
}

func drawShip(session *GameSession) {
	if len(session.GameState.ShipDeck) > 0 {
		ship := session.GameState.ShipDeck[len(session.GameState.ShipDeck)-1]
		session.GameState.ShipDeck = session.GameState.ShipDeck[:len(session.GameState.ShipDeck)-1]

		// Add to current player's ships
		for i := range session.GameState.Players {
			if session.GameState.Players[i].ID == session.GameState.CurrentPlayerId {
				session.GameState.Players[i].Ships = append(session.GameState.Players[i].Ships, ship)
				break
			}
		}
	}
}

func fireSalvo(session *GameSession, salvo SalvoCard, target ShipCard) {
	// Find current player and target player
	var currentPlayer, targetPlayer *Player
	for i := range session.GameState.Players {
		if session.GameState.Players[i].ID == session.GameState.CurrentPlayerId {
			currentPlayer = &session.GameState.Players[i]
		} else {
			targetPlayer = &session.GameState.Players[i]
		}
	}

	if currentPlayer == nil || targetPlayer == nil {
		return
	}

	// Check if current player has a matching ship
	hasMatchingShip := false
	for _, ship := range currentPlayer.PlayedShips {
		if ship.GunSize == salvo.GunSize {
			hasMatchingShip = true
			break
		}
	}

	if !hasMatchingShip {
		return
	}

	// Remove salvo from current player's hand
	for i, card := range currentPlayer.Hand {
		if card.GunSize == salvo.GunSize && card.Damage == salvo.Damage {
			currentPlayer.Hand = append(currentPlayer.Hand[:i], currentPlayer.Hand[i+1:]...)
			break
		}
	}

	// Add salvo to discard pile
	session.GameState.DiscardPile = append(session.GameState.DiscardPile, salvo)

	// Find and update target ship
	for i, ship := range targetPlayer.PlayedShips {
		if ship.GunSize == target.GunSize && ship.HitPoints == target.HitPoints {
			ship.HitPoints -= salvo.Damage

			if ship.HitPoints <= 0 {
				// Remove destroyed ship and add to deep six pile
				targetPlayer.PlayedShips = append(targetPlayer.PlayedShips[:i], targetPlayer.PlayedShips[i+1:]...)
				currentPlayer.DeepSixPile = append(currentPlayer.DeepSixPile, ship)
			} else {
				// Update damaged ship
				targetPlayer.PlayedShips[i] = ship
			}
			break
		}
	}

	// Check for game over
	if len(targetPlayer.PlayedShips) == 0 {
		session.GameState.GameStarted = false
		return
	}

	// Move to next player
	if session.GameState.CurrentPlayerId == "1" {
		session.GameState.CurrentPlayerId = "2"
	} else {
		session.GameState.CurrentPlayerId = "1"
	}
}

func discardSalvo(session *GameSession, salvo SalvoCard) {
	// Find current player
	var currentPlayer *Player
	for i := range session.GameState.Players {
		if session.GameState.Players[i].ID == session.GameState.CurrentPlayerId {
			currentPlayer = &session.GameState.Players[i]
			break
		}
	}

	if currentPlayer == nil {
		return
	}

	// Remove salvo from current player's hand
	for i, card := range currentPlayer.Hand {
		if card.GunSize == salvo.GunSize && card.Damage == salvo.Damage {
			currentPlayer.Hand = append(currentPlayer.Hand[:i], currentPlayer.Hand[i+1:]...)
			break
		}
	}

	// Add salvo to discard pile
	session.GameState.DiscardPile = append(session.GameState.DiscardPile, salvo)

	// Move to next player
	if session.GameState.CurrentPlayerId == "1" {
		session.GameState.CurrentPlayerId = "2"
	} else {
		session.GameState.CurrentPlayerId = "1"
	}
}
