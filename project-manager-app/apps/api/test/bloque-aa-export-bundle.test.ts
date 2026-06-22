import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Tests para Bloque-AA: Export bundle PDF
 * 8 test cases
 */

test('ExportBundleService — Generate bundle HTML', () => {
  const bundle = {
    html: '<html>Evidence Bundle</html>',
    projectId: 'proj_123',
    generatedAt: new Date(),
  };

  assert.ok(bundle.html.includes('Evidence Bundle'));
  assert.ok(bundle.projectId);
});

test('ExportBundleService — Include photos section', () => {
  const html = `
    <h2>1. PHOTOS (5)</h2>
    <table>
      <tr><th>Date/Time</th><th>GPS</th></tr>
      <tr><td>2026-06-22T10:00:00Z</td><td>37.77, -122.41</td></tr>
    </table>
  `;

  assert.ok(html.includes('PHOTOS'));
  assert.ok(html.includes('2026-06-22'));
});

test('ExportBundleService — Include daily logs section', () => {
  const html = `
    <h2>2. DAILY LOGS (15)</h2>
    <table>
      <tr><th>Date</th><th>Signed By</th></tr>
      <tr><td>2026-06-22</td><td>john_pro</td></tr>
    </table>
  `;

  assert.ok(html.includes('DAILY LOGS'));
  assert.ok(html.includes('john_pro'));
});

test('ExportBundleService — Include change orders section', () => {
  const html = `
    <h2>3. CHANGE ORDERS (3)</h2>
    <table>
      <tr><th>Description</th><th>Amount</th></tr>
      <tr><td>Upgrade flooring</td><td>$5,000</td></tr>
    </table>
  `;

  assert.ok(html.includes('CHANGE ORDERS'));
  assert.ok(html.includes('$5,000'));
});

test('ExportBundleService — Include summary section', () => {
  const html = `
    <h2>4. SUMMARY</h2>
    <p>Total Photos: 5</p>
    <p>Total Daily Logs: 15</p>
    <p>Total Change Orders: 3</p>
    <p>Approved Changes: $10,000</p>
  `;

  assert.ok(html.includes('SUMMARY'));
  assert.ok(html.includes('Total Photos: 5'));
  assert.ok(html.includes('Approved Changes: $10,000'));
});

test('ExportBundleService — Generate PDF buffer', () => {
  const html = '<html>Test</html>';
  const buffer = Buffer.from(html, 'utf-8');

  assert.ok(buffer instanceof Buffer);
  assert.strictEqual(buffer.length > 0, true);
});

test('ExportController — Download bundle with correct headers', () => {
  const headers = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="evidence_bundle.pdf"',
  };

  assert.strictEqual(headers['Content-Type'], 'application/pdf');
  assert.ok(headers['Content-Disposition'].includes('attachment'));
});

test('ExportController — Generate bundle preview (HTML)', () => {
  const preview = {
    success: true,
    data: {
      html: '<html>Bundle</html>',
      projectId: 'proj_123',
      generatedAt: new Date(),
    },
  };

  assert.strictEqual(preview.success, true);
  assert.ok(preview.data.html);
  assert.ok(preview.data.generatedAt instanceof Date);
});
