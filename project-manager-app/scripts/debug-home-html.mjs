import { chromium } from '@playwright/test';

const url = process.env.DEBUG_HOME_URL ?? 'http://127.0.0.1:3301';

async function debugHome() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  const html = await page.content();
  console.log('\n=== HTML COMPLETO ===');
  console.log(html.slice(0, 8000));

  const headings = await page.$$eval('h1, h2, h3, h4', (els) =>
    els.map((el) => ({
      tag: el.tagName,
      text: el.textContent?.trim(),
      visible: el instanceof HTMLElement ? el.offsetParent !== null : true,
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      className: el.getAttribute('class')
    }))
  );
  console.log('\n=== HEADINGS EN DOM ===');
  console.log(JSON.stringify(headings, null, 2));

  const smokeString = 'Flujo visible principal del MVP';
  const found = await page.$$eval('*', (els, str) =>
    els
      .filter((el) => (el.textContent ?? '').includes(str))
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent ?? '').trim().slice(0, 200),
        className: el.getAttribute('class'),
        role: el.getAttribute('role')
      })),
    smokeString
  );
  console.log('\n=== ELEMENTOS CON EL STRING DEL SMOKE ===');
  console.log(JSON.stringify(found, null, 2));

  await browser.close();
}

debugHome().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
