package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

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
	ID           string
	GameState    *GameState
  NumberOfPlayers int 
	Clients      map[string]*websocket.Conn // playerID -> connection
	mu           sync.RWMutex
	lastActivity time.Time
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

type CreateGameMessage struct {
	ClientMessage
	NumPlayers int    `json:"numberOfPlayers"`
	PlayerName string `json:"playerName"`
}

type JoinGameMessage struct {
	ClientMessage
	SessionID  string `json:"sessionId"`
	PlayerName string `json:"playerName"`
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

type SessionInfo struct {
	ID          string `json:"id"`
	PlayerCount int    `json:"playerCount"`
	GameStarted bool   `json:"gameStarted"`
}

var sessions = make(map[string]*GameSession)
var sessionsMu sync.RWMutex

var gameState = &GameState{
	GameStarted: false,
}

func main() {
	// Set up cancellable context
	ctx, cancel := context.WithCancel(context.Background())

	// Ensure cleanup on exit
	defer cancel()

	// Create HTTP server with handlers
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleWebSocket)
	mux.HandleFunc("/sessions", handleListSessions)

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	// Start the session cleanup goroutine
	cleanupInactiveSessions(ctx)

  // Channel to listen for OS signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Goroutine to handle graceful shutdown
	go func() {
		<-sigChan
		log.Println("Received shutdown signal, shutting down...")

		// Cancel context for cleanup goroutines
		cancel()

		// Create timeout context for server shutdown
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server Shutdown error: %v", err)
		}
	}()

	log.Println("Server starting on :8080")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
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
			switch clientMsg.Action {
			case "createGame":
				var createMsg CreateGameMessage
				if err := json.Unmarshal(p, &createMsg); err != nil {
					sendError(conn, "Invalid create game message")
					continue
				}
				currentSession = createNewSession(createMsg.NumPlayers)
				currentPlayerId = "1"
				// Add first player
				currentSession.GameState.Players = []Player{{
					ID:              currentPlayerId,
					Name:            createMsg.PlayerName,
					Ships:           make([]ShipCard, 0),
					Hand:            make([]SalvoCard, 0),
					PlayedShips:     make([]ShipCard, 0),
					DiscardedSalvos: make([]SalvoCard, 0),
					DeepSixPile:     make([]ShipCard, 0),
				}}
				sendGameStarted(conn, currentSession)

			case "joinGame":
				var joinMsg JoinGameMessage
				if err := json.Unmarshal(p, &joinMsg); err != nil {
					sendError(conn, "Invalid join game message")
					continue
				}
				sessionsMu.RLock()
				session, exists := sessions[joinMsg.SessionID]
				sessionsMu.RUnlock()
				if !exists {
					sendError(conn, "Game session not found")
					continue
				}
				if len(session.GameState.Players) >= session.NumberOfPlayers {
					sendError(conn, "Game is full")
					continue
				}
				currentSession = session
				currentPlayerId = fmt.Sprintf("%d", len(session.GameState.Players)+1)
				// Add new player
				session.GameState.Players = append(session.GameState.Players, Player{
					ID:              currentPlayerId,
					Name:            joinMsg.PlayerName,
					Ships:           make([]ShipCard, 0),
					Hand:            make([]SalvoCard, 0),
					PlayedShips:     make([]ShipCard, 0),
					DiscardedSalvos: make([]SalvoCard, 0),
					DeepSixPile:     make([]ShipCard, 0),
				})
				sendGameStarted(conn, currentSession)

			default:
				sendError(conn, "Invalid action")
				continue
			}
		}

		// Update session activity
		updateSessionActivity(currentSession)

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

func createNewSession(numPlayers int) *GameSession {
	session := &GameSession{
		ID:           fmt.Sprintf("%d", rand.Intn(1000000)),
		GameState:    &GameState{GameStarted: false},
		Clients:      make(map[string]*websocket.Conn),
		lastActivity: time.Now(),
    NumberOfPlayers: numPlayers,
	}
	sessionsMu.Lock()
	sessions[session.ID] = session
	sessionsMu.Unlock()
	return session
}

func updateSessionActivity(session *GameSession) {
	session.mu.Lock()
	session.lastActivity = time.Now()
	session.mu.Unlock()
}

type sessionWithID struct {
	id      string
	session *GameSession
}

func cleanupInactiveSessions(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				var inactive []sessionWithID
				sessionsMu.RLock()
				for id, session := range sessions {
					session.mu.RLock()
					if time.Since(session.lastActivity) > 5*time.Minute {
						log.Printf("Session %s inactive for %v, cleaning up", id, time.Since(session.lastActivity))
						inactive = append(inactive, sessionWithID{id, session})
					}
					session.mu.RUnlock()
				}
				sessionsMu.RUnlock()

				sessionsMu.Lock()
				for _, s := range inactive {
					s.session.mu.Lock()
					for _, client := range s.session.Clients {
						if err := client.Close(); err != nil {
							log.Printf("Error closing client in session %s: %v", s.id, err)
						}
					}
					s.session.Clients = make(map[string]*websocket.Conn)
					s.session.mu.Unlock()

					delete(sessions, s.id)
					log.Printf("Removed inactive session: %s", s.id)
				}
				sessionsMu.Unlock()
				if len(inactive) > 0 {
					log.Printf("Cleaned up %d inactive session(s)", len(inactive))
				}
			case <-ctx.Done():
				log.Println("Stopped session cleanup")
				return
			}
		}
	}()
}

func sendError(conn *websocket.Conn, errorMsg string) {
	response, _ := json.Marshal(ServerMessage{
		MessageType: "error",
		Error:       errorMsg,
	})
	conn.WriteMessage(websocket.TextMessage, response)
}

func sendGameStarted(conn *websocket.Conn, session *GameSession) {
	response, _ := json.Marshal(ServerMessage{
		MessageType: "gameStarted",
		SessionID:   session.ID,
	})
	conn.WriteMessage(websocket.TextMessage, response)
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
		// Only allow starting the game if all players have joined
		if len(session.GameState.Players) < len(session.GameState.Players) {
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

// Game logic functions
func startGame(session *GameSession, startGameMessage StartGameMessage) {
	// Only allow starting if all players have joined
	if len(session.GameState.Players) < len(session.GameState.Players) {
		return
	}

	shipDeck := createShipDeck()
	playDeck := createPlayDeck()
	players, remainingShipDeck, remainingPlayDeck := dealInitialHands(shipDeck, playDeck, session)

	// Update player names while preserving the order
	for i := range players {
		players[i].Name = session.GameState.Players[i].Name
	}

	session.GameState.Players = players
	session.GameState.ShipDeck = remainingShipDeck
	session.GameState.PlayDeck = remainingPlayDeck
	session.GameState.DiscardPile = make([]SalvoCard, 0)
	session.GameState.CurrentPlayerId = "1"
	session.GameState.GameStarted = true

	// Notify all clients that the game has started
	session.mu.RLock()
	for _, client := range session.Clients {
		sendGameStarted(client, session)
	}
	session.mu.RUnlock()
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
