import { test, expect } from '@playwright/test';

// Smoke test für Shift+Drag → Auto-Copy.
// Erstellt eine Wegwerf-Session, schreibt bekannte Zeichen rein, macht Shift+Drag
// per Playwright-Mouse-API, liest `navigator.clipboard.readText()` aus.

test.describe('Terminal copy/paste', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  test('Shift+Drag kopiert sichtbaren Text ins Clipboard', async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    page.on('console', (msg) => console.log('[page]', msg.type(), msg.text()));

    await page.goto('/');
    await page.waitForSelector('body[data-current-view="dashboard"]');

    // Test-Session via API anlegen (Cleanup am Ende)
    const name = `copytest-${Date.now()}`;
    const token = await page.evaluate(() => localStorage.getItem('cchub_token'));
    const createRes = await page.request.post('/api/sessions', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, directory: process.env.HOME, command: 'bash --noprofile --norc' },
    });
    expect(createRes.ok()).toBeTruthy();

    try {
      // Session-Card klicken statt ID raten
      await page.click(`[data-session-name="cc-${name}"]`, { timeout: 5000 }).catch(async () => {
        // Fallback: Session-Name steht als Text im Card-Title
        await page.waitForTimeout(500);
        await page.getByText(name, { exact: true }).first().click();
      });

      await page.waitForSelector('body[data-current-view="terminal"]');
      await page.waitForSelector('#terminal-container .xterm-screen', { timeout: 5000 });
      await page.waitForTimeout(800);

      // Direkt in den xterm-Buffer schreiben statt via bash-Echo — bypasst
      // alle Timing-/Focus-/PTY-Probleme und testet nur unseren Selection-Code.
      const marker = 'HELLO-CCHUB-COPY-TEST-123';
      await page.evaluate((m) => {
        window.__cchubTerm.clear();
        window.__cchubTerm.write(m);
      }, marker);
      await page.waitForTimeout(200);

      // Bounding-Box der xterm-Screen finden, per Shift+Drag über dem Marker
      const screen = page.locator('#terminal-container .xterm-screen');
      const box = await screen.boundingBox();
      expect(box).toBeTruthy();

      // Wir wissen nicht genau wo der Marker steht (prompt variiert). Nehmen
      // einfach die gesamte erste Zeile: y ≈ box.y + charHeight/2, x von
      // box.x bis box.x + box.width.
      const charHeight = box.height / 24;  // grobe Schätzung
      const y = box.y + charHeight * 0.5;

      await page.keyboard.down('Shift');
      await page.mouse.move(box.x + 5, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 10, y, { steps: 10 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(300);

      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
      console.log('clipboard after shift-drag:', JSON.stringify(clip));
      expect(clip).toContain(marker);

      // Paste-Test: Clipboard setzen, Cmd+V → term.paste() muss gerufen werden
      await page.evaluate(() => {
        window.__pasteLog = [];
        const orig = window.__cchubTerm.paste.bind(window.__cchubTerm);
        window.__cchubTerm.paste = (t) => { window.__pasteLog.push(t); return orig(t); };
      });
      const pasteMarker = 'PASTED-TEXT-456';
      await page.evaluate(async (t) => {
        await navigator.clipboard.writeText(t);
      }, pasteMarker);
      // Fokus auf Terminal (helper-textarea)
      await page.locator('#terminal-container').click({ position: { x: 200, y: 100 } });
      await page.waitForTimeout(100);
      const isMac = process.platform === 'darwin';
      await page.keyboard.press(isMac ? 'Meta+v' : 'Control+v');
      await page.waitForTimeout(300);
      const pasteLog = await page.evaluate(() => window.__pasteLog || []);
      console.log('paste log:', pasteLog);
      expect(pasteLog.some((t) => t.includes(pasteMarker))).toBeTruthy();
    } finally {
      await page.request.delete(`/api/sessions/cc-${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    expect(errors.map(String)).toEqual([]);
  });
});
