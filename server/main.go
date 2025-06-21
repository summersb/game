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

type GameState struct {
	Players         []Player    `json:"players"`
	ShipDeck        []ShipCard  `json:"-"`
	PlayDeck        []SalvoCard `json:"-"`
	DiscardPile     []SalvoCard `json:"-"`
	CurrentPlayerId string      `json:"currentPlayerId"`
	GameStarted     bool        `json:"gameStarted"`
	mu              sync.RWMutex
	NumPlayers      int `json:"numPlayers"`
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
	Type      string  `json:"type"`
}

type SalvoCard struct {
	GunSize float64 `json:"gunSize"`
	Damage  int     `json:"damage"`
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
	NumPlayers int    `json:"numPlayers"`
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

var sessions = make(map[string]*GameSession)
var sessionsMu sync.RWMutex

var gameState = &GameState{
	GameStarted: false,
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
				if len(session.GameState.Players) >= session.GameState.NumPlayers {
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
		ID:        fmt.Sprintf("%d", rand.Intn(1000000)),
		GameState: &GameState{GameStarted: false, NumPlayers: numPlayers},
		Clients:   make(map[string]*websocket.Conn),
	}
	sessionsMu.Lock()
	sessions[session.ID] = session
	sessionsMu.Unlock()
	return session
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
		if len(session.GameState.Players) < session.GameState.NumPlayers {
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
	if len(session.GameState.Players) < session.GameState.NumPlayers {
		return
	}

	shipDeck := createShipDeck()
	playDeck := createPlayDeck()
	players, remainingShipDeck, remainingPlayDeck := dealInitialHands(shipDeck, playDeck, session.GameState.NumPlayers)

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
