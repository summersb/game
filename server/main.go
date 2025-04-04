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

type GameSession struct {
	ID        string
	GameState *GameState
	Clients   map[string]*websocket.Conn // playerID -> connection
	mu        sync.RWMutex
}

type ClientMessage struct {
	Action    string `json:"action"`
	SessionID string `json:"sessionId,omitempty"`
	PlayerID  string `json:"playerId,omitempty"`
}

// Specific message types
type StartGameMessage struct {
	ClientMessage
	NumPlayers int `json:"numPlayers"`
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
}

type SessionInfo struct {
	ID           string `json:"id"`
	PlayerCount  int    `json:"playerCount"`
	GameStarted  bool   `json:"gameStarted"`
}

var sessions = make(map[string]*GameSession)
var sessionsMu sync.RWMutex

var gameState = &GameState{
	GameStarted: false,
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/sessions", handleListSessions)
	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleListSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionsMu.RLock()
	sessionList := make([]SessionInfo, 0, len(sessions))
	for _, session := range sessions {
		sessionList = append(sessionList, SessionInfo{
			ID:          session.ID,
			PlayerCount: len(session.Clients),
			GameStarted: session.GameState.GameStarted,
		})
	}
	sessionsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]SessionInfo{"sessions": sessionList})
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	var currentSession *GameSession
	var currentPlayerId string

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

		fmt.Println("Client message:", clientMsg)

		// Handle session management
		if currentSession == nil {
			if clientMsg.SessionID == "" {
				// Create new session
				currentSession = createNewSession()
				currentPlayerId = "1"
			} else {
				// Join existing session
				sessionsMu.RLock()
				session, exists := sessions[clientMsg.SessionID]
				sessionsMu.RUnlock()
				if !exists {
					log.Println("Session not found:", clientMsg.SessionID)
					continue
				}
				currentSession = session
				currentPlayerId = clientMsg.PlayerID
			}
		}

		// Register client connection
		currentSession.mu.Lock()
		currentSession.Clients[currentPlayerId] = conn
		currentSession.mu.Unlock()

		// Handle the message
		handleMessage(currentSession, clientMsg, p)

		// Send updated game state back to all clients in the session
		serverMsg := createServerMessage(currentSession, currentPlayerId)

		// Output the formatted JSON
		fmt.Println("Server message:", serverMsg)

		response, err := json.Marshal(serverMsg)
		if err != nil {
			log.Println(err)
			continue
		}

		// Broadcast to all clients in the session
		currentSession.mu.RLock()
		for _, client := range currentSession.Clients {
			if err := client.WriteMessage(messageType, response); err != nil {
				log.Println(err)
				client.Close()
				delete(currentSession.Clients, currentPlayerId)
			}
		}
		currentSession.mu.RUnlock()
	}
}

func createNewSession() *GameSession {
	session := &GameSession{
		ID:        fmt.Sprintf("%d", rand.Intn(1000000)),
		GameState: &GameState{GameStarted: false},
		Clients:   make(map[string]*websocket.Conn),
	}
	sessionsMu.Lock()
	sessions[session.ID] = session
	sessionsMu.Unlock()
	return session
}

func createServerMessage(session *GameSession, playerID string) ServerMessage {
	session.GameState.mu.RLock()
	defer session.GameState.mu.RUnlock()

	// Create a filtered game state for the client
	filteredState := GameState{
		CurrentPlayerId: session.GameState.CurrentPlayerId,
		GameStarted:     session.GameState.GameStarted,
		Players:         make([]Player, len(session.GameState.Players)),
	}

	// Copy player information with appropriate filtering
	for i, player := range session.GameState.Players {
		filteredState.Players[i] = Player{
			ID:              player.ID,
			Name:            player.Name,
			PlayedShips:     player.PlayedShips,
			DiscardedSalvos: player.DiscardedSalvos,
			DeepSixPile:     player.DeepSixPile,
		}

		// Only include hand and ships for the current player
		if player.ID == playerID {
			filteredState.Players[i].Hand = player.Hand
			filteredState.Players[i].Ships = player.Ships
		}
	}

	return ServerMessage{
		GameState:     filteredState,
		ShipDeckCount: len(session.GameState.ShipDeck),
		PlayDeckCount: len(session.GameState.PlayDeck),
		DiscardCount:  len(session.GameState.DiscardPile),
		SessionID:     session.ID,
	}
}

func handleMessage(session *GameSession, msg ClientMessage, p []byte) {
	session.GameState.mu.Lock()
	defer session.GameState.mu.Unlock()

	fmt.Println("Received message:", msg)

	switch msg.Action {
	case "startGame":
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

// Game logic functions
func startGame(session *GameSession, startGameMessage StartGameMessage) {
	shipDeck := createShipDeck()
	playDeck := createPlayDeck()
	players, remainingShipDeck, remainingPlayDeck := dealInitialHands(shipDeck, playDeck, startGameMessage.NumPlayers)

	session.GameState.Players = players
	session.GameState.ShipDeck = remainingShipDeck
	session.GameState.PlayDeck = remainingPlayDeck
	session.GameState.DiscardPile = make([]SalvoCard, 0)
	session.GameState.CurrentPlayerId = "1"
	session.GameState.GameStarted = true
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
