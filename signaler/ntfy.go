package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// ntfyConfig holds the ntfy server config read from env vars.
// If NTFY_URL is empty, notifications are silently disabled.
type ntfyConfig struct {
	url   string // e.g. https://ntfy.sh
	topic string // e.g. jamrtc-deniz
	token string // optional Bearer token for private topics
}

var ntfy *ntfyConfig

func initNtfy() {
	url := os.Getenv("NTFY_URL")
	topic := os.Getenv("NTFY_TOPIC")
	if url == "" || topic == "" {
		log.Printf("ntfy: disabled (set NTFY_URL and NTFY_TOPIC to enable)")
		return
	}
	ntfy = &ntfyConfig{
		url:   url,
		topic: topic,
		token: os.Getenv("NTFY_TOKEN"),
	}
	log.Printf("ntfy: enabled → %s/%s", ntfy.url, ntfy.topic)
}

// notify sends a notification in a goroutine — never blocks the caller.
func notify(title, message, priority string, tags ...string) {
	if ntfy == nil {
		return
	}
	go func() {
		endpoint := fmt.Sprintf("%s/%s", ntfy.url, ntfy.topic)
		req, err := http.NewRequest("POST", endpoint, bytes.NewBufferString(message))
		if err != nil {
			log.Printf("ntfy: build request error: %v", err)
			return
		}
		req.Header.Set("Title", title)
		if priority != "" {
			req.Header.Set("Priority", priority)
		}
		if len(tags) > 0 {
			tagStr := ""
			for i, t := range tags {
				if i > 0 {
					tagStr += ","
				}
				tagStr += t
			}
			req.Header.Set("Tags", tagStr)
		}
		if ntfy.token != "" {
			req.Header.Set("Authorization", "Bearer "+ntfy.token)
		}
		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("ntfy: send error: %v", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("ntfy: server returned %d", resp.StatusCode)
		}
	}()
}
