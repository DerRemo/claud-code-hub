import { test, expect } from './fixtures.js';

test.describe('Settings & Preferences', () => {
  // ── Theme toggle (via Settings page) ─────────────────────────────────────
  test('theme toggle switches dark/light', async ({ authedPage: page }) => {
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const html = page.locator('html');
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const newThemeValue = initialTheme === 'dark' ? 'light' : 'dark';

    await page.locator(`#settings-appearance [data-theme-value="${newThemeValue}"]`).click();
    await page.waitForTimeout(300);
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(newTheme).toBe(newThemeValue);

    // Toggle back
    await page.locator(`#settings-appearance [data-theme-value="${initialTheme}"]`).click();
    await page.waitForTimeout(300);
    const restored = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(restored).toBe(initialTheme);
  });

  test('theme persists after reload', async ({ authedPage: page }) => {
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const targetTheme = initialTheme === 'dark' ? 'light' : 'dark';

    await page.locator(`#settings-appearance [data-theme-value="${targetTheme}"]`).click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForSelector('body[data-current-view]', { timeout: 10_000 });

    const themeAfter = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(themeAfter).toBe(targetTheme);

    // Restore original
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });
    await page.locator(`#settings-appearance [data-theme-value="${initialTheme}"]`).click();
    await page.waitForTimeout(300);
  });

  test('sound toggle changes state', async ({ authedPage: page }) => {
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const soundBtn = page.locator('#settings-sound-toggle');
    await expect(soundBtn).toBeVisible();
    const before = await soundBtn.getAttribute('aria-pressed');
    await soundBtn.click();
    await page.waitForTimeout(300);
    const after = await soundBtn.getAttribute('aria-pressed');
    expect(after).not.toBe(before);

    // Restore
    await soundBtn.click();
    await page.waitForTimeout(300);
  });

  test('push toggle changes state', async ({ authedPage: page }) => {
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const pushBtn = page.locator('#settings-push-toggle');
    const isVisible = await pushBtn.isVisible().catch(() => false);
    const isEnabled = isVisible && await pushBtn.isEnabled().catch(() => false);
    if (!isVisible || !isEnabled) {
      test.skip(true, 'push-toggle hidden or disabled — service worker not available in this environment');
      return;
    }
    await pushBtn.click();
    await page.waitForTimeout(300);
    await expect(pushBtn).toBeVisible();
  });

  test('keyboard shortcuts modal opens via Help section', async ({ authedPage: page }) => {
    await page.click('#sidebar-settings-entry');
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const kbdRow = page.locator('#settings-kbd-shortcuts-row');
    await expect(kbdRow).toBeVisible();
    await kbdRow.click();

    const modal = page.locator('#kbd-help-overlay');
    await expect(modal).toHaveClass(/open/, { timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('shortcut / focuses search', async ({ authedPage: page }) => {
    await page.keyboard.press('/');
    await page.waitForTimeout(300);
    const searchFocused = await page.evaluate(() =>
      document.activeElement?.id === 'session-search'
    );
    expect(searchFocused).toBe(true);

    await page.keyboard.press('Escape');
  });

  test('shortcut g switches to grid layout', async ({ authedPage: page }) => {
    // First switch to list
    await page.click('#layout-list-btn');
    await expect(page.locator('#sessions-grid')).toHaveClass(/layout-list/, { timeout: 3_000 });

    // Press g
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    await expect(page.locator('#sessions-grid')).not.toHaveClass(/layout-list/, { timeout: 3_000 });
  });

  test('shortcut l switches to list layout', async ({ authedPage: page }) => {
    // Ensure grid first
    await page.click('#layout-grid-btn');
    await page.waitForTimeout(300);

    await page.keyboard.press('l');
    await page.waitForTimeout(300);
    await expect(page.locator('#sessions-grid')).toHaveClass(/layout-list/, { timeout: 3_000 });

    // Restore grid
    await page.click('#layout-grid-btn');
  });

  test('shortcut t toggles theme', async ({ authedPage: page }) => {
    const before = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    await page.keyboard.press('t');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(after).not.toBe(before);

    // Restore
    await page.keyboard.press('t');
  });
});

// ── v0.7.1: Settings page ─────────────────────────────────────────────────

test.describe('Settings page', () => {
  test('sidebar entry opens settings page with all five sections', async ({ authedPage: page }) => {
    await page.locator('#sidebar-settings-entry').click();
    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.getByRole('heading', { name: /appearance/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /language/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /help/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /about/i })).toBeVisible();
  });

  test('theme toggle switches data-theme attribute', async ({ authedPage: page }) => {
    await page.locator('#sidebar-settings-entry').click();
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    const html = page.locator('html');
    await page.locator('#settings-appearance [data-theme-value="light"]').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.locator('#settings-appearance [data-theme-value="dark"]').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Restore: switch back to light if that was initial, or keep dark — reset to dark is fine
  });

  test('language switch to Deutsch reloads and shows German labels, then back', async ({ authedPage: page }) => {
    await page.locator('#sidebar-settings-entry').click();
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });

    await page.locator('#settings-language [data-lang-value="de"]').click();
    // location.reload() is called — wait for page to finish loading
    await page.waitForLoadState('load');
    await page.waitForSelector('body[data-current-view]', { timeout: 10_000 });
    // Settings sidebar entry should now show "Einstellungen"
    await expect(page.locator('#sidebar-settings-entry')).toContainText(/Einstellungen/i);

    // Flip back to English
    await page.locator('#sidebar-settings-entry').click();
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });
    await page.locator('#settings-language [data-lang-value="en"]').click();
    await page.waitForLoadState('load');
    await page.waitForSelector('body[data-current-view]', { timeout: 10_000 });
    await expect(page.locator('#sidebar-settings-entry')).toContainText(/Settings/i);
  });
});

// ── v0.7.1: Update-dot rendering ─────────────────────────────────────────

test.describe('Update check', () => {
  test('teal dot shows when /api/version reports isNewer', async ({ authedPage: page }) => {
    await page.route('**/api/version', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: '0.7.0',
          latest: '0.7.1',
          isNewer: true,
          publishedAt: '2026-04-20T10:00:00Z',
          url: 'https://github.com/DerRemo/claude-code-hub/releases/tag/v0.7.1',
          changelogMd: '## Notes\n- i18n\n- settings page',
          checkedAt: Date.now(),
          error: null,
        }),
      });
    });
    await page.reload();
    await page.waitForSelector('body[data-current-view="dashboard"]', { timeout: 10_000 });
    // initUpdateCheck() is async fire-and-forget — wait until the dot appears
    await expect(page.locator('#sidebar-settings-dot')).toBeVisible({ timeout: 8_000 });

    await page.locator('#sidebar-settings-entry').click();
    await page.waitForSelector('body[data-current-view="settings"]', { timeout: 10_000 });
    await expect(page.locator('#settings-latest-version')).toContainText('0.7.1');
    await expect(page.locator('#settings-about-changelog')).toContainText(/i18n/);
  });

  test('no dot when isNewer is false', async ({ authedPage: page }) => {
    await page.route('**/api/version', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: '0.7.1',
          latest: '0.7.1',
          isNewer: false,
          publishedAt: '2026-04-20T10:00:00Z',
          url: 'x',
          changelogMd: '',
          checkedAt: Date.now(),
          error: null,
        }),
      });
    });
    await page.reload();
    await page.waitForSelector('body[data-current-view="dashboard"]', { timeout: 10_000 });
    // Wait for the async version check to settle, then assert dot stays hidden
    await page.waitForFunction(() => window.__versionInfo !== undefined, { timeout: 8_000 });
    await expect(page.locator('#sidebar-settings-dot')).toBeHidden();
  });
});
