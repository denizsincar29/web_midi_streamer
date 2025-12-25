import { t, getCurrentLanguage, initI18n } from '../../js/i18n.js';

let midiAccess = null;
let selectedOutput = null;

// Initialize MIDI
async function initMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        updateMIDIStatus(t('nordEffects.accessGranted'), true);
        populateOutputDevices();
        midiAccess.onstatechange = populateOutputDevices;
    } catch (error) {
        updateMIDIStatus(t('nordEffects.accessDenied') + ' ' + error.message, false);
    }
}

function updateMIDIStatus(message, connected) {
    const statusEl = document.getElementById('midiStatus');
    const statusText = document.getElementById('statusText');
    statusText.textContent = message;
    statusEl.className = connected ? 'midi-status connected' : 'midi-status';
}

function populateOutputDevices() {
    const select = document.getElementById('midiOutput');
    select.innerHTML = `<option value="">${t('nordEffects.noDeviceSelected')}</option>`;

    const outputs = Array.from(midiAccess.outputs.values());
    outputs.forEach((output, index) => {
        const option = document.createElement('option');
        option.value = output.id;
        option.textContent = output.name;
        if (index === 0) option.selected = true;
        select.appendChild(option);
    });

    // Auto-select first device
    if (outputs.length > 0) {
        selectOutput(outputs[0].id);
    }
}

function selectOutput(deviceId) {
    if (deviceId && midiAccess) {
        selectedOutput = midiAccess.outputs.get(deviceId);
        updateMIDIStatus(t('nordEffects.connectedTo') + ' ' + selectedOutput.name, true);
    } else {
        selectedOutput = null;
        updateMIDIStatus(t('nordEffects.noDevice'), false);
    }
}

function sendCC(cc, value) {
    if (selectedOutput) {
        // Send on MIDI channel 1 (0xB0)
        selectedOutput.send([0xB0, cc, value]);
        console.log(`Sent CC ${cc}: ${value}`);
    }
}

// Setup toggle buttons
document.querySelectorAll('.toggle-button').forEach(button => {
    button.addEventListener('click', () => {
        const isActive = button.classList.contains('active');
        const cc = parseInt(button.dataset.cc);
        const offValue = parseInt(button.dataset.off);
        const onValue = parseInt(button.dataset.on);

        if (isActive) {
            button.classList.remove('active');
            button.textContent = button.id === 'rotarySpeed' ? t('nordEffects.slow') : t('nordEffects.off');
            sendCC(cc, offValue);
        } else {
            button.classList.add('active');
            button.textContent = button.id === 'rotarySpeed' ? t('nordEffects.fast') : t('nordEffects.on');
            sendCC(cc, onValue);
        }
    });
});

// Setup range sliders
document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valueDisplay = document.getElementById(slider.id.replace('Amount', 'Value'));

    slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        valueDisplay.textContent = value;
        const cc = parseInt(slider.dataset.cc);
        sendCC(cc, value);
    });
});

// Preset configurations
const presets = {
    clean: {
        reverb: { toggle: false, amount: 30 },
        delay: { toggle: false, amount: 0 },
        effect1: { toggle: false, amount: 0 },
        effect2: { toggle: false, amount: 0 },
        resonance: 64
    },
    jazz: {
        reverb: { toggle: true, amount: 60 },
        delay: { toggle: false, amount: 30 },
        effect1: { toggle: false, amount: 0 },
        effect2: { toggle: true, amount: 45 },
        resonance: 80
    },
    ambient: {
        reverb: { toggle: true, amount: 100 },
        delay: { toggle: true, amount: 85 },
        effect1: { toggle: true, amount: 50 },
        effect2: { toggle: true, amount: 60 },
        resonance: 90
    },
    rock: {
        reverb: { toggle: true, amount: 45 },
        delay: { toggle: false, amount: 0 },
        effect1: { toggle: false, amount: 0 },
        effect2: { toggle: false, amount: 0 },
        resonance: 40
    }
};

function applyPreset(presetName) {
    const preset = presets[presetName];
    if (!preset) return;

    // Apply reverb
    const reverbToggle = document.getElementById('reverbToggle');
    const reverbAmount = document.getElementById('reverbAmount');
    if (preset.reverb.toggle) {
        reverbToggle.classList.add('active');
        reverbToggle.textContent = 'On';
        sendCC(105, 127);
    } else {
        reverbToggle.classList.remove('active');
        reverbToggle.textContent = 'Off';
        sendCC(105, 0);
    }
    reverbAmount.value = preset.reverb.amount;
    document.getElementById('reverbValue').textContent = preset.reverb.amount;
    sendCC(85, preset.reverb.amount);

    // Apply delay
    const delayToggle = document.getElementById('delayToggle');
    const delayAmount = document.getElementById('delayAmount');
    if (preset.delay.toggle) {
        delayToggle.classList.add('active');
        delayToggle.textContent = 'On';
        sendCC(104, 127);
    } else {
        delayToggle.classList.remove('active');
        delayToggle.textContent = 'Off';
        sendCC(104, 0);
    }
    delayAmount.value = preset.delay.amount;
    document.getElementById('delayValue').textContent = preset.delay.amount;
    sendCC(19, preset.delay.amount);

    // Apply effect 1
    const effect1Toggle = document.getElementById('effect1Toggle');
    const effect1Amount = document.getElementById('effect1Amount');
    if (preset.effect1.toggle) {
        effect1Toggle.classList.add('active');
        effect1Toggle.textContent = 'On';
        sendCC(102, 127);
    } else {
        effect1Toggle.classList.remove('active');
        effect1Toggle.textContent = 'Off';
        sendCC(102, 0);
    }
    effect1Amount.value = preset.effect1.amount;
    document.getElementById('effect1Value').textContent = preset.effect1.amount;
    sendCC(17, preset.effect1.amount);

    // Apply effect 2
    const effect2Toggle = document.getElementById('effect2Toggle');
    const effect2Amount = document.getElementById('effect2Amount');
    if (preset.effect2.toggle) {
        effect2Toggle.classList.add('active');
        effect2Toggle.textContent = 'On';
        sendCC(103, 127);
    } else {
        effect2Toggle.classList.remove('active');
        effect2Toggle.textContent = 'Off';
        sendCC(103, 0);
    }
    effect2Amount.value = preset.effect2.amount;
    document.getElementById('effect2Value').textContent = preset.effect2.amount;
    sendCC(18, preset.effect2.amount);

    // Apply resonance
    const resonanceAmount = document.getElementById('resonanceAmount');
    resonanceAmount.value = preset.resonance;
    document.getElementById('resonanceValue').textContent = preset.resonance;
    sendCC(86, preset.resonance);
}

// Setup preset buttons
document.querySelectorAll('.preset-btn').forEach(button => {
    button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        applyPreset(preset);
    });
});

// Setup device selection
document.getElementById('midiOutput').addEventListener('change', (e) => {
    selectOutput(e.target.value);
});

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '../../';
});

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await initI18n();
    initMIDI();
});
