const { chromium } = require('playwright');

(async () => {
  console.log('camera-check starting');
  const browser = await chromium.launch();
  console.log('browser launched');
  const page = await browser.newPage();
  console.log('new page created');
  await page.goto('http://localhost:5178');
  console.log('navigated to app');
  await page.waitForSelector('#root');
  console.log('root selector found');
  await page.waitForTimeout(1000);
  console.log('waited 1s');

  const getPos = async () =>
    await page.evaluate(() => {
      const viewer = window.__trailforkd_viewer || window.viewer || window.cesiumViewer;
      if (!viewer) return null;
      const c = viewer.camera.positionCartographic;
      return {
        lon: c.longitude,
        lat: c.latitude,
        height: c.height,
      };
    });

  const pos1 = await getPos();
  console.log('pos1 fetched', pos1);
  await page.waitForTimeout(3000);
  console.log('waited 3s');
  const pos2 = await getPos();
  console.log('pos2 fetched', pos2);
  console.log('pos1', pos1);
  console.log('pos2', pos2);
  await browser.close();
  console.log('browser closed');
})();
