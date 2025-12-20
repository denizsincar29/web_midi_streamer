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
            sendPingBtn: document.getElementById('sendPingBtn')
        };
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
