import { test, expect } from './fixtures.js';
import { rmSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HOME = homedir();
// Use a unique parent so test runs don't collide.
function tmpName(label) {
  return `cchub-e2e-mkdir-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.describe('New-session mkdir', () => {
  const created = [];

  test.afterEach(async () => {
    while (created.length) {
      const dir = created.pop();
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test('toolbar button is visible in session modal', async ({ authedPage: page }) => {
    await page.click('#new-session-btn');
    await expect(page.locator('#tree-mkdir-btn')).toBeVisible();
    // And NOT in the project modal
    await page.keyboard.press('Escape');
    await page.click('#new-project-btn', { timeout: 1500 }).catch(() => {});
    // Project modal might not exist on all viewports — if it does, mkdir-btn must be absent.
    const projectModal = page.locator('#new-project-modal');
    if (await projectModal.isVisible().catch(() => false)) {
      await expect(projectModal.locator('.tree-mkdir-btn')).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
  });

  test('creates a folder inline and auto-selects it', async ({ authedPage: page }) => {
    const name = tmpName('basic');
    created.push(join(HOME, name));

    await page.click('#new-session-btn');
    await page.waitForSelector('#tree-root .tree-node', { timeout: 5_000 });
    await page.click('#tree-mkdir-btn');

    const input = page.locator('.tree-row-new input');
    await expect(input).toBeFocused();
    await input.fill(name);
    await input.press('Enter');

    // Real node appears in the root list
    await expect(page.locator(`#tree-root .tree-node[data-path$="/${name}"]`)).toBeVisible({ timeout: 5_000 });

    // Selected reflected in path display
    await expect(page.locator('#tree-selected')).toContainText(name);
  });

  test('Esc cancels the input without creating', async ({ authedPage: page }) => {
    await page.click('#new-session-btn');
    await page.waitForSelector('#tree-root .tree-node', { timeout: 5_000 });
    await page.click('#tree-mkdir-btn');

    const input = page.locator('.tree-row-new input');
    await input.fill('cchub-e2e-should-not-exist-' + Date.now());
    await input.press('Escape');

    await expect(page.locator('.tree-row-new')).toHaveCount(0);
  });

  test('duplicate name shows inline error', async ({ authedPage: page }) => {
    const name = tmpName('dup');
    created.push(join(HOME, name));

    // First creation — succeeds.
    await page.click('#new-session-btn');
    await page.waitForSelector('#tree-root .tree-node', { timeout: 5_000 });
    await page.click('#tree-mkdir-btn');
    await page.locator('.tree-row-new input').fill(name);
    await page.locator('.tree-row-new input').press('Enter');
    await expect(page.locator(`#tree-root .tree-node[data-path$="/${name}"]`)).toBeVisible();

    // Reopen the modal — selection resets, parent is again ~.
    await page.keyboard.press('Escape');
    await page.click('#new-session-btn');
    await page.waitForSelector('#tree-root .tree-node', { timeout: 5_000 });

    // Attempt to create the same name again at the same root → must show error.
    await page.click('#tree-mkdir-btn');
    await page.locator('.tree-row-new input').fill(name);
    await page.locator('.tree-row-new input').press('Enter');

    await expect(page.locator('.tree-row-new.error')).toBeVisible();
    await expect(page.locator('.tree-row-new .tree-mkdir-hint')).not.toBeEmpty();
  });

  test('invalid name shows inline error and does not create', async ({ authedPage: page }) => {
    await page.click('#new-session-btn');
    await page.waitForSelector('#tree-root .tree-node', { timeout: 5_000 });
    await page.click('#tree-mkdir-btn');

    await page.locator('.tree-row-new input').fill('a/b');
    await page.locator('.tree-row-new input').press('Enter');

    await expect(page.locator('.tree-row-new.error')).toBeVisible();
    // Input keeps focus + value
    await expect(page.locator('.tree-row-new input')).toBeFocused();
    await expect(page.locator('.tree-row-new input')).toHaveValue('a/b');
  });
});
