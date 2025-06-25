package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

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

type SessionInfo struct {
	ID          string `json:"id"`
	PlayerCount int    `json:"playerCount"`
	GameStarted bool   `json:"gameStarted"`
}


func handleListSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	manager.sessionsMu.RLock()
	sessionList := make([]SessionInfo, 0, len(manager.sessions))
	for _, session := range manager.sessions {
		sessionList = append(sessionList, SessionInfo{
			ID:          session.ID,
			PlayerCount: len(session.Clients),
			GameStarted: session.GameState.GameStarted,
		})
	}
	manager.sessionsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]SessionInfo{"sessions": sessionList})
}

func createNewSession(numPlayers int) *GameSession {
	session := &GameSession{
		ID:           fmt.Sprintf("%d", rand.Intn(1000000)),
		GameState:    &GameState{GameStarted: false},
		Clients:      make(map[string]*websocket.Conn),
		lastActivity: time.Now(),
    NumberOfPlayers: numPlayers,
	}
	manager.sessionsMu.Lock()
	manager.sessions[session.ID] = session
	manager.sessionsMu.Unlock()
	return session
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
