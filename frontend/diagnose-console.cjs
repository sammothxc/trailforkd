const { chromium } = require('playwright');
const http = require('http');

const tryPorts = [5173, 5174, 5175, 5176, 5177, 5178];

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        method: 'HEAD',
        timeout: 1500,
        path: '/',
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function findLiveUrl() {
  for (const port of tryPorts) {
    const ok = await checkPort(port);
    if (ok) return `http://localhost:${port}`;
  }
  return null;
}

(async () => {
  const url = await findLiveUrl();
  if (!url) {
    console.error('No running dev server found on known ports');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error('NAVIGATION FAILED', err);
  }

  await browser.close();
})();
