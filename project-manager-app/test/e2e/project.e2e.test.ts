import { test } from 'node:test';
import * as assert from 'node:assert';

const API_URL = 'http://localhost:3000/v1';

test('E2E: Complete project workflow', async () => {
  // 1. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'user@test.com', password: 'password' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(loginRes.status, 200);
  const { token } = await loginRes.json();
  assert.ok(token);

  // 2. Create project
  const projectRes = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E Test Project',
      budget: 500000,
      address: 'San Francisco, CA 94105',
    }),
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(projectRes.status, 201);
  const { id: projectId } = await projectRes.json();

  // 3. Create lien calendar
  const lienRes = await fetch(`${API_URL}/projects/${projectId}/liens/calendar`, {
    method: 'POST',
    body: JSON.stringify({ state: 'CA' }),
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(lienRes.status, 201);

  // 4. Create draw
  const drawRes = await fetch(`${API_URL}/projects/${projectId}/draws`, {
    method: 'POST',
    body: JSON.stringify({ amount: 100000, drawNumber: 1 }),
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(drawRes.status, 201);
  const { id: drawId } = await drawRes.json();

  // 5. Submit draw
  const submitRes = await fetch(`${API_URL}/projects/${projectId}/draws/${drawId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(submitRes.status, 200);

  // 6. Approve draw (lender)
  const approveRes = await fetch(`${API_URL}/projects/${projectId}/draws/${drawId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Lender-Role': 'true' },
  });
  assert.strictEqual(approveRes.status, 200);

  // 7. Fund draw
  const fundRes = await fetch(`${API_URL}/projects/${projectId}/draws/${drawId}/fund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(fundRes.status, 200);

  // 8. Get analytics
  const analyticsRes = await fetch(`${API_URL}/projects/${projectId}/analytics/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(analyticsRes.status, 200);
  const analytics = await analyticsRes.json();
  assert.ok(analytics.burnRate > 0);

  console.log('✅ E2E workflow complete');
});

test('E2E: Lien payment gate', async () => {
  const token = 'test-token';
  const projectId = 'test-project-id';

  // Check payment gate
  const gateRes = await fetch(`${API_URL}/projects/${projectId}/liens/payment-gate`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.ok([200, 400].includes(gateRes.status));
});

test('E2E: Weather alert workflow', async () => {
  const token = 'test-token';
  const projectId = 'test-project-id';

  // Get weather alerts
  const alertRes = await fetch(`${API_URL}/projects/${projectId}/weather/alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.ok([200, 404].includes(alertRes.status));
});
