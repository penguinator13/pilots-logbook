// Real-browser regression: horizontal overflow alone misses crushed checkbox text.
// Run in a Playwright-equipped environment: BASE_URL=http://preview:port node this-file.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const base = process.env.BASE_URL || 'http://172.19.0.1:3999';
  const css = await Promise.all(['styles.css', 'cockpit.css', 'aircraft-profiles.css'].map(async name => {
    const response = await fetch(`${base}/css/${name}`);
    assert.equal(response.status, 200);
    return response.text();
  }));
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    for (const theme of ['cockpit', 'original']) for (const colorScheme of ['light', 'dark']) for (const width of [390, 768, 1400]) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 1000 });
      await page.setContent(`<html data-appearance="${theme}"><head><style>${css.join('\n')}</style></head><body><section class="profile-settings" style="max-width:700px;margin:auto;padding:16px"><fieldset class="aircraft-reference"><legend>ICAO aircraft reference (optional)</legend><label class="profile-checkbox"><input type="checkbox" id="referenceAll"> All aircraft (helicopters only by default)</label></fieldset></section></body></html>`);
      const dimensions = await page.evaluate(() => {
        const label = document.querySelector('.profile-checkbox');
        const input = document.querySelector('#referenceAll');
        return { labelHeight: label.getBoundingClientRect().height, checkboxWidth: input.getBoundingClientRect().width, checkboxHeight: input.getBoundingClientRect().height, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
      });
      console.log(JSON.stringify({ theme, colorScheme, width, ...dimensions }));
      assert(dimensions.labelHeight <= 100, 'Checkbox label must remain a short readable horizontal row, not a vertical character column');
      assert(dimensions.checkboxWidth >= 16 && dimensions.checkboxWidth <= 24, 'Checkbox must not expand to full fieldset width');
      assert(dimensions.scrollWidth <= dimensions.viewport + 1, 'No horizontal page overflow');
      results.push({ theme, colorScheme, width });
    }
    console.log(`Reference checkbox layout passed ${results.length} theme/viewport combinations`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
