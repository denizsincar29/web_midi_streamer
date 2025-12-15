const { test, expect } = require('@playwright/test');

test.describe('Web MIDI Streamer Basic Tests', () => {
    test('should load the homepage', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Check title
        await expect(page).toHaveTitle(/Web MIDI Streamer/);
        
        // Check main heading
        const heading = page.locator('h1');
        await expect(heading).toContainText('Web MIDI Streamer');
    });
    
    test('should display room name from URL parameter', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=testroom');
        
        // Check room display
        const roomDisplay = page.locator('text=Room: testroom');
        await expect(roomDisplay).toBeVisible();
    });
    
    test('should show warning when no room specified', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        
        // Connect button should be disabled
        const connectBtn = page.locator('#connectBtn');
        await expect(connectBtn).toBeDisabled();
        
        // Should show warning message
        await expect(page.locator('text=/No room specified/')).toBeVisible();
    });
    
    test('should have all main sections', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Check for main sections
        await expect(page.locator('text=Settings')).toBeVisible();
        await expect(page.locator('text=MIDI Devices')).toBeVisible();
        await expect(page.locator('text=Connection')).toBeVisible();
        await expect(page.locator('text=Debug Tools')).toBeVisible();
        await expect(page.locator('text=Messages')).toBeVisible();
    });
    
    test('should have collapsible sections', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Debug Tools should be collapsed by default
        const debugDetails = page.locator('details.debug');
        await expect(debugDetails).not.toHaveAttribute('open');
        
        // Messages should be expanded by default
        const messagesDetails = page.locator('details.messages');
        await expect(messagesDetails).toHaveAttribute('open');
    });
    
    test('should expand/collapse debug tools', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        const debugDetails = page.locator('details.debug');
        const debugSummary = debugDetails.locator('summary');
        
        // Initially collapsed
        await expect(debugDetails).not.toHaveAttribute('open');
        
        // Click to expand
        await debugSummary.click();
        await expect(debugDetails).toHaveAttribute('open');
        
        // Click again to collapse
        await debugSummary.click();
        await expect(debugDetails).not.toHaveAttribute('open');
    });
    
    test('should have all checkboxes', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Check for all setting checkboxes
        await expect(page.locator('#sysexEnabled')).toBeVisible();
        await expect(page.locator('#timestampEnabled')).toBeVisible();
        await expect(page.locator('#audioFeedbackEnabled')).toBeVisible();
        await expect(page.locator('#showMidiActivity')).toBeVisible();
    });
    
    test('should have debug buttons disabled initially', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Expand debug section
        await page.locator('details.debug summary').click();
        
        // Debug buttons should be disabled (no data channel yet)
        await expect(page.locator('#sendTestNoteBtn')).toBeDisabled();
        await expect(page.locator('#sendPingBtn')).toBeDisabled();
    });
    
    test('should display connection status', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Status should show disconnected initially
        await expect(page.locator('text=/Status:.*Disconnected/i')).toBeVisible();
    });
});

test.describe('Web MIDI Streamer Connection Tests', () => {
    test('should connect to signaling server', async ({ page }) => {
        // Start server first if not running
        await page.goto('http://localhost:8000/?room=test');
        
        // Click connect button
        await page.locator('#connectBtn').click();
        
        // Wait for connection message
        await expect(page.locator('text=/Connected to signaling server/i')).toBeVisible({ timeout: 10000 });
        
        // Status should update
        await expect(page.locator('text=/Status:.*Connected/i')).toBeVisible();
    });
});

test.describe('Web MIDI Streamer Accessibility Tests', () => {
    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Check ARIA live region for messages
        const messageLog = page.locator('#messageLog');
        await expect(messageLog).toHaveAttribute('role', 'log');
        await expect(messageLog).toHaveAttribute('aria-live', 'polite');
    });
    
    test('should hide timestamps from screen readers', async ({ page }) => {
        await page.goto('http://localhost:8000/?room=test');
        
        // Connect to generate some messages
        await page.locator('#connectBtn').click();
        await page.waitForTimeout(2000);
        
        // Expand messages section if collapsed
        const messagesDetails = page.locator('details.messages');
        if (!(await messagesDetails.getAttribute('open'))) {
            await messagesDetails.locator('summary').click();
        }
        
        // Check that timestamps have aria-hidden
        const timestamps = page.locator('.message-timestamp');
        const count = await timestamps.count();
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                await expect(timestamps.nth(i)).toHaveAttribute('aria-hidden', 'true');
            }
        }
    });
});
