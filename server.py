#!/usr/bin/env python3
"""
WebRTC Signaling Server for MIDI Streaming
Handles room management and WebRTC signaling between peers
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
import json
from typing import Dict, Set
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Web MIDI Streamer")

# Store active rooms: {room_name: {peer1_ws, peer2_ws}}
rooms: Dict[str, Set[WebSocket]] = {}


@app.get("/")
async def get_index():
    """Serve the main HTML page"""
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return HTMLResponse(content="<h1>index.html not found</h1>", status_code=404)


@app.get("/style.css")
async def get_css():
    """Serve the CSS file"""
    if os.path.exists("style.css"):
        return FileResponse("style.css", media_type="text/css")
    return HTMLResponse(content="/* CSS not found */", status_code=404)


@app.get("/app.js")
async def get_js():
    """Serve the JavaScript file"""
    if os.path.exists("app.js"):
        return FileResponse("app.js", media_type="application/javascript")
    return HTMLResponse(content="// JS not found", status_code=404)


@app.websocket("/ws/{room_name}")
async def websocket_endpoint(websocket: WebSocket, room_name: str):
    """
    WebSocket endpoint for WebRTC signaling
    Manages peer connections in rooms
    """
    await websocket.accept()
    
    # Check if room exists and is full
    if room_name not in rooms:
        rooms[room_name] = set()
    
    if len(rooms[room_name]) >= 2:
        await websocket.send_json({
            "type": "error",
            "message": "Room is full. Only 2 peers allowed per room."
        })
        await websocket.close()
        return
    
    # Add peer to room
    rooms[room_name].add(websocket)
    logger.info(f"Peer joined room '{room_name}'. Total peers: {len(rooms[room_name])}")
    
    # Notify peer of successful join
    await websocket.send_json({
        "type": "joined",
        "room": room_name,
        "peers": len(rooms[room_name])
    })
    
    # If this is the second peer, notify both
    if len(rooms[room_name]) == 2:
        for peer in rooms[room_name]:
            await peer.send_json({
                "type": "ready",
                "message": "Both peers connected. Ready to exchange offers."
            })
    
    try:
        while True:
            # Receive message from peer
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Forward message to other peer in the room
            for peer in rooms[room_name]:
                if peer != websocket:
                    await peer.send_text(data)
                    logger.debug(f"Forwarded message type '{message.get('type')}' in room '{room_name}'")
    
    except WebSocketDisconnect:
        logger.info(f"Peer disconnected from room '{room_name}'")
    except Exception as e:
        logger.error(f"Error in room '{room_name}': {e}")
    finally:
        # Remove peer from room
        rooms[room_name].discard(websocket)
        
        # Notify remaining peer
        for peer in rooms[room_name]:
            try:
                await peer.send_json({
                    "type": "peer_disconnected",
                    "message": "Other peer disconnected"
                })
            except Exception as e:
                logger.error(f"Error notifying peer: {e}")
        
        # Clean up empty rooms
        if len(rooms[room_name]) == 0:
            del rooms[room_name]
            logger.info(f"Room '{room_name}' deleted (empty)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
