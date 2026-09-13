import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 0x6d2b79f5;
    Math.random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    localStorage.clear();
    localStorage.setItem('cr_anim', 'off');
  });
  await page.goto('/');
  await page.addStyleTag({ content: '#stars { display: none !important; }' });
  await expect(page.locator('#startScreen')).toHaveClass(/active/);
});

test('start screen visual baseline', async ({ page }) => {
  await expect(page).toHaveScreenshot('start-screen.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true
  });
});

test('event modal and action board visual baseline', async ({ page }) => {
  await page.evaluate(() => {
    let state = 0x6d2b79f5;
    Math.random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  });
  await page.locator('#diffEasy').click();
  await expect(page.locator('#eventModal')).toHaveClass(/active/);
  await expect(page).toHaveScreenshot('event-modal.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixels: 1000
  });

  await page.locator('#modalBtn').click();
  await expect(page.locator('#currentPhase')).toHaveText(/行动阶段|Action Phase/);
  await expect(page).toHaveScreenshot('action-board.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixels: 1000
  });
});

test('keyboard focus and reduced-motion contract', async ({ page }, testInfo) => {
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  if (testInfo.project.name === 'reduced-motion') {
    const animationName = await page.evaluate(() => getComputedStyle(document.body, '::before').animationName);
    expect(animationName).toBe('none');
  }
});
