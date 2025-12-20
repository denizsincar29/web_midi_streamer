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
        
        // Settings (formerly Advanced)
        'settings.title': 'Settings',
        'settings.settings': 'Settings',
        'settings.debugTools': 'Debug Tools',
        'settings.messages': 'Messages',
        
        // Settings options
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
        'settings.language': 'Language',
        
        // Debug Tools
        'debug.testNote': 'Send Test Note (C4)',
        'debug.ping': 'Send Ping',
        'debug.midiEcho': 'MIDI Echo (send back all received MIDI)',
        'debug.description': 'Test WebRTC data channel connectivity and MIDI echo',
        
        // Footer
        'footer.help': 'Help',
        
        // Language selector
        'language.select': 'Language',
        
        // Help/Instructions
        'help.title': 'How to Use Web MIDI Streamer',
        'help.close': 'Close',
        'help.step1Title': '1. Connect Your MIDI Keyboard First',
        'help.step1': 'IMPORTANT: Connect your MIDI keyboard or controller to your computer BEFORE opening this website or clicking any connection buttons. This prevents the need to refresh the page.',
        'help.step2Title': '2. Open the Website',
        'help.step2': 'After connecting your MIDI device, open the website or reload if you already had it open.',
        'help.step3Title': '3. Select MIDI Devices',
        'help.step3': 'Choose your MIDI input device (the keyboard you play) and output device (where you hear the remote peer\'s notes).',
        'help.step4Title': '4. Create or Join a Room',
        'help.step4': 'Enter a room name and click "Connect to Room". You can save this URL with the room name to use the same room with the same people every time.',
        'help.step5Title': '5. Share the URL',
        'help.step5': 'Copy and share the generated URL with your peer. They should open it to connect automatically.',
        'help.step6Title': '6. Start Playing',
        'help.step6': 'Once connected, you can play your MIDI keyboard and hear each other in real-time!',
        'help.tipTitle': '💡 Tip',
        'help.tip': 'You can bookmark the URL with your room name to quickly reconnect with the same people next time.',
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
        
        // Settings (formerly Advanced)
        'settings.title': 'Настройки',
        'settings.settings': 'Настройки',
        'settings.debugTools': 'Инструменты отладки',
        'settings.messages': 'Сообщения',
        
        // Settings options
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
        'settings.language': 'Язык',
        
        // Debug Tools
        'debug.testNote': 'Отправить тестовую ноту (C4)',
        'debug.ping': 'Отправить пинг',
        'debug.midiEcho': 'MIDI-эхо (отправлять обратно все полученные MIDI-сообщения)',
        'debug.description': 'Тестирование подключения канала данных WebRTC и MIDI-эхо',
        
        // Footer
        'footer.help': 'Справка',
        
        // Language selector
        'language.select': 'Язык',
        
        // Help/Instructions
        'help.title': 'Как использовать Web MIDI Стример',
        'help.close': 'Закрыть',
        'help.step1Title': '1. Сначала подключите MIDI-клавиатуру',
        'help.step1': 'ВАЖНО: Подключите MIDI-клавиатуру или контроллер к компьютеру ДО открытия сайта или нажатия кнопок подключения. Это избавит от необходимости обновлять страницу.',
        'help.step2Title': '2. Откройте сайт',
        'help.step2': 'После подключения MIDI-устройства откройте сайт или перезагрузите страницу, если она уже была открыта.',
        'help.step3Title': '3. Выберите MIDI-устройства',
        'help.step3': 'Выберите входное MIDI-устройство (клавиатура, на которой вы играете) и выходное устройство (где вы слышите ноты удалённого пира).',
        'help.step4Title': '4. Создайте или войдите в комнату',
        'help.step4': 'Введите название комнаты и нажмите "Подключиться к комнате". Вы можете сохранить этот URL с названием комнаты, чтобы использовать одну и ту же комнату с одними и теми же людьми каждый раз.',
        'help.step5Title': '5. Поделитесь ссылкой',
        'help.step5': 'Скопируйте и отправьте сгенерированную ссылку вашему пиру. Они должны открыть её для автоматического подключения.',
        'help.step6Title': '6. Начинайте играть',
        'help.step6': 'После подключения вы можете играть на MIDI-клавиатуре и слышать друг друга в реальном времени!',
        'help.tipTitle': '💡 Совет',
        'help.tip': 'Вы можете добавить URL с названием комнаты в закладки, чтобы быстро переподключаться с теми же людьми в следующий раз.',
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
    const translation = translations[currentLanguage]?.[key] || translations['en'][key];
    
    if (!translation) {
        console.warn(`Missing translation for key: ${key}`);
        return key;
    }
    
    return translation;
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
