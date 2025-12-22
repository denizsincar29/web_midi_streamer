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
        
        // Mini Apps
        'tools.title': 'MIDI Mini Apps',
        'tools.backToMidiStreamer': '← Back to MIDI Streamer',
        'tools.nordEffects': 'Nord Effects Controller',
        'tools.nordEffectsBeta': '(BETA)',
        'tools.nordEffectsDesc': 'Control Nord keyboard effects via MIDI CC messages. Adjust reverb, delay, rotary speaker speed, and more in real-time.',
        'tools.nordEffectsWarning': '⚠️ EXPERIMENTAL: This mini app is in beta and may be unstable. CC mappings may not work with all Nord keyboard models.',
        'tools.chordDisplay': 'Chord Display',
        'tools.chordDisplayDesc': 'See what chord you\'re playing in real-time. Detects and displays jazz chords with proper notation from your MIDI input.',
        'tools.irealbMaker': 'iRealPro Maker',
        'tools.irealbMakerDesc': 'Create iRealPro chord charts by recording your chord progressions with metronome count-in.',
        'tools.help': 'Help',
        'tools.subtitle': 'Professional mini apps for pianists and keyboard players',
        'tools.backToTools': 'Back to Mini Apps',
        'tools.openTool': 'Open Mini App',
        
        // Nord Effects Controller
        'nordEffects.title': 'Nord Effects Controller',
        'nordEffects.subtitle': 'Control your Nord keyboard effects via MIDI CC',
        'nordEffects.description': 'Control Nord keyboard effects via MIDI CC messages. Adjust reverb, delay, rotary speaker speed, and more in real-time.',
        'nordEffects.midiStatus': 'MIDI Status:',
        'nordEffects.initializing': 'Initializing...',
        'nordEffects.accessGranted': 'MIDI Access Granted',
        'nordEffects.accessDenied': 'MIDI Access Denied:',
        'nordEffects.connectedTo': 'Connected to:',
        'nordEffects.noDevice': 'No output device selected',
        'nordEffects.outputDevice': 'MIDI Output Device:',
        'nordEffects.noDeviceSelected': 'No device selected',
        'nordEffects.rotarySpeaker': 'Rotary Speaker',
        'nordEffects.speed': 'Speed:',
        'nordEffects.slow': 'Slow',
        'nordEffects.fast': 'Fast',
        'nordEffects.reverb': 'Reverb',
        'nordEffects.onOff': 'On/Off:',
        'nordEffects.off': 'Off',
        'nordEffects.on': 'On',
        'nordEffects.amount': 'Amount:',
        'nordEffects.delay': 'Delay',
        'nordEffects.effect1': 'Effect 1 (Tremolo/Pan)',
        'nordEffects.depth': 'Depth:',
        'nordEffects.effect2': 'Effect 2 (Phaser/Flanger/Chorus)',
        'nordEffects.resonance': 'Piano String Resonance',
        'nordEffects.presets': 'Quick Presets',
        'nordEffects.cleanPiano': 'Clean Piano',
        'nordEffects.jazzCombo': 'Jazz Combo',
        'nordEffects.ambientPad': 'Ambient Pad',
        'nordEffects.rockOrgan': 'Rock Organ',
        
        // Chord Display
        'chordDisplay.title': 'Chord Display',
        'chordDisplay.subtitle': 'Real-time jazz chord detection from MIDI input',
        'chordDisplay.description': 'See what chord you\'re playing in real-time. Detects and displays jazz chords with proper notation from your MIDI input.',
        'chordDisplay.midiStatus': 'MIDI Status:',
        'chordDisplay.initializing': 'Initializing...',
        'chordDisplay.accessGranted': 'MIDI Access Granted',
        'chordDisplay.accessDenied': 'MIDI Access Denied:',
        'chordDisplay.connectedTo': 'Connected to:',
        'chordDisplay.noDevice': 'No input device selected',
        'chordDisplay.inputDevice': 'MIDI Input Device:',
        'chordDisplay.noDeviceSelected': 'No device selected',
        'chordDisplay.playNotes': 'Play some notes...',
        'chordDisplay.singleNote': 'Single note',
        'chordDisplay.customVoicing': 'Custom voicing',
        'chordDisplay.currentNotes': 'Current Notes:',
        'chordDisplay.noNotesPlaying': 'No notes being played',
        'chordDisplay.lastChord': 'Last Chord:',
        'chordDisplay.settings': 'Settings',
        'chordDisplay.showAllChords': 'Show all possible chord interpretations',
        'chordDisplay.simplifyChords': 'Simplify chord names (prefer basic chords)',
        
        // iRealb Maker
        'irealbMaker.title': 'iRealPro Maker',
        'irealbMaker.subtitle': 'Create iRealPro chord charts from MIDI input',
        'irealbMaker.midiStatus': 'MIDI Status:',
        'irealbMaker.initializing': 'Initializing...',
        'irealbMaker.accessGranted': 'MIDI Access Granted',
        'irealbMaker.accessDenied': 'MIDI Access Denied:',
        'irealbMaker.connectedTo': 'Connected to:',
        'irealbMaker.noDevice': 'No input device selected',
        'irealbMaker.inputDevice': 'MIDI Input Device:',
        'irealbMaker.noDeviceSelected': 'No device selected',
        'irealbMaker.songInfo': 'Song Information',
        'irealbMaker.songName': 'Song Name:',
        'irealbMaker.authorName': 'Author/Composer:',
        'irealbMaker.timeSignature': 'Time Signature:',
        'irealbMaker.timeSignatureHelp': 'Count-in will be announced for the first 2 measures',
        'irealbMaker.musicStyle': 'Music Style:',
        'irealbMaker.musicStyleHelp': 'Select the music style for your song',
        'irealbMaker.keySignature': 'Key Signature:',
        'irealbMaker.keySignatureHelp': 'Select the key signature for your song',
        'irealbMaker.metronomeSettings': 'Metronome Settings',
        'irealbMaker.bpm': 'BPM (Tempo):',
        'irealbMaker.bpmHelp': 'Metronome tempo (40-240 beats per minute)',
        'irealbMaker.songLength': 'Song Length',
        'irealbMaker.startMeasure': 'Start Recording from Measure:',
        'irealbMaker.startMeasureHelp': 'Choose which measure to start recording from',
        'irealbMaker.endMeasure': 'End Recording at Measure (optional):',
        'irealbMaker.endMeasureHelp': 'Optionally set an end measure to overwrite a specific range (e.g., 5-8)',
        'irealbMaker.totalMeasures': 'Total Measures in Song:',
        'irealbMaker.totalMeasuresHelp': 'Set the total length of your song',
        'irealbMaker.songStructure': 'Song Structure',
        'irealbMaker.sectionType': 'Section Type:',
        'irealbMaker.sectionMeasure': 'Section Starts at Measure:',
        'irealbMaker.addSection': '➕ Add Section',
        'irealbMaker.definedSections': 'Defined Sections:',
        'irealbMaker.readyToRecord': 'Ready to record...',
        'irealbMaker.startRecording': '▶️ Start Recording',
        'irealbMaker.stopRecording': '⏹️ Stop Recording',
        'irealbMaker.download': '💾 Download iRealPro File',
        'irealbMaker.downloadJson': '📥 Download Progress (JSON)',
        'irealbMaker.uploadJson': '📤 Upload Progress (JSON)',
        'irealbMaker.reset': '🔄 Reset',
        'irealbMaker.recordedChords': 'Recorded Chord Sequence',
        'irealbMaker.enterSongName': 'Please enter a song name before starting.',
        'irealbMaker.measure': 'Measure',
        'irealbMaker.emptyMeasure': 'Empty measure',
        'irealbMaker.beat': 'beat',
        
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
        
        // Status
        'status.title': 'Статус:',
        'status.notConnected': 'Не подключено',
        'status.enterRoomName': 'Введите название комнаты',
        'status.disconnected': 'Отключено',
        'status.waitingForPeer': 'Ожидание партнёра...',
        'status.connectedToPeer': 'Подключено к партнёру',
        
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
        
        // Mini Apps
        'tools.title': 'MIDI Мини-приложения',
        'tools.subtitle': 'Профессиональные мини-приложения для пианистов и клавишников',
        'tools.backToMidiStreamer': '← Назад к MIDI Стримеру',
        'tools.backToTools': 'Назад к мини-приложениям',
        'tools.openTool': 'Открыть мини-приложение',
        'tools.nordEffects': 'Контроллер Эффектов Nord',
        'tools.nordEffectsBeta': '(BETA)',
        'tools.nordEffectsDesc': 'Управление эффектами клавиатуры Nord через MIDI CC сообщения. Регулируйте реверберацию, задержку, скорость ротора и многое другое в реальном времени.',
        'tools.nordEffectsWarning': '⚠️ ЭКСПЕРИМЕНТАЛЬНО: Это мини-приложение находится в бета-версии и может быть нестабильным. Привязки CC могут не работать со всеми моделями клавиатур Nord.',
        'tools.chordDisplay': 'Отображение Аккордов',
        'tools.chordDisplayDesc': 'Смотрите, какой аккорд вы играете в реальном времени. Определяет и отображает джазовые аккорды с правильной нотацией из вашего MIDI входа.',
        'tools.irealbMaker': 'Создатель iRealPro',
        'tools.irealbMakerDesc': 'Создавайте аккордовые схемы iRealPro, записывая ваши аккордовые прогрессии с метрономом.',
        'tools.help': 'Справка',
        'header.tools': '🎹 Мини-приложения',
        
        // Nord Effects Controller
        'nordEffects.title': 'Контроллер эффектов Nord',
        'nordEffects.subtitle': 'Управление эффектами клавиатуры Nord через MIDI CC',
        'nordEffects.description': 'Управление эффектами клавиатуры Nord через MIDI CC сообщения. Настройте реверберацию, задержку, скорость ротора и многое другое в реальном времени.',
        'nordEffects.midiStatus': 'Статус MIDI:',
        'nordEffects.initializing': 'Инициализация...',
        'nordEffects.accessGranted': 'Доступ к MIDI предоставлен',
        'nordEffects.accessDenied': 'Доступ к MIDI запрещён:',
        'nordEffects.connectedTo': 'Подключено к:',
        'nordEffects.noDevice': 'Выходное устройство не выбрано',
        'nordEffects.outputDevice': 'Выходное MIDI-устройство:',
        'nordEffects.noDeviceSelected': 'Устройство не выбрано',
        'nordEffects.rotarySpeaker': 'Ротор',
        'nordEffects.speed': 'Скорость:',
        'nordEffects.slow': 'Медленно',
        'nordEffects.fast': 'Быстро',
        'nordEffects.reverb': 'Реверберация',
        'nordEffects.onOff': 'Вкл/Выкл:',
        'nordEffects.off': 'Выкл',
        'nordEffects.on': 'Вкл',
        'nordEffects.amount': 'Количество:',
        'nordEffects.delay': 'Задержка',
        'nordEffects.effect1': 'Эффект 1 (Тремоло/Панорама)',
        'nordEffects.depth': 'Глубина:',
        'nordEffects.effect2': 'Эффект 2 (Фейзер/Фленжер/Хорус)',
        'nordEffects.resonance': 'Резонанс струн фортепиано',
        'nordEffects.presets': 'Быстрые пресеты',
        'nordEffects.cleanPiano': 'Чистое фортепиано',
        'nordEffects.jazzCombo': 'Джазовый комбо',
        'nordEffects.ambientPad': 'Эмбиент пэд',
        'nordEffects.rockOrgan': 'Рок-орган',
        
        // Chord Display
        'chordDisplay.title': 'Отображение аккордов',
        'chordDisplay.subtitle': 'Распознавание джазовых аккордов в реальном времени',
        'chordDisplay.description': 'Посмотрите, какой аккорд вы играете в реальном времени. Определяет и отображает джазовые аккорды с правильной нотацией из вашего MIDI-входа.',
        'chordDisplay.midiStatus': 'Статус MIDI:',
        'chordDisplay.initializing': 'Инициализация...',
        'chordDisplay.accessGranted': 'Доступ к MIDI предоставлен',
        'chordDisplay.accessDenied': 'Доступ к MIDI запрещён:',
        'chordDisplay.connectedTo': 'Подключено к:',
        'chordDisplay.noDevice': 'Входное устройство не выбрано',
        'chordDisplay.inputDevice': 'Входное MIDI-устройство:',
        'chordDisplay.noDeviceSelected': 'Устройство не выбрано',
        'chordDisplay.playNotes': 'Сыграйте несколько нот...',
        'chordDisplay.singleNote': 'Одна нота',
        'chordDisplay.customVoicing': 'Пользовательская расстановка',
        'chordDisplay.currentNotes': 'Текущие ноты:',
        'chordDisplay.noNotesPlaying': 'Ноты не играются',
        'chordDisplay.lastChord': 'Последний аккорд:',
        'chordDisplay.settings': 'Настройки',
        'chordDisplay.showAllChords': 'Показать все возможные варианты аккордов',
        'chordDisplay.simplifyChords': 'Упростить названия аккордов (предпочитать базовые аккорды)',
        
        // iRealb Maker
        'irealbMaker.title': 'Создатель iRealPro',
        'irealbMaker.subtitle': 'Создание аккордовых схем iRealPro из MIDI',
        'irealbMaker.midiStatus': 'Статус MIDI:',
        'irealbMaker.initializing': 'Инициализация...',
        'irealbMaker.accessGranted': 'Доступ к MIDI предоставлен',
        'irealbMaker.accessDenied': 'Доступ к MIDI запрещён:',
        'irealbMaker.connectedTo': 'Подключено к:',
        'irealbMaker.noDevice': 'Входное устройство не выбрано',
        'irealbMaker.inputDevice': 'Входное MIDI-устройство:',
        'irealbMaker.noDeviceSelected': 'Устройство не выбрано',
        'irealbMaker.songInfo': 'Информация о песне',
        'irealbMaker.songName': 'Название песни:',
        'irealbMaker.authorName': 'Автор/Композитор:',
        'irealbMaker.timeSignature': 'Тактовый размер:',
        'irealbMaker.timeSignatureHelp': 'Счёт будет объявлен для первых 2 тактов',
        'irealbMaker.musicStyle': 'Музыкальный стиль:',
        'irealbMaker.musicStyleHelp': 'Выберите музыкальный стиль для вашей песни',
        'irealbMaker.keySignature': 'Тональность:',
        'irealbMaker.keySignatureHelp': 'Выберите тональность для вашей песни',
        'irealbMaker.metronomeSettings': 'Настройки метронома',
        'irealbMaker.bpm': 'BPM (Темп):',
        'irealbMaker.bpmHelp': 'Темп метронома (40-240 ударов в минуту)',
        'irealbMaker.songLength': 'Длина песни',
        'irealbMaker.startMeasure': 'Начать запись с такта:',
        'irealbMaker.startMeasureHelp': 'Выберите, с какого такта начать запись',
        'irealbMaker.endMeasure': 'Закончить запись на такте (необязательно):',
        'irealbMaker.endMeasureHelp': 'Опционально укажите конечный такт для перезаписи диапазона (например, 5-8)',
        'irealbMaker.totalMeasures': 'Всего тактов в песне:',
        'irealbMaker.totalMeasuresHelp': 'Установите общую длину вашей песни',
        'irealbMaker.songStructure': 'Структура песни',
        'irealbMaker.sectionType': 'Тип секции:',
        'irealbMaker.sectionMeasure': 'Секция начинается с такта:',
        'irealbMaker.addSection': '➕ Добавить секцию',
        'irealbMaker.definedSections': 'Определенные секции:',
        'irealbMaker.readyToRecord': 'Готов к записи...',
        'irealbMaker.startRecording': '▶️ Начать запись',
        'irealbMaker.stopRecording': '⏹️ Остановить запись',
        'irealbMaker.download': '💾 Скачать файл iRealPro',
        'irealbMaker.downloadJson': '📥 Скачать прогресс (JSON)',
        'irealbMaker.uploadJson': '📤 Загрузить прогресс (JSON)',
        'irealbMaker.reset': '🔄 Сбросить',
        'irealbMaker.recordedChords': 'Записанная последовательность аккордов',
        'irealbMaker.enterSongName': 'Пожалуйста, введите название песни перед началом.',
        'irealbMaker.measure': 'Такт',
        'irealbMaker.emptyMeasure': 'Пустой такт',
        'irealbMaker.beat': 'доля',
        
        // Input Help Mode
        'inputHelp.active': 'Режим помощи по вводу активен. Нажмите любую клавишу, чтобы услышать её функцию, или нажмите H или Escape для выхода.',
        'inputHelp.deactivated': 'Режим помощи по вводу деактивирован',
        'inputHelp.h': 'Переключить режим помощи по вводу',
        'inputHelp.shiftH': 'Показать или скрыть справочник сочетаний клавиш',
        'inputHelp.n': 'Фокус на рабочей области для редактирования аккордов',
        'inputHelp.t': 'Открыть настройки темпа',
        'inputHelp.m': 'Выбрать MIDI устройства',
        'inputHelp.space': 'Воспроизвести или приостановить воспроизведение',
        'inputHelp.ctrlComma': 'Открыть настройки песни',
        'inputHelp.r': 'Начать или остановить запись',
        'inputHelp.e': 'Редактировать аккорд с помощью MIDI',
        'inputHelp.shiftE': 'Редактировать аккорд с помощью клавиатуры',
        'inputHelp.s': 'Добавить маркер секции',
        'inputHelp.v': 'Добавить вольта окончание (первое или второе окончание)',
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
