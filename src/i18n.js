// Internationalization (i18n) translations
export const translations = {
    en: {
        // Header
        'app.title': 'Web MIDI Streamer',
        'app.subtitle': 'Real-time MIDI streaming over WebRTC',
        'header.tools': '🎹 Mini Apps',
        
        // Status
        'status.title': 'Status:',
        'status.notConnected': 'Not connected',
        'status.enterRoomName': 'Enter Room Name',
        'status.disconnected': 'Disconnected',
        'status.waitingForPeer': 'Waiting for other participant...',
        'status.connectedToPeer': 'Connected',
        'status.connectedPeers': 'Connected ({n} peer(s))',
        
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
        'connection.roomDescription': 'Both participants must enter the same room name to connect',
        'connection.connectBtn': 'Connect to Room',
        'connection.disconnectBtn': 'Disconnect',
        'connection.shareUrl': 'Share this URL with the other participant:',
        'connection.copyUrl': 'Copy URL',
        'warning.turnRelay': '⚠️ TURN RELAY MODE: All connections will use TURN server (no direct P2P)',
        'midi.accessGranted': 'MIDI access granted',
        'midi.accessFailed': 'MIDI access failed',
        'connection.autoConnecting': "Auto-connecting to room",
        'connection.enterAndConnect': 'Enter a room name and click "Connect" to join',
        'settings.sysexEnabledMsg': 'SysEx enabled',
        'settings.sysexDisabledMsg': 'SysEx disabled',
        'settings.timestampEnabledMsg': 'Timestamp sync enabled',
        'settings.timestampDisabledMsg': 'Timestamp sync disabled',
        'midi.devicesRefreshed': 'MIDI devices refreshed',
        'settings.midiActivityEnabledMsg': 'MIDI activity display enabled',
        'settings.midiActivityDisabledMsg': 'MIDI activity display disabled',
        'settings.midiEchoEnabledMsg': 'MIDI echo enabled',
        'settings.midiEchoDisabledMsg': 'MIDI echo disabled',
        'settings.ipv6EnabledMsg': 'IPv6 P2P enabled',
        'settings.ipv6DisabledMsg': 'IPv6 P2P disabled',
        'chat.notConnected': 'Not connected - cannot send chat message',
        'connection.roomInputNotFound': 'Room name input not found',
        'connection.enterRoomNamePrompt': 'Please enter a room name',
        'connection.connectedToRoom': 'Connected to room',
        'connection.urlCopied': 'URL copied to clipboard!',
        'connection.copyUrlFailed': 'Failed to copy URL. Please copy manually.',
        'connection.failed': 'Connection failed',
        'debug.pingNotOpen': 'Data channel not open',
        'debug.sentTestNote': 'Sent test note (C4) via WebRTC',
        'debug.receivedTestNote': 'Received test note via WebRTC:',
        'settings.timestampEnabledByRemote': 'Timestamp sync enabled by remote peer',
        'settings.timestampDisabledByRemote': 'Timestamp sync disabled by remote peer',
        'messages.copied': '✓ All messages copied to clipboard',
        'messages.copyFailed': 'Failed to copy messages',

        // Piano keyboard visualiser
        'piano.title': '🎹 Keyboard Visualiser',
        'piano.ariaLabel': 'Piano keyboard showing active notes',
        'piano.legend.local': 'You (blue)',
        'piano.legend.remote': 'Remote (amber)',
        'piano.legend.both': 'Both (purple)',

        // Low-Latency Mode
        'settings.lowLatency': '⚡ Experimental Low-Latency Mode',
        'settings.lowLatencyDesc': 'Uses an unordered, no-retransmit DataChannel to minimise jitter. Reconnect after toggling. Packet loss is expected — stuck notes are handled automatically.',
        'settings.lowLatencyOn': '⚡ Low-Latency Mode ON (unordered, no retransmits) — reconnect to apply',
        'settings.lowLatencyOff': '🔁 Low-Latency Mode OFF — reconnect to apply',

        // Emergency
        'debug.emergencyHotkey': 'Ctrl+Shift+F4',
        'debug.emergency': '🛑 Emergency: All Notes Off',
        'debug.emergencyDesc': 'Sends CC 123 on all 16 channels locally and to all peers. Clears all active note timers.',
        'debug.emergencySent': '🛑 Emergency: All Notes Off sent (CC 123, all channels)',

        // Stability test
        'stability.title': '📶 Signal Stability Test',
        'stability.interval': 'Probe interval (ms):',
        'stability.duration': 'Duration (s):',
        'stability.start': '▶ Start',
        'stability.stop': '⏹ Stop',
        'stability.jitter': 'Jitter:',
        'stability.lost': 'Lost:',
        'stability.sent': 'Sent:',
        'stability.minGap': 'Min gap:',
        'stability.maxGap': 'Max gap:',
        'stability.running': 'Running…',
        'stability.stable': '✅ Stable',
        'stability.unstable': '⚠️ Unstable',
        'stability.notConnected': 'Connect to a peer first before running the stability test.',
        'stability.noData': 'Stability test stopped (not enough data)',
        'stability.result': '📶 Stability: jitter {jitter} ms | loss {lost}/{total} | {verdict}',
        'stability.verdictStable': '✅ STABLE',
        'stability.verdictUnstable': '❌ UNSTABLE',
        'stability.howto': 'Connect to a peer, then set the interval and duration below and press Start. The test sends probe packets and measures how evenly they arrive — low jitter means a stable connection.',
        'stability.started': '📶 Stability test started ({interval} ms interval, {duration} s)',

        // Recorder
        'recorder.title': '🎹 MIDI Recorder',
        'recorder.start': '⏺ Record',
        'recorder.stop': '⏹ Stop',
        'recorder.play': '▶ Play',
        'recorder.save': '💾 Save .mid',
        'recorder.statusRecording': '⏺ Recording…',
        'recorder.statusReady': '✅ Take ready',
        'recorder.statusTake': '✅ Take: {events} events, {dur}s',
        'recorder.started': '⏺ Recording started',
        'recorder.stoppedEmpty': 'Recording stopped — no events captured',
        'recorder.stopped': '⏹ Recording stopped — {events} events, {dur}s',
        'recorder.playing': '▶ Playing back recording…',
        'recorder.playbackDone': '▶ Playback finished',
        'recorder.saved': '💾 Recording saved as .mid',

        // Room hiding
        'room.hideFirst': 'Join a room first before hiding it',
        'room.hidden': '🙈 Room hidden from the room list',
        'room.shown': '👁 Room is now visible in the room list',
        'room.toggleFailed': 'Failed to toggle room visibility: {error}',
        'room.hide': '🙈 Hide Room',
        'room.show': '👁 Show Room',
        'rooms.refreshFailed': 'Failed to refresh rooms',

        // WebRTC status
        'webrtc.connecting': '🔗 Connecting to signaling server…',
        'webrtc.waiting': '⏳ Waiting for other participants…',
        'webrtc.noConnections': 'No open peer connections',
        'webrtc.pingBusy': 'Ping already in progress',
        'webrtc.pingStarted': 'Starting ping test (5 pings × {n} peer(s))…',
        'webrtc.pingResult': 'Ping {id}: {rtt} ms RTT (est. one-way: {oneway} ms)',
        'webrtc.pingDone': 'Ping done — min {min}  avg {avg}  max {max} ms  (est. one-way: {oneway} ms)',
        'webrtc.reconnecting': '🔄 Reconnecting to {peer} ({n}/2)…',
        'webrtc.lostAfter20s': '⚠️ Peer {peer} lost after 20 s',
        'webrtc.connectionLost': '❌ Connection to {peer} lost',
        'webrtc.peerLeft': 'Peer {peer} left ({n} remaining)',
        'webrtc.dcError': '❌ DataChannel error: {error}',
        'webrtc.signalFailed': 'Unable to reconnect to signaling server',
        'webrtc.wtActive': '⚡ WebTransport (QUIC datagram) active',
        'webrtc.wtUnavailable': '⚠️ WebTransport unavailable ({error}), falling back to WebRTC',
        'webrtc.wtReceiveError': '⚠️ WebTransport receive error: {error}',
        'webrtc.connected': '✅ Connected to {peer}{mode} ({n} peer{plural} total)',
        'webrtc.connectedMode': ' ⚡ Low-Latency',
        
        // Available Rooms
        'connection.availableRooms': 'Available Rooms',
        'connection.refreshRooms': 'Refresh Rooms',
        'status.connectionStatus': 'Connection status:',

        // Rooms
        'rooms.noActive': 'No active rooms',
        'rooms.availableCount_singular': '1 room available',
        'rooms.availableCount_plural': '{n} rooms available',
        'rooms.join': 'Join',
        'rooms.peerCount_singular': '1 peer',
        'rooms.peerCount_plural': '{n} peers',
        'rooms.newRoomAvailable': 'New room available: {room} ({count})',
        
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
        'debug.copyMessages': 'Copy All Messages',
        
        // Chat
        'chat.title': 'Chat',
        'chat.placeholder': 'Type a message...',
        'chat.send': 'Send',
        'chat.you': 'You',
        'chat.peer': 'Partner',
        
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
        'help.step2': 'After connecting your MIDI device, open the website or reload if you already had it open. Firefox will automatically download the MIDI component when you grant permission.',
        'help.step3Title': '3. Select MIDI Devices',
        'help.step3': 'Choose your MIDI input device (the keyboard you play) and output device (where you hear the other participant\'s notes).',
        'help.step4Title': '4. Create or Join a Room',
        'help.step4': 'Enter a room name and click "Connect to Room". You can save this URL with the room name to use the same room with the same people every time.',
        'help.step5Title': '5. Share the URL',
        'help.step5': 'Copy and share the generated URL with the other participant. They should open it to connect automatically.',
        'help.step6Title': '6. Start Playing',
        'help.step6': 'Once connected, you can play your MIDI keyboard and hear each other in real-time! The browser tab can be in the background while playing.',
        'help.tipTitle': '💡 Tip',
        'help.tip': 'You can bookmark the URL with your room name to quickly reconnect with the same people next time.',
        
        
        
        // Modal titles and labels
        'modal.songSetup': 'Song Setup',
        'modal.tempoSettings': 'Tempo Settings',
        'modal.midiDevices': 'MIDI Devices',
        'modal.done': 'Done',
        'modal.cancel': 'Cancel',
        'modal.startEditing': 'Start Editing',
        'modal.songName': 'Song Name:',
        'modal.authorComposer': 'Author/Composer:',
        'modal.timeSignature': 'Time Signature:',
        'modal.musicStyle': 'Music Style:',
        'modal.keySignature': 'Key Signature:',
        'modal.totalMeasures': 'Total Measures in Song:',
        'modal.bpm': 'BPM (Tempo):',
        'modal.midiInputDevice': 'MIDI Input Device:',
        'modal.midiOutputDevice': 'MIDI Output Device (for playback):',
        
        // Input Help Mode
        'inputHelp.active': 'Input help mode active. Press any key to hear its function, or press H or Escape to exit.',
        'inputHelp.deactivated': 'Input help mode deactivated',
        'inputHelp.h': 'Toggle input help mode',
        'inputHelp.shiftH': 'Show or hide keyboard shortcuts reference',
        'inputHelp.n': 'Focus workspace for chord editing',
        'inputHelp.t': 'Open tempo settings',
        'inputHelp.m': 'Select MIDI devices',
        'inputHelp.space': 'Play or pause playback',
        'inputHelp.ctrlComma': 'Open song settings',
        'inputHelp.r': 'Start or stop recording',
        'inputHelp.e': 'Edit chord using MIDI',
        'inputHelp.shiftE': 'Edit chord using keyboard',
        'inputHelp.s': 'Add section marker',
        'inputHelp.v': 'Add volta ending (first or second ending)',
        'inputHelp.backspace': 'Delete current chord',
        'inputHelp.delete': 'Delete marker range',
        'inputHelp.shiftBackspace': 'Delete current section',
        'inputHelp.ctrlX': 'Cut chords in marker range',
        'inputHelp.ctrlC': 'Copy chords in marker range',
        'inputHelp.ctrlV': 'Paste chords at cursor',
        'inputHelp.shiftS': 'Save to local storage',
        'inputHelp.shiftO': 'Open from local storage',
        'inputHelp.shiftD': 'Download iReal Pro file',
        'inputHelp.shiftJ': 'Download or load JSON progress',
        'inputHelp.shiftW': 'Close with save prompt',
        'inputHelp.arrowLeft': 'Navigate to previous chord',
        'inputHelp.arrowRight': 'Navigate to next chord',
        'inputHelp.ctrlArrowLeft': 'Jump to previous measure with chord',
        'inputHelp.ctrlArrowRight': 'Jump to next measure with chord',
        'inputHelp.bracketLeft': 'Set start marker',
        'inputHelp.bracketRight': 'Set end marker',
        'inputHelp.escape': 'Cancel current operation',
        'inputHelp.altArrowLeft': 'Move chord to previous beat',
        'inputHelp.altArrowRight': 'Move chord to next beat',
    },
    
    ru: {
        // Header
        'app.title': 'Web MIDI Стример',
        'app.subtitle': 'Потоковая передача MIDI в реальном времени через WebRTC',
        
        'header.tools': '🎹 Мини-приложения',

        // Status
        'status.title': 'Статус:',
        'status.notConnected': 'Не подключено',
        'status.enterRoomName': 'Введите название комнаты',
        'status.disconnected': 'Отключено',
        'status.waitingForPeer': 'Ожидание партнёра...',
        'status.connectedToPeer': 'Подключено к партнёру',
        'status.connectedPeers': 'Подключено ({n} участник(ов))',
        
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
        'connection.roomDescription': 'Оба участника должны ввести одинаковое название комнаты для подключения',
        'connection.connectBtn': 'Подключиться к комнате',
        'connection.disconnectBtn': 'Отключиться',
        'connection.shareUrl': 'Поделитесь этой ссылкой с другим участником:',
        'connection.copyUrl': 'Копировать ссылку',
        'warning.turnRelay': '⚠️ Режим TURN: все соединения будут через TURN-сервер (без прямого P2P)',
        'midi.accessGranted': 'Доступ к MIDI предоставлен',
        'midi.accessFailed': 'Доступ к MIDI не удался',
        'connection.autoConnecting': 'Автоматическое подключение к комнате',
        'connection.enterAndConnect': 'Введите название комнаты и нажмите "Подключиться" для входа',
        'settings.sysexEnabledMsg': 'SysEx включен',
        'settings.sysexDisabledMsg': 'SysEx выключен',
        'settings.timestampEnabledMsg': 'Синхронизация временных меток включена',
        'settings.timestampDisabledMsg': 'Синхронизация временных меток выключена',
        'midi.devicesRefreshed': 'MIDI-устройства обновлены',
        'settings.midiActivityEnabledMsg': 'Отображение MIDI-активности включено',
        'settings.midiActivityDisabledMsg': 'Отображение MIDI-активности выключено',
        'settings.midiEchoEnabledMsg': 'MIDI эхо включено',
        'settings.midiEchoDisabledMsg': 'MIDI эхо выключено',
        'settings.ipv6EnabledMsg': 'IPv6 P2P включен',
        'settings.ipv6DisabledMsg': 'IPv6 P2P выключен',
        'chat.notConnected': 'Не подключено — нельзя отправлять сообщение',
        'connection.roomInputNotFound': 'Поле ввода названия комнаты не найдено',
        'connection.enterRoomNamePrompt': 'Пожалуйста, введите название комнаты',
        'connection.connectedToRoom': 'Подключено к комнате',
        'connection.urlCopied': 'URL скопирован в буфер обмена!',
        'connection.copyUrlFailed': 'Не удалось скопировать ссылку. Пожалуйста, скопируйте вручную.',
        'connection.failed': 'Ошибка подключения',
        'debug.pingNotOpen': 'Канал данных не открыт',
        'debug.sentTestNote': 'Тестовая нота (C4) отправлена через WebRTC',
        'debug.receivedTestNote': 'Тестовая нота получена через WebRTC:',
        'settings.timestampEnabledByRemote': 'Синхронизация временных меток включена удалённым участником',
        'settings.timestampDisabledByRemote': 'Синхронизация временных меток выключена удалённым участником',
        'messages.copied': '✓ Все сообщения скопированы в буфер обмена',
        'messages.copyFailed': 'Не удалось скопировать сообщения',

        // Piano keyboard visualiser
        'piano.title': '🎹 Визуализатор клавиатуры',
        'piano.ariaLabel': 'Клавиатура пианино с подсветкой активных нот',
        'piano.legend.local': 'Вы (синий)',
        'piano.legend.remote': 'Партнёр (оранжевый)',
        'piano.legend.both': 'Оба (фиолетовый)',

        // Low-Latency Mode
        'settings.lowLatency': '⚡ Экспериментальный режим минимальной задержки',
        'settings.lowLatencyDesc': 'Использует неупорядоченный канал данных без повторных передач для минимизации джиттера. Переподключитесь после переключения. Потеря пакетов ожидаема — залипшие ноты обрабатываются автоматически.',
        'settings.lowLatencyOn': '⚡ Режим минимальной задержки ВКЛЮЧЁН — переподключитесь для применения',
        'settings.lowLatencyOff': '🔁 Режим минимальной задержки ВЫКЛЮЧЕН — переподключитесь для применения',

        // Emergency
        'debug.emergencyHotkey': 'Ctrl+Shift+F4',
        'debug.emergency': '🛑 Аварийное отключение нот',
        'debug.emergencyDesc': 'Отправляет CC 123 по всем 16 каналам локально и всем партнёрам. Сбрасывает все таймеры активных нот.',
        'debug.emergencySent': '🛑 Аварийное отключение нот отправлено (CC 123, все каналы)',

        // Stability test
        'stability.title': '📶 Тест стабильности сигнала',
        'stability.interval': 'Интервал зондирования (мс):',
        'stability.duration': 'Длительность (с):',
        'stability.start': '▶ Начать',
        'stability.stop': '⏹ Остановить',
        'stability.jitter': 'Джиттер:',
        'stability.lost': 'Потеряно:',
        'stability.sent': 'Отправлено:',
        'stability.minGap': 'Мин. интервал:',
        'stability.maxGap': 'Макс. интервал:',
        'stability.running': 'Выполняется…',
        'stability.stable': '✅ Стабильно',
        'stability.unstable': '⚠️ Нестабильно',
        'stability.notConnected': 'Сначала подключитесь к партнёру для запуска теста.',
        'stability.noData': 'Тест остановлен (недостаточно данных)',
        'stability.result': '📶 Стабильность: джиттер {jitter} мс | потери {lost}/{total} | {verdict}',
        'stability.verdictStable': '✅ СТАБИЛЬНО',
        'stability.verdictUnstable': '❌ НЕСТАБИЛЬНО',
        'stability.howto': 'Подключитесь к партнёру, затем задайте интервал и длительность ниже и нажмите «Начать». Тест отправляет зондирующие пакеты и измеряет равномерность их прибытия — низкий джиттер означает стабильное соединение.',
        'stability.started': '📶 Тест запущен (интервал {interval} мс, {duration} с)',

        // Recorder
        'recorder.title': '🎹 MIDI Рекордер',
        'recorder.start': '⏺ Запись',
        'recorder.stop': '⏹ Стоп',
        'recorder.play': '▶ Воспроизвести',
        'recorder.save': '💾 Сохранить .mid',
        'recorder.statusRecording': '⏺ Запись…',
        'recorder.statusReady': '✅ Запись готова',
        'recorder.statusTake': '✅ Запись: {events} событий, {dur}с',
        'recorder.started': '⏺ Запись начата',
        'recorder.stoppedEmpty': 'Запись остановлена — события не записаны',
        'recorder.stopped': '⏹ Запись остановлена — {events} событий, {dur}с',
        'recorder.playing': '▶ Воспроизведение…',
        'recorder.playbackDone': '▶ Воспроизведение завершено',
        'recorder.saved': '💾 Запись сохранена как .mid',

        // Room hiding
        'room.hideFirst': 'Сначала войдите в комнату',
        'room.hidden': '🙈 Комната скрыта из списка',
        'room.shown': '👁 Комната снова видна в списке',
        'room.toggleFailed': 'Не удалось изменить видимость комнаты: {error}',
        'room.hide': '🙈 Скрыть комнату',
        'room.show': '👁 Показать комнату',
        'rooms.refreshFailed': 'Не удалось обновить список комнат',

        // WebRTC status
        'webrtc.connecting': '🔗 Подключение к серверу сигнализации…',
        'webrtc.waiting': '⏳ Ожидание других участников…',
        'webrtc.noConnections': 'Нет открытых соединений',
        'webrtc.pingBusy': 'Пинг уже выполняется',
        'webrtc.pingStarted': 'Запуск теста пинга (5 × {n} соединение(й))…',
        'webrtc.pingResult': 'Пинг {id}: {rtt} мс (одностороннее: {oneway} мс)',
        'webrtc.pingDone': 'Пинг завершён — мин {min}  сред {avg}  макс {max} мс  (одностороннее: {oneway} мс)',
        'webrtc.reconnecting': '🔄 Переподключение к {peer} ({n}/2)…',
        'webrtc.lostAfter20s': '⚠️ Партнёр {peer} потерян через 20 с',
        'webrtc.connectionLost': '❌ Соединение с {peer} потеряно',
        'webrtc.peerLeft': 'Партнёр {peer} покинул сессию ({n} осталось)',
        'webrtc.dcError': '❌ Ошибка канала данных: {error}',
        'webrtc.signalFailed': 'Не удалось переподключиться к серверу сигнализации',
        'webrtc.wtActive': '⚡ WebTransport (QUIC датаграмма) активен',
        'webrtc.wtUnavailable': '⚠️ WebTransport недоступен ({error}), используется WebRTC',
        'webrtc.wtReceiveError': '⚠️ Ошибка получения WebTransport: {error}',
        'webrtc.connected': '✅ Подключено к {peer}{mode} (всего {n} участник{plural})',
        'webrtc.connectedMode': ' ⚡ Мин. задержка',
        
        // Available Rooms
        'connection.availableRooms': 'Доступные комнаты',
        'connection.refreshRooms': 'Обновить комнаты',
        'status.connectionStatus': 'Статус соединения:',

        // Rooms
        'rooms.noActive': 'Нет активных комнат',
        'rooms.availableCount_singular': '1 комната доступна',
        'rooms.availableCount_plural': '{n} комнат доступно',
        'rooms.join': 'Войти',
        'rooms.peerCount_singular': '1 участник',
        'rooms.peerCount_plural': '{n} участников',
        'rooms.newRoomAvailable': 'Новая комната: {room} ({count})',
        
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
        'settings.midiActivity': 'Показывать MIDI-активность',
        'settings.midiActivityDesc': 'Отображать и объявлять MIDI-события через программу чтения с экрана',
        'settings.ipv6': 'Включить IPv6 P2P (экспериментально)',
        'settings.ipv6Desc': 'Попытка соединения через IPv6. Если отключено, будет использоваться только IPv4.',
        'settings.language': 'Язык',
        
        // Debug Tools
        'debug.testNote': 'Отправить тестовую ноту (До первой октавы)',
        'debug.ping': 'Пропинговать',
        'debug.midiEcho': 'MIDI-эхо (отправлять обратно все полученные MIDI-сообщения)',
        'debug.description': 'Тестирование подключения канала данных WebRTC.',
        'debug.copyMessages': 'Копировать все сообщения',
        
        // Chat
        'chat.title': 'Чат',
        'chat.placeholder': 'Введите сообщение...',
        'chat.send': 'Отправить',
        'chat.you': 'Вы',
        'chat.peer': 'Собеседник',
        
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
        'help.step2': 'После подключения MIDI-устройства откройте сайт или перезагрузите страницу, если она уже была открыта. Firefox автоматически скачает MIDI-компонент при предоставлении разрешения.',
        'help.step3Title': '3. Выберите MIDI-устройства',
        'help.step3': 'Выберите входное MIDI-устройство (клавиатура, на которой вы играете) и выходное устройство (где вы слышите ноты другого участника).',
        'help.step4Title': '4. Создайте или войдите в комнату',
        'help.step4': 'Введите название комнаты и нажмите "Подключиться к комнате". Вы можете сохранить этот URL с названием комнаты, чтобы использовать одну и ту же комнату с одними и теми же людьми каждый раз.',
        'help.step5Title': '5. Поделитесь ссылкой',
        'help.step5': 'Скопируйте и отправьте сгенерированную ссылку другому участнику. Они должны открыть её для автоматического подключения.',
        'help.step6Title': '6. Начинайте играть',
        'help.step6': 'После подключения вы можете играть на MIDI-клавиатуре и слышать друг друга в реальном времени! Вкладка браузера может работать в фоновом режиме.',
        'help.tipTitle': '💡 Совет',
        'help.tip': 'Вы можете добавить URL с названием комнаты в закладки, чтобы быстро переподключаться с теми же людьми в следующий раз.',
        
        
        
        // Modal titles and labels
        'modal.songSetup': 'Настройка песни',
        'modal.tempoSettings': 'Настройки темпа',
        'modal.midiDevices': 'MIDI устройства',
        'modal.done': 'Готово',
        'modal.cancel': 'Отмена',
        'modal.startEditing': 'Начать редактирование',
        'modal.songName': 'Название песни:',
        'modal.authorComposer': 'Автор/Композитор:',
        'modal.timeSignature': 'Тактовый размер:',
        'modal.musicStyle': 'стиль:',
        'modal.keySignature': 'Тональность:',
        'modal.totalMeasures': 'Всего тактов в песне:',
        'modal.bpm': 'BPM (Темп):',
        'modal.midiInputDevice': 'Входное MIDI-устройство:',
        'modal.midiOutputDevice': 'Выходное MIDI-устройство (для воспроизведения):',
        
        // Input Help Mode
        'inputHelp.active': 'Справка по вводу включена. Нажмите любую клавишу, чтобы услышать её функцию, или нажмите H или Escape для выхода.',
        'inputHelp.deactivated': 'Справка по вводу выключена',  // like in nvda, same phrase would make nostalgic effect
        'inputHelp.h': 'Включить или выключить справку по вводу',
        'inputHelp.shiftH': 'Показать или скрыть справочник сочетаний клавиш',
        'inputHelp.n': 'Фокус на рабочей области для редактирования аккордов',
        'inputHelp.t': 'Открыть настройки темпа',
        'inputHelp.m': 'Выбрать MIDI устройства',
        'inputHelp.space': 'Воспроизвести или приостановить воспроизведение',
        'inputHelp.ctrlComma': 'Открыть настройки песни',
        'inputHelp.r': 'Начать или остановить запись',
        'inputHelp.e': 'Редактировать аккорд с помощью MIDI клавиатуры',
        'inputHelp.shiftE': 'Редактировать аккорд с помощью клавиатуры',
        'inputHelp.s': 'Добавить маркер секции',
        'inputHelp.v': 'Добавить вольту',
        'inputHelp.backspace': 'Удалить текущий аккорд',
        'inputHelp.delete': 'Удалить диапазон маркера',
        'inputHelp.shiftBackspace': 'Удалить текущую секцию',
        'inputHelp.ctrlX': 'Вырезать аккорды в диапазоне маркера',
        'inputHelp.ctrlC': 'Копировать аккорды в диапазоне маркера',
        'inputHelp.ctrlV': 'Вставить аккорды в позицию курсора',
        'inputHelp.shiftS': 'Сохранить в локальное хранилище',
        'inputHelp.shiftO': 'Открыть из локального хранилища',
        'inputHelp.shiftD': 'Скачать файл iReal Pro',
        'inputHelp.shiftJ': 'Скачать или загрузить прогресс JSON',
        'inputHelp.shiftW': 'Закрыть с запросом сохранения',
        'inputHelp.arrowLeft': 'Перейти к предыдущему аккорду',
        'inputHelp.arrowRight': 'Перейти к следующему аккорду',
        'inputHelp.ctrlArrowLeft': 'Перейти к предыдущему такту с аккордом',
        'inputHelp.ctrlArrowRight': 'Перейти к следующему такту с аккордом',
        'inputHelp.bracketLeft': 'Установить начальный маркер',
        'inputHelp.bracketRight': 'Установить конечный маркер',
        'inputHelp.escape': 'Отменить текущую операцию',
        'inputHelp.altArrowLeft': 'Переместить аккорд на предыдущую долю',
        'inputHelp.altArrowRight': 'Переместить аккорд на следующую долю',
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
