# Web MIDI Streamer Tests

This directory contains Playwright tests for the Web MIDI Streamer application.

## Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Debug tests
```bash
npm run test:debug
```

### Run tests with UI mode
```bash
npm run test:ui
```

### Run specific test file
```bash
npx playwright test tests/test_basic.spec.js
```

## Test Coverage

- **Basic Tests**: Page loading, UI elements, collapsible sections
- **Connection Tests**: WebSocket signaling server connection
- **Accessibility Tests**: ARIA labels, screen reader support

## Notes

- The Playwright config automatically starts the server before running tests
- Tests run in both Chromium and Firefox by default
- Screenshots are captured on test failures
- Traces are recorded on first retry for debugging
