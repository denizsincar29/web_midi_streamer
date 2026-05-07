// signaler — tiny WebRTC signaling server
//
// Each client connects via WebSocket, joins a named room, and broadcasts
// JSON messages to all OTHER peers in the same room.
// That's all WebRTC needs for signaling (SDP + ICE candidates).
//
// Build:   go build -o signaler .
// Run:     ./signaler -addr :8765
// Protocol: ws://your-host:8765/signal?room=ROOMNAME&peer=PEERID

package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// ── Room registry ─────────────────────────────────────────────────────────────

type Client struct {
	id   string
	room string
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[string]*Client // room → peerID → client
}

func newHub() *Hub {
	return &Hub{rooms: make(map[string]map[string]*Client)}
}

func (h *Hub) join(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.room] == nil {
		h.rooms[c.room] = make(map[string]*Client)
	}
	h.rooms[c.room][c.id] = c
	log.Printf("join  room=%-20s peer=%s  peers_now=%d", c.room, c.id, len(h.rooms[c.room]))
}

func (h *Hub) leave(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if peers, ok := h.rooms[c.room]; ok {
		delete(peers, c.id)
		log.Printf("leave room=%-20s peer=%s  peers_now=%d", c.room, c.id, len(peers))
		if len(peers) == 0 {
			delete(h.rooms, c.room)
		}
	}
}

// broadcast sends msg to every peer in the same room EXCEPT the sender.
func (h *Hub) broadcast(sender *Client, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id, c := range h.rooms[sender.room] {
		if id == sender.id {
			continue
		}
		select {
		case c.send <- msg:
		default:
			// slow client — drop rather than block
			log.Printf("drop  peer=%s (send buffer full)", id)
		}
	}
}

// listRooms returns a JSON array of available rooms with peer counts
type RoomInfo struct {
	Name      string `json:"name"`
	PeerCount int    `json:"peerCount"`
}

func (h *Hub) listRooms() []RoomInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	rooms := make([]RoomInfo, 0, len(h.rooms))
	for name, peers := range h.rooms {
		rooms = append(rooms, RoomInfo{
			Name:      name,
			PeerCount: len(peers),
		})
	}
	return rooms
}

// ── WebSocket upgrader ────────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	// Allow all origins — restrict this in production if you like
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ── Per-client goroutines ─────────────────────────────────────────────────────

func (h *Hub) writePump(c *Client) {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("write err peer=%s: %v", c.id, err)
			return
		}
	}
}

func (h *Hub) readPump(c *Client) {
	defer func() {
		h.leave(c)
		close(c.send)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(64 * 1024) // 64 KB max message (plenty for SDP)

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure) {
				log.Printf("read err peer=%s: %v", c.id, err)
			}
			return
		}
		h.broadcast(c, msg)
	}
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

func (h *Hub) serveWS(w http.ResponseWriter, r *http.Request) {
	room := r.URL.Query().Get("room")
	peer := r.URL.Query().Get("peer")
	if room == "" || peer == "" {
		http.Error(w, "missing ?room= or ?peer=", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade err: %v", err)
		return
	}

	c := &Client{
		id:   peer,
		room: room,
		conn: conn,
		send: make(chan []byte, 32),
	}

	h.join(c)
	go h.writePump(c)
	h.readPump(c) // blocks until client disconnects
}

// ── main ──────────────────────────────────────────────────────────────────────

func main() {
	addr := flag.String("addr", ":8765", "listen address")
	flag.Parse()

	hub := newHub()

	mux := http.NewServeMux()
	mux.HandleFunc("/signal", hub.serveWS)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/rooms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rooms := hub.listRooms()
		json.NewEncoder(w).Encode(rooms)
	})

	log.Printf("signaler listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
