package main

import (
	"encoding/json"
	"fmt"
	"log"
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
	GunSize   int    `json:"gunSize"`
	HitPoints int    `json:"hitPoints"`
	Name      string `json:"name"`
	FaceUp    bool   `json:"faceUp"`
	Type      string `json:"type"`
}

type SalvoCard struct {
	GunSize int  `json:"gunSize"`
	Damage  int  `json:"damage"`
	FaceUp  bool `json:"faceUp"`
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
	// Initialize game state
	gameState.GameStarted = true
	gameState.CurrentPlayerID = "1"
	// TODO: Initialize decks and deal cards
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
	// TODO: Implement firing logic
}

func discardSalvo(salvo SalvoCard) {
	// TODO: Implement discard logic
}
