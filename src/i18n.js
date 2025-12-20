// Internationalization (i18n) translations
export const translations = {
    en: {
        // Header
        'app.title': 'Web MIDI Streamer',
        'app.subtitle': 'Real-time MIDI streaming over WebRTC',
        
        // Status
        'status.title': 'Status:',
        'status.notConnected': 'Not connected',
        'status.enterRoomName': 'Enter Room Name',
        'status.disconnected': 'Disconnected',
        'status.waitingForPeer': 'Waiting for peer...',
        'status.connectedToPeer': 'Connected to peer',
        
        // MIDI Devices
        'midi.title': 'MIDI Devices',
        'midi.inputDevice': 'Input Device:',
        'midi.outputDevice': 'Output Device:',
        'midi.noDevice': 'No device selected',
        'midi.refreshDevices': 'Refresh Devices',
        
        // Connection
        'connection.title': 'Connection',
        'connection.roomName': 'Room Name:',
        'connection.roomPlaceholder': 'Enter room name',
        'connection.roomDescription': 'Both peers must enter the same room name to connect',
        'connection.connectBtn': 'Connect to Room',
        'connection.disconnectBtn': 'Disconnect',
        'connection.shareUrl': 'Share this URL with the other peer:',
        'connection.copyUrl': 'Copy URL',
        
        // Advanced
        'advanced.title': 'Advanced',
        'advanced.settings': 'Settings',
        'advanced.debugTools': 'Debug Tools',
        'advanced.messages': 'Messages',
        
        // Settings
        'settings.sysex': 'Enable SysEx Support',
        'settings.sysexDesc': 'Allow System Exclusive messages (required for advanced keyboard features)',
        'settings.timestamp': 'Enable Timestamp Sync (Experimental)',
        'settings.timestampDesc': 'Send MIDI data with timestamps for better timing on slow connections',
        'settings.audioFeedback': 'Enable Audio Feedback',
        'settings.audioFeedbackDesc': 'Hear announcements of MIDI events (accessibility feature)',
        'settings.midiActivity': 'Show MIDI Activity',
        'settings.midiActivityDesc': 'Display and announce MIDI events via screen reader',
        'settings.ipv6': 'Enable IPv6 P2P (Experimental)',
        'settings.ipv6Desc': 'Attempt IPv6 connections for peer-to-peer communication. If disabled, only IPv4 will be used.',
        
        // Debug Tools
        'debug.testNote': 'Send Test Note (C4)',
        'debug.ping': 'Send Ping',
        'debug.midiEcho': 'MIDI Echo (send back all received MIDI)',
        'debug.description': 'Test WebRTC data channel connectivity and MIDI echo',
        
        // Footer
        'footer.instructions': 'Instructions: Click "Connect to Room" to generate a shareable link for peer-to-peer connection',
        
        // Language selector
        'language.select': 'Language',
    },
    
    ru: {
        // Header
        'app.title': 'Web MIDI Стример',
        'app.subtitle': 'Потоковая передача MIDI в реальном времени через WebRTC',
        
        // Status
        'status.title': 'Статус:',
        'status.notConnected': 'Не подключено',
        'status.enterRoomName': 'Введите название комнаты',
        'status.disconnected': 'Отключено',
        'status.waitingForPeer': 'Ожидание пира...',
        'status.connectedToPeer': 'Подключено к пиру',
        
        // MIDI Devices
        'midi.title': 'MIDI-устройства',
        'midi.inputDevice': 'Входное устройство:',
        'midi.outputDevice': 'Выходное устройство:',
        'midi.noDevice': 'Устройство не выбрано',
        'midi.refreshDevices': 'Обновить устройства',
        
        // Connection
        'connection.title': 'Подключение',
        'connection.roomName': 'Название комнаты:',
        'connection.roomPlaceholder': 'Введите название комнаты',
        'connection.roomDescription': 'Оба пира должны ввести одинаковое название комнаты для подключения',
        'connection.connectBtn': 'Подключиться к комнате',
        'connection.disconnectBtn': 'Отключиться',
        'connection.shareUrl': 'Поделитесь этой ссылкой с другим пиром:',
        'connection.copyUrl': 'Копировать ссылку',
        
        // Advanced
        'advanced.title': 'Дополнительно',
        'advanced.settings': 'Настройки',
        'advanced.debugTools': 'Инструменты отладки',
        'advanced.messages': 'Сообщения',
        
        // Settings
        'settings.sysex': 'Включить поддержку SysEx',
        'settings.sysexDesc': 'Разрешить System Exclusive сообщения (требуется для расширенных функций клавиатуры)',
        'settings.timestamp': 'Включить синхронизацию временных меток (экспериментально)',
        'settings.timestampDesc': 'Отправлять MIDI-данные с временными метками для улучшения синхронизации при медленном соединении',
        'settings.audioFeedback': 'Включить звуковую обратную связь',
        'settings.audioFeedbackDesc': 'Слушать объявления MIDI-событий (функция доступности)',
        'settings.midiActivity': 'Показывать MIDI-активность',
        'settings.midiActivityDesc': 'Отображать и объявлять MIDI-события через программу чтения с экрана',
        'settings.ipv6': 'Включить IPv6 P2P (экспериментально)',
        'settings.ipv6Desc': 'Попытка соединения через IPv6. Если отключено, будет использоваться только IPv4.',
        
        // Debug Tools
        'debug.testNote': 'Отправить тестовую ноту (C4)',
        'debug.ping': 'Отправить пинг',
        'debug.midiEcho': 'MIDI-эхо (отправлять обратно все полученные MIDI-сообщения)',
        'debug.description': 'Тестирование подключения канала данных WebRTC и MIDI-эхо',
        
        // Footer
        'footer.instructions': 'Инструкции: Нажмите "Подключиться к комнате" для создания ссылки для одноранговой связи',
        
        // Language selector
        'language.select': 'Язык',
    }
};

// Get browser language or default to English
export function getBrowserLanguage() {
    const lang = navigator.language || navigator.userLanguage;
    if (lang.startsWith('ru')) {
        return 'ru';
    }
    return 'en';
}

// Current language (default to browser language)
let currentLanguage = localStorage.getItem('language') || getBrowserLanguage();

// Get translation for a key
export function t(key) {
    return translations[currentLanguage]?.[key] || translations['en'][key] || key;
}

// Set language and update localStorage
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        return true;
    }
    return false;
}

// Get current language
export function getCurrentLanguage() {
    return currentLanguage;
}

// Get available languages
export function getAvailableLanguages() {
    return Object.keys(translations);
}
