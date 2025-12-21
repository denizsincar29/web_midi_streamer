import { t } from './i18n.js';

export class UIManager {
    constructor(midiManager = null) {
        this.midiManager = midiManager;
        this.elements = {
            roomName: document.getElementById('roomName'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusBar: document.getElementById('statusBar'),
            midiActivity: document.getElementById('midiActivity'),
            messageLog: document.getElementById('messageLog'),
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            sendTestNoteBtn: document.getElementById('sendTestNoteBtn'),
            sendPingBtn: document.getElementById('sendPingBtn'),
            copyMessagesBtn: document.getElementById('copyMessagesBtn'),
            chatLog: document.getElementById('chatLog'),
            chatInput: document.getElementById('chatInput'),
            sendChatBtn: document.getElementById('sendChatBtn')
        };
        this.onSendChat = null;
        this.setupChatListeners();
        this.setupCopyMessagesListener();
    }

    setupChatListeners() {
        if (this.elements.sendChatBtn) {
            this.elements.sendChatBtn.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }
        
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
    }

    setupCopyMessagesListener() {
        if (this.elements.copyMessagesBtn) {
            this.elements.copyMessagesBtn.addEventListener('click', () => {
                this.copyAllMessages();
            });
        }
    }

    sendChatMessage() {
        const message = this.elements.chatInput.value.trim();
        if (message && this.onSendChat) {
            this.onSendChat(message);
            this.elements.chatInput.value = '';
        }
    }

    addChatMessage(message, sender = 'peer') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender === 'you' ? 'sent' : 'received'}`;
        
        const senderSpan = document.createElement('div');
        senderSpan.className = 'chat-message-sender';
        senderSpan.textContent = sender === 'you' ? t('chat.you') : t('chat.peer');
        
        const textSpan = document.createElement('div');
        textSpan.className = 'chat-message-text';
        textSpan.textContent = message;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'chat-message-time';
        timeSpan.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(textSpan);
        messageDiv.appendChild(timeSpan);
        
        this.elements.chatLog.appendChild(messageDiv);
        this.elements.chatLog.scrollTop = this.elements.chatLog.scrollHeight;
    }

    copyAllMessages() {
        const messages = this.elements.messageLog.querySelectorAll('.message');
        let text = 'Web MIDI Streamer - Debug Messages\n';
        text += '=' .repeat(50) + '\n\n';
        
        messages.forEach(msg => {
            const timestamp = msg.querySelector('.message-timestamp')?.textContent || '';
            const messageText = msg.querySelector('.message-text')?.textContent || '';
            text += `${timestamp}${messageText}\n`;
        });
        
        text += '\n' + '='.repeat(50);
        text += '\nCopied at: ' + new Date().toLocaleString();
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.addMessage('✓ All messages copied to clipboard', 'success');
            }).catch((err) => {
                this.addMessage('Failed to copy messages: ' + err.message, 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.addMessage('✓ All messages copied to clipboard', 'success');
            } catch (err) {
                this.addMessage('Failed to copy messages: ' + err.message, 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    enableChat(enabled) {
        if (this.elements.chatInput) {
            this.elements.chatInput.disabled = !enabled;
        }
        if (this.elements.sendChatBtn) {
            this.elements.sendChatBtn.disabled = !enabled;
        }
    }

    setMIDIManager(midiManager) {
        this.midiManager = midiManager;
    }

    updateConnectionStatus(status, state = 'disconnected') {
        this.elements.connectionStatus.textContent = status;
        this.elements.statusIndicator.className = 'status-indicator';
        if (state !== 'disconnected') {
            this.elements.statusIndicator.classList.add(state);
        }
        this.elements.statusBar.textContent = `Connection status: ${status}`;
        
        // Play chime for connection status changes
        if (this.midiManager) {
            if (state === 'connected') {
                this.midiManager.playStatusChime('success');
            } else if (state === 'connecting') {
                this.midiManager.playStatusChime('connecting');
            }
        }
    }

    updateRoomName(text) {
        this.elements.roomName.textContent = text;
    }

    updateButtonStates(connected, debugEnabled = false) {
        this.elements.connectBtn.disabled = connected;
        this.elements.disconnectBtn.disabled = !connected;
        this.elements.sendTestNoteBtn.disabled = !debugEnabled;
        this.elements.sendPingBtn.disabled = !debugEnabled;
    }

    addMessage(text, type = 'info', announce = null) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'message-timestamp';
        timestampSpan.setAttribute('aria-hidden', 'true');
        timestampSpan.textContent = `[${timestamp}] `;
        
        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';
        textSpan.textContent = text;
        
        message.appendChild(timestampSpan);
        message.appendChild(textSpan);
        
        const isConnectionMessage = type === 'success' && (
            text.includes('Connected') || 
            text.includes('connection') ||
            text.includes('Data channel open')
        );
        
        const shouldAnnounce = announce !== null ? announce : (
            type === 'error' || 
            type === 'warning' || 
            isConnectionMessage
        );
        
        if (!shouldAnnounce) {
            message.setAttribute('aria-live', 'off');
        }
        
        // Play MIDI chime for important status messages
        if (this.midiManager && shouldAnnounce) {
            this.midiManager.playStatusChime(type);
        }
        
        this.elements.messageLog.appendChild(message);
        this.elements.messageLog.scrollTop = this.elements.messageLog.scrollHeight;
        
        while (this.elements.messageLog.children.length > 50) {
            this.elements.messageLog.removeChild(this.elements.messageLog.firstChild);
        }
    }

    displayShareableUrl(url, onCopy) {
        let shareSection = document.getElementById('shareUrlSection');
        if (!shareSection) {
            shareSection = document.createElement('div');
            shareSection.id = 'shareUrlSection';
            shareSection.className = 'share-url-section';
            
            const label = document.createElement('p');
            label.textContent = t('connection.shareUrl');
            shareSection.appendChild(label);
            
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.id = 'shareUrl';
            urlInput.readOnly = true;
            urlInput.className = 'share-url-input';
            shareSection.appendChild(urlInput);
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = t('connection.copyUrl');
            copyBtn.className = 'btn btn-secondary';
            copyBtn.onclick = () => {
                if (onCopy) {
                    onCopy(urlInput.value);
                }
            };
            shareSection.appendChild(copyBtn);
            
            const roomInfo = document.querySelector('.room-info');
            roomInfo.parentNode.insertBefore(shareSection, roomInfo.nextSibling);
        }
        
        const urlInput = document.getElementById('shareUrl');
        urlInput.value = url;
        
        // Focus the URL input for screen readers
        setTimeout(() => {
            urlInput.focus();
            urlInput.select();
        }, 100);
    }

    toggleMidiActivity(enabled) {
        const midiActivity = this.elements.midiActivity;
        if (enabled) {
            midiActivity.setAttribute('aria-live', 'assertive');
            midiActivity.classList.remove('sr-only');
        } else {
            midiActivity.setAttribute('aria-live', 'off');
            midiActivity.classList.add('sr-only');
            midiActivity.textContent = '';
        }
    }
}
