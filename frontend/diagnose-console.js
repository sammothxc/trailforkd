const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error('NAVIGATION FAILED', err);
  }

  await browser.close();
})();
