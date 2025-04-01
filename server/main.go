package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

type GameState struct {
	Players         []Player    `json:"players"`
	ShipDeck        []ShipCard  `json:"shipDeck"`
	PlayDeck        []SalvoCard `json:"playDeck"`
	DiscardPile     []SalvoCard `json:"discardPile"`
	CurrentPlayerID string      `json:"currentPlayerId"`
	GameStarted     bool        `json:"gameStarted"`
	mu              sync.RWMutex
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

type ShipCard struct {
	GunSize   float64 `json:"gunSize"`
	HitPoints int     `json:"hitPoints"`
	Name      string  `json:"name"`
	FaceUp    bool    `json:"faceUp"`
	Type      string  `json:"type"`
}

type SalvoCard struct {
	GunSize float64 `json:"gunSize"`
	Damage  int     `json:"damage"`
	FaceUp  bool    `json:"faceUp"`
}

type ClientMessage struct {
	Action string      `json:"action"`
	Card   interface{} `json:"card,omitempty"`
	Target interface{} `json:"target,omitempty"`
}

type ServerMessage struct {
	GameState     GameState `json:"gameState"`
	ShipDeckCount int       `json:"shipDeckCount"`
	PlayDeckCount int       `json:"playDeckCount"`
	DiscardCount  int       `json:"discardCount"`
}

var gameState = &GameState{
	GameStarted: false,
}

func createShipDeck() []ShipCard {
	ships := []ShipCard{
		// Aircraft Carriers (2 cards)
		{GunSize: 14, HitPoints: 8, Name: "Aircraft Carrier", FaceUp: false, Type: "carrier"},
		{GunSize: 14, HitPoints: 8, Name: "Aircraft Carrier", FaceUp: false, Type: "carrier"},
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
				FaceUp:    false,
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
				FaceUp:  false,
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
				ship.FaceUp = true
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
				salvo.FaceUp = true
				players[j].Hand = append(players[j].Hand, salvo)
				playDeck = playDeck[:len(playDeck)-1]
			}
		}
	}

	return players, shipDeck, playDeck
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}

		var clientMsg ClientMessage
		if err := json.Unmarshal(p, &clientMsg); err != nil {
			log.Println(err)
			continue
		}

		// Handle the message
		handleMessage(clientMsg)

		// Send updated game state back to client
		serverMsg := createServerMessage()
		response, err := json.Marshal(serverMsg)
		if err != nil {
			log.Println(err)
			continue
		}

		if err := conn.WriteMessage(messageType, response); err != nil {
			log.Println(err)
			return
		}
	}
}

func handleMessage(msg ClientMessage) {
	gameState.mu.Lock()
	defer gameState.mu.Unlock()

	fmt.Println("Received message:", msg)

	switch msg.Action {
	case "startGame":
		startGame()
	case "drawSalvo":
		drawSalvo()
	case "drawShip":
		drawShip()
	case "fireSalvo":
		if card, ok := msg.Card.(SalvoCard); ok {
			if target, ok := msg.Target.(ShipCard); ok {
				fireSalvo(card, target)
			}
		}
	case "discardSalvo":
		if card, ok := msg.Card.(SalvoCard); ok {
			discardSalvo(card)
		}
	}
}

func createServerMessage() ServerMessage {
	gameState.mu.RLock()
	defer gameState.mu.RUnlock()

	return ServerMessage{
		GameState:     *gameState,
		ShipDeckCount: len(gameState.ShipDeck),
		PlayDeckCount: len(gameState.PlayDeck),
		DiscardCount:  len(gameState.DiscardPile),
	}
}

// Game logic functions
func startGame() {
	shipDeck := createShipDeck()
	playDeck := createPlayDeck()
	players, remainingShipDeck, remainingPlayDeck := dealInitialHands(shipDeck, playDeck, 2)

	gameState.Players = players
	gameState.ShipDeck = remainingShipDeck
	gameState.PlayDeck = remainingPlayDeck
	gameState.DiscardPile = make([]SalvoCard, 0)
	gameState.CurrentPlayerID = "1"
	gameState.GameStarted = true
}

func drawSalvo() {
	if len(gameState.PlayDeck) == 0 {
		if len(gameState.DiscardPile) == 0 {
			return
		}
		// Shuffle discard pile back into play deck
		gameState.PlayDeck = gameState.DiscardPile
		gameState.DiscardPile = nil
	}

	// Draw a card
	if len(gameState.PlayDeck) > 0 {
		card := gameState.PlayDeck[len(gameState.PlayDeck)-1]
		gameState.PlayDeck = gameState.PlayDeck[:len(gameState.PlayDeck)-1]

		// Add to current player's hand
		for i := range gameState.Players {
			if gameState.Players[i].ID == gameState.CurrentPlayerID {
				gameState.Players[i].Hand = append(gameState.Players[i].Hand, card)
				break
			}
		}
	}
}

func drawShip() {
	if len(gameState.ShipDeck) > 0 {
		ship := gameState.ShipDeck[len(gameState.ShipDeck)-1]
		gameState.ShipDeck = gameState.ShipDeck[:len(gameState.ShipDeck)-1]

		// Add to current player's ships
		for i := range gameState.Players {
			if gameState.Players[i].ID == gameState.CurrentPlayerID {
				gameState.Players[i].Ships = append(gameState.Players[i].Ships, ship)
				break
			}
		}
	}
}

func fireSalvo(salvo SalvoCard, target ShipCard) {
	// Find current player and target player
	var currentPlayer, targetPlayer *Player
	for i := range gameState.Players {
		if gameState.Players[i].ID == gameState.CurrentPlayerID {
			currentPlayer = &gameState.Players[i]
		} else {
			targetPlayer = &gameState.Players[i]
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
	gameState.DiscardPile = append(gameState.DiscardPile, salvo)

	// Find and update target ship
	for i, ship := range targetPlayer.PlayedShips {
		if ship.GunSize == target.GunSize && ship.HitPoints == target.HitPoints {
			ship.HitPoints -= salvo.Damage

			if ship.HitPoints <= 0 {
				// Remove destroyed ship and add to deep six pile
				targetPlayer.PlayedShips = append(targetPlayer.PlayedShips[:i], targetPlayer.PlayedShips[i+1:]...)
				ship.FaceUp = true
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
		gameState.GameStarted = false
		return
	}

	// Move to next player
	if gameState.CurrentPlayerID == "1" {
		gameState.CurrentPlayerID = "2"
	} else {
		gameState.CurrentPlayerID = "1"
	}
}

func discardSalvo(salvo SalvoCard) {
	// Find current player
	var currentPlayer *Player
	for i := range gameState.Players {
		if gameState.Players[i].ID == gameState.CurrentPlayerID {
			currentPlayer = &gameState.Players[i]
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
	gameState.DiscardPile = append(gameState.DiscardPile, salvo)

	// Move to next player
	if gameState.CurrentPlayerID == "1" {
		gameState.CurrentPlayerID = "2"
	} else {
		gameState.CurrentPlayerID = "1"
	}
}
