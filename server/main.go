package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

type SessionManager struct {
	sessions   map[string]*GameSession
	sessionsMu sync.RWMutex
}

var manager = &SessionManager{
	sessions: make(map[string]*GameSession),
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

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	ctx := &SessionContext{
		Conn:          conn,
		CurrentPlayer: "",
		Session:       nil,
	}

	handleWebSocketsLoop(ctx)
}

type SessionContext struct {
	Conn          *websocket.Conn
	Session       *GameSession
	CurrentPlayer string
}

func handleWebSocketsLoop(ctx *SessionContext) {
	for {
		messageType, p, err := ctx.Conn.ReadMessage()
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

		if ctx.Session == nil {
			if err := setupSession(ctx, clientMsg, p); err != nil {
				sendError(ctx.Conn, err.Error())
				continue
			}
		}
		updateSessionActivity(ctx.Session)
    registerClient(ctx)
    processClientMessage(ctx, clientMsg, p)
		broadcastGameState(ctx, messageType)
	}
}

func processClientMessage(ctx *SessionContext, msg ClientMessage, p []byte) {
	handleMessage(ctx.Session, msg, p)
}

func registerClient(ctx *SessionContext) {
	ctx.Session.mu.Lock()
	ctx.Session.Clients[ctx.CurrentPlayer] = ctx.Conn
	ctx.Session.mu.Unlock()
}

func setupSession(ctx *SessionContext, clientMsg ClientMessage, payload []byte) error {
	switch clientMsg.Action {
	case "createGame":
		return handleCreateGame(ctx, payload)
	case "joinGame":
		return handleJoinGame(ctx, payload)
	default:
		return fmt.Errorf("invalid action")
	}
}

func handleCreateGame(ctx *SessionContext, payload []byte) error {
	var createMsg CreateGameMessage
	if err := json.Unmarshal(payload, &createMsg); err != nil {
		return fmt.Errorf("invalid create game message")
	}
  log.Printf("Create game %d", createMsg.NumPlayers)
	ctx.Session = createNewSession(createMsg.NumPlayers)
	ctx.CurrentPlayer = "1"
	ctx.Session.GameState.Players = append(ctx.Session.GameState.Players, newPlayer(ctx.CurrentPlayer, createMsg.PlayerName))
	sendGameStarted(ctx.Conn, ctx.Session)
	return nil
}

func handleJoinGame(ctx *SessionContext, payload []byte) error {
	var joinMsg JoinGameMessage
	if err := json.Unmarshal(payload, &joinMsg); err != nil {
		return fmt.Errorf("invalid join game message")
	}
	manager.sessionsMu.RLock()
	session, exists := manager.sessions[joinMsg.SessionID]
	manager.sessionsMu.RUnlock()
	if !exists {
		return fmt.Errorf("game session not found")
	}
	if len(session.GameState.Players) >= session.NumberOfPlayers {
		return fmt.Errorf("game is full")
	}
	ctx.Session = session
	ctx.CurrentPlayer = fmt.Sprintf("%d", len(session.GameState.Players)+1)
	session.GameState.Players = append(session.GameState.Players, newPlayer(ctx.CurrentPlayer, joinMsg.PlayerName))
	sendGameStarted(ctx.Conn, ctx.Session)
	return nil
}

func broadcastGameState(ctx *SessionContext, messageType int) {
	serverMsg := createServerMessage(ctx.Session, ctx.CurrentPlayer)
	fmt.Println("Server message:", serverMsg)

	response, err := json.Marshal(serverMsg)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.Session.mu.RLock()
	for id, client := range ctx.Session.Clients {
		if err := client.WriteMessage(messageType, response); err != nil {
			log.Printf("Write to client %s failed: %v", id, err)
			client.Close()
			delete(ctx.Session.Clients, id)
		}
	}
	ctx.Session.mu.RUnlock()
}

func newPlayer(id, name string) Player {
	return Player{
		ID:              id,
		Name:            name,
		Ships:           []ShipCard{},
		Hand:            []SalvoCard{},
		PlayedShips:     []ShipCard{},
		DiscardedSalvos: []SalvoCard{},
		DeepSixPile:     []ShipCard{},
	}
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
				manager.sessionsMu.RLock()
				for id, session := range manager.sessions {
					session.mu.RLock()
					if time.Since(session.lastActivity) > 5*time.Minute {
						log.Printf("Session %s inactive for %v, cleaning up", id, time.Since(session.lastActivity))
						inactive = append(inactive, sessionWithID{id, session})
					}
					session.mu.RUnlock()
				}
				manager.sessionsMu.RUnlock()

				manager.sessionsMu.Lock()
				for _, s := range inactive {
					s.session.mu.Lock()
					for _, client := range s.session.Clients {
						if err := client.Close(); err != nil {
							log.Printf("Error closing client in session %s: %v", s.id, err)
						}
					}
					s.session.Clients = make(map[string]*websocket.Conn)
					s.session.mu.Unlock()

					delete(manager.sessions, s.id)
					log.Printf("Removed inactive session: %s", s.id)
				}
				manager.sessionsMu.Unlock()
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
