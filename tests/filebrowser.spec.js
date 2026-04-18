import { test, expect } from './fixtures.js';
import { navigateToSession, waitForTerminal, getToken, openFileSidebar } from './helpers.js';
import { readFileSync } from 'fs';

// Filebrowser tests use the always-running cc-claude-code-hub session
// because the file API requires a registered project (projectId).
test.describe('Filebrowser', () => {
  let sessionName;

  test.beforeEach(async ({ authedPage: page, projectSession }) => {
    sessionName = projectSession.name;
    await page.click('#refresh-btn');
    await navigateToSession(page, sessionName);
    await waitForTerminal(page);
  });

  test('sidebar opens and closes via toggle', async ({ authedPage: page, isTouch }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    const btnVisible = await toggleBtn.isVisible();
    if (!btnVisible) {
      test.skip(true, 'file toggle not visible (no project context)');
      return;
    }

    const sidebar = page.locator('#files-sidebar');
    const wasOpen = await sidebar.evaluate(el => el.classList.contains('open'));

    if (wasOpen) {
      await page.click('#files-close');
      await expect(sidebar).not.toHaveClass(/open/, { timeout: 3_000 });
    }

    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/open/, { timeout: 5_000 });

    await page.click('#files-close');
    await expect(sidebar).not.toHaveClass(/open/, { timeout: 3_000 });
  });

  test('file tree loads and shows entries', async ({ authedPage: page }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const rows = page.locator('#files-tree .file-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('folder expand loads children (lazy)', async ({ authedPage: page }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const dirRow = page.locator('#files-tree .file-row[data-type="dir"]').first();
    if (!(await dirRow.count())) {
      test.skip(true, 'no directories in tree');
      return;
    }

    const wasExpanded = await dirRow.evaluate(el => el.classList.contains('expanded'));
    if (wasExpanded) {
      await dirRow.click();
      await expect(dirRow).not.toHaveClass(/expanded/, { timeout: 3_000 });
    }

    await dirRow.click();
    await expect(dirRow).toHaveClass(/expanded/, { timeout: 5_000 });
  });

  test('mkdir creates folder via toolbar', async ({ authedPage: page, projectSession }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const folderName = `e2e-mkdir-${Date.now()}`;
    page.once('dialog', d => d.accept(folderName));
    await page.click('#files-mkdir');

    const newRow = page.locator(`#files-tree .file-row[data-path="${folderName}"]`);
    await newRow.waitFor({ timeout: 10_000 });
    await expect(newRow).toBeVisible();

    // Cleanup: delete created folder via API
    const token = await getToken(page);
    await page.request.delete(`/api/projects/${projectSession.projectId}/files`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { paths: [folderName] },
    }).catch(() => {});
  });

  test('context menu rename works', async ({ authedPage: page, projectSession, isTouch }) => {
    test.skip(isTouch, 'context menu requires right-click, not available on touch devices');
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);

    const origName = `e2e-rename-${Date.now()}`;
    page.once('dialog', d => d.accept(origName));
    await page.click('#files-mkdir');
    const row = page.locator(`#files-tree .file-row[data-path="${origName}"]`);
    await row.waitFor({ timeout: 10_000 });

    let newName;
    try {
      await row.click({ button: 'right' });
      const menu = page.locator('.cchub-contextmenu');
      await menu.waitFor({ timeout: 3_000 });
      await menu.locator('button', { hasText: /Rename|Umbenennen/i }).click();

      const input = row.locator('.rename-input');
      await input.waitFor({ timeout: 3_000 });
      newName = `e2e-renamed-${Date.now()}`;
      await input.fill(newName);
      await input.press('Enter');

      const renamedRow = page.locator(`#files-tree .file-row[data-path="${newName}"]`);
      await renamedRow.waitFor({ timeout: 5_000 });
      await expect(renamedRow).toBeVisible();
    } finally {
      // Cleanup: remove whichever name ended up on disk
      const token = await getToken(page);
      const namesToTry = [newName, origName].filter(Boolean);
      for (const n of namesToTry) {
        await page.request.delete(`/api/projects/${projectSession.projectId}/files`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { paths: [n] },
        }).catch(() => {});
      }
    }
  });

  test('context menu delete with two-click confirm', async ({ authedPage: page, projectSession, isTouch }) => {
    test.skip(isTouch, 'context menu requires right-click, not available on touch devices');
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);

    const folderName = `e2e-delete-${Date.now()}`;
    page.once('dialog', d => d.accept(folderName));
    await page.click('#files-mkdir');
    const row = page.locator(`#files-tree .file-row[data-path="${folderName}"]`);
    await row.waitFor({ timeout: 10_000 });

    await row.click({ button: 'right' });
    const menu = page.locator('.cchub-contextmenu');
    await menu.waitFor({ timeout: 3_000 });
    await menu.locator('button', { hasText: /Move to Trash|In Papierkorb/i }).click();
    await page.waitForTimeout(200);

    await expect(row).toHaveClass(/pending-delete/, { timeout: 5_000 });
    await page.waitForTimeout(200);
    await row.click();
    await expect(row).not.toBeAttached({ timeout: 5_000 });
    // Folder is in Trash — no extra API cleanup needed
  });

  test('context menu copy path', async ({ authedPage: page, isTouch }) => {
    test.skip(isTouch, 'context menu requires right-click, not available on touch devices');
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const firstRow = page.locator('#files-tree .file-row').first();
    await firstRow.click({ button: 'right' });
    const menu = page.locator('.cchub-contextmenu');
    await menu.waitFor({ timeout: 3_000 });
    const copyPathBtn = menu.locator('button', { hasText: /Copy Path|Pfad/i });
    if (await copyPathBtn.count() > 0) {
      await copyPathBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('refresh button reloads tree', async ({ authedPage: page }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const countBefore = await page.locator('#files-tree .file-row').count();
    await page.click('#files-refresh');
    await page.waitForTimeout(1_000);
    const countAfter = await page.locator('#files-tree .file-row').count();
    expect(countAfter).toBeGreaterThan(0);
  });

  test('sidebar state persists after reload', async ({ authedPage: page }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);

    await page.reload();
    await page.waitForSelector('body[data-current-view]', { timeout: 10_000 });
    if (await page.locator('body').getAttribute('data-current-view') === 'dashboard') {
      await navigateToSession(page, sessionName);
      await waitForTerminal(page);
    }

    await page.waitForTimeout(2_000);
    const sidebar = page.locator('#files-sidebar');
    const isOpen = await sidebar.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(true);
  });

  test('sidebar resize via drag handle', async ({ authedPage: page, isTouch }) => {
    test.skip(isTouch, 'drag resize not available on touch devices');

    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    const handle = page.locator('#files-resizer, .files-resizer, .files-sidebar-handle, .resize-handle');
    if (await handle.count() === 0) {
      test.skip(true, 'no resize handle found');
      return;
    }

    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  });

  test('upload file picker button exists', async ({ authedPage: page }) => {
    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    await openFileSidebar(page);
    await expect(page.locator('#files-upload-picker')).toBeVisible();
  });

  test('downloads a file via context menu', async ({ authedPage: page, projectSession, isTouch }) => {
    test.skip(isTouch, 'context menu requires right-click, not available on touch devices');

    const toggleBtn = page.locator('#btn-toggle-files');
    if (!(await toggleBtn.isVisible())) {
      test.skip(true, 'file toggle not visible');
      return;
    }

    // Seed a known file via the upload API so we can assert its content after download
    const fileName = `e2e-download-${Date.now()}.txt`;
    const fileContent = `Hello from Playwright download test! (${Date.now()})`;
    const token = await getToken(page);

    const formData = new FormData();
    formData.append('file', new Blob([fileContent], { type: 'text/plain' }), fileName);

    const uploadRes = await page.request.post(
      `/api/projects/${projectSession.projectId}/files/upload`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: fileName,
            mimeType: 'text/plain',
            buffer: Buffer.from(fileContent),
          },
        },
      }
    );
    expect(uploadRes.ok(), `Upload failed: ${uploadRes.status()}`).toBeTruthy();

    try {
      await openFileSidebar(page);

      // Refresh tree to ensure the new file is visible
      await page.click('#files-refresh');
      await page.waitForTimeout(1_000);

      const fileRow = page.locator(`#files-tree .file-row[data-path="${fileName}"]`);
      await fileRow.waitFor({ timeout: 8_000 });
      await expect(fileRow).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        (async () => {
          await fileRow.click({ button: 'right' });
          const menu = page.locator('.cchub-contextmenu');
          await menu.waitFor({ timeout: 3_000 });
          await menu.locator('button', { hasText: /download/i }).click();
        })(),
      ]);

      const downloadPath = await download.path();
      const downloadedContent = readFileSync(downloadPath, 'utf8');
      expect(downloadedContent).toBe(fileContent);
    } finally {
      // Cleanup: delete the seeded file
      await page.request.delete(`/api/projects/${projectSession.projectId}/files`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { paths: [fileName] },
      }).catch(() => {});
    }
  });
});
