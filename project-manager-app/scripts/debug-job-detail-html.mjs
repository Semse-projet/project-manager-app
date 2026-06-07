import { chromium } from '@playwright/test';

const url = process.env.DEBUG_JOB_URL ?? 'http://127.0.0.1:3301/jobs/job_smoke_001';

async function debugJobDetail() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  const html = await page.content();
  console.log('\n=== JOB DETAIL HTML ===');
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
  console.log('\n=== JOB DETAIL HEADINGS ===');
  console.log(JSON.stringify(headings, null, 2));

  const bodyText = await page.locator('body').innerText();
  console.log('\n=== JOB DETAIL BODY TEXT ===');
  console.log(bodyText.slice(0, 2000));

  await browser.close();
}

debugJobDetail().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
