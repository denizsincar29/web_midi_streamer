// signaler — tiny WebRTC signaling server with room hiding support
//
// Build:   go build -o signaler .
// Run:     ./signaler -addr :8765
// Protocol: ws://your-host:8765/signal?room=ROOMNAME&peer=PEERID
//
// Extra:  POST /hide-room?room=NAME  → marks room as hidden (not in /rooms listing)
//         POST /show-room?room=NAME  → un-hides a room

package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	id   string
	room string
	conn *websocket.Conn
	send chan []byte
}

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

type Hub struct {
	mu          sync.RWMutex
	rooms       map[string]map[string]*Client
	hiddenRooms map[string]bool
}

func newHub() *Hub {
	return &Hub{
		rooms:       make(map[string]map[string]*Client),
		hiddenRooms: make(map[string]bool),
	}
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
			delete(h.hiddenRooms, c.room) // auto-clean hidden flag
		}
	}
}

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
			log.Printf("drop  peer=%s (send buffer full)", id)
		}
	}
}

type RoomInfo struct {
	Name      string `json:"name"`
	PeerCount int    `json:"peerCount"`
	Hidden    bool   `json:"hidden,omitempty"`
}

func (h *Hub) listRooms() []RoomInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	rooms := make([]RoomInfo, 0, len(h.rooms))
	for name, peers := range h.rooms {
		if h.hiddenRooms[name] {
			continue // skip hidden rooms
		}
		rooms = append(rooms, RoomInfo{Name: name, PeerCount: len(peers)})
	}
	return rooms
}

func (h *Hub) setHidden(room string, hidden bool) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, exists := h.rooms[room]; !exists {
		return false // room doesn't exist
	}
	if hidden {
		h.hiddenRooms[room] = true
	} else {
		delete(h.hiddenRooms, room)
	}
	log.Printf("room=%-20s hidden=%v", room, hidden)
	return true
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (h *Hub) writePump(c *Client) {
	ticker := time.NewTicker(pingPeriod)
	defer func() { ticker.Stop(); c.conn.Close() }()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("write err peer=%s: %v", c.id, err)
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("ping err peer=%s: %v", c.id, err)
				return
			}
		}
	}
}

func (h *Hub) readPump(c *Client) {
	defer func() { h.leave(c); close(c.send); c.conn.Close() }()
	c.conn.SetReadLimit(64 * 1024)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("read err peer=%s: %v", c.id, err)
			}
			return
		}
		h.broadcast(c, msg)
	}
}

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
	c := &Client{id: peer, room: room, conn: conn, send: make(chan []byte, 32)}
	h.join(c)
	go h.writePump(c)
	h.readPump(c)
}

func corsJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "no-store")
}

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
		corsJSON(w)
		json.NewEncoder(w).Encode(hub.listRooms())
	})

	// POST /hide-room?room=NAME  or  POST /show-room?room=NAME
	mux.HandleFunc("/hide-room", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed); return
		}
		room := r.URL.Query().Get("room")
		if room == "" { http.Error(w, "missing ?room=", http.StatusBadRequest); return }
		corsJSON(w)
		ok := hub.setHidden(room, true)
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": ok, "room": room, "hidden": true})
	})

	mux.HandleFunc("/show-room", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed); return
		}
		room := r.URL.Query().Get("room")
		if room == "" { http.Error(w, "missing ?room=", http.StatusBadRequest); return }
		corsJSON(w)
		ok := hub.setHidden(room, false)
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": ok, "room": room, "hidden": false})
	})

	log.Printf("signaler listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
