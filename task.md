# Task
Make a midi streamer on webrtc that allows one user to stream midi data to another user in real-time (with sysex support via checkbox).
Both users should be able to play there nord keyboards and hear each other in real-time.
To start, one user should create a room and the other user should join it.
It is done by writing ?room=roomname in the URL of both users. If the room is in use, the others are not allowed to join it.
For the slow connections, make an experimental feature that sends the midi data with a timestamp to accurately reconstruct the midi stream on the other side. This feature should be disabled by default and can be enabled via a checkbox.

# Requirements
Use what you know about WebRTC, MIDI, and JavaScript to implement the solution.
If backend is needed, use python and fastapi to implement it. If using python, use UV package manager to install dependencies. If not, do not use any backend.
The code should be modular and well-structured, with clear separation of concerns.

# Accessibility
Make aria live regions for important messages and ensure that the application is navigable using a keyboard.
If checkbox to hear midi data is checked, ensure that the user can hear the midi data being played. Use concise language for common messages: like c5 on, c5 off, etc.
