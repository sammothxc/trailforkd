const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5178');
  await page.waitForSelector('.terrainStatus');
  await page.waitForTimeout(2000);
  const status = await page.locator('.terrainStatus').innerText();
  console.log('status:', status);
  await browser.close();
})();
