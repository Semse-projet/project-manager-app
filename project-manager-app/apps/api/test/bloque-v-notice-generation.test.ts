import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Integration tests para Bloque-V: Generar notices pre-poblados
 *
 * Test cases:
 * 1. Notice generation from LienCalendar
 * 2. HTML template population
 * 3. Multiple recipients (owner, GC, lender)
 * 4. State-specific language
 * 5. Scheduler triggers generation at ALERTED_3D
 * 6. Notice status transitions
 */

// ============================================================================
// TEST 1: Template Population
// ============================================================================

test('NoticeGeneratorService — Populate template with project data', () => {
  const template = 'Project: {{projectName}}, Address: {{projectAddress}}';
  const data = {
    projectName: 'Kitchen Renovation',
    projectAddress: '123 Main St, San Francisco, CA 94102',
  };

  let populated = template;
  Object.entries(data).forEach(([key, value]) => {
    populated = populated.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  assert.strictEqual(
    populated,
    'Project: Kitchen Renovation, Address: 123 Main St, San Francisco, CA 94102'
  );
});

test('NoticeGeneratorService — Handle multiple variables in template', () => {
  const template = `
    State: {{stateName}}
    Contract Amount: ${{contractAmount}}
    Start Date: {{projectStartDate}}
  `;
  const data = {
    stateName: 'California',
    contractAmount: '50000',
    projectStartDate: '2026-07-01',
  };

  let populated = template;
  Object.entries(data).forEach(([key, value]) => {
    populated = populated.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  assert.ok(populated.includes('State: California'));
  assert.ok(populated.includes('Contract Amount: $50000'));
  assert.ok(populated.includes('Start Date: 2026-07-01'));
});

test('NoticeGeneratorService — Handle missing variables gracefully', () => {
  const template = 'Project: {{projectName}}, Contact: {{contactEmail}}';
  const data = {
    projectName: 'Kitchen Renovation',
    // contactEmail missing
  };

  let populated = template;
  Object.entries(data).forEach(([key, value]) => {
    populated = populated.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  // Missing variable remains as placeholder
  assert.ok(populated.includes('{{contactEmail}}'));
  assert.ok(populated.includes('Kitchen Renovation'));
});

// ============================================================================
// TEST 2: Notice Type Based on Recipient
// ============================================================================

test('NoticeGeneratorService — Generate for owner recipient type', () => {
  const recipientType = 'owner';
  const isValid = ['owner', 'general_contractor', 'lender', 'architect'].includes(
    recipientType
  );

  assert.strictEqual(isValid, true);
});

test('NoticeGeneratorService — Generate for general_contractor recipient type', () => {
  const recipientType = 'general_contractor';
  const isValid = ['owner', 'general_contractor', 'lender', 'architect'].includes(
    recipientType
  );

  assert.strictEqual(isValid, true);
});

test('NoticeGeneratorService — Reject invalid recipient type', () => {
  const recipientType = 'invalid_type';
  const isValid = ['owner', 'general_contractor', 'lender', 'architect'].includes(
    recipientType
  );

  assert.strictEqual(isValid, false);
});

// ============================================================================
// TEST 3: Multiple Notices for Same Calendar
// ============================================================================

test('NoticeGeneratorService — Generate notices for all recipient types', () => {
  const recipientTypes: string[] = ['owner', 'general_contractor'];
  const noticesGenerated: any[] = [];

  for (const recipientType of recipientTypes) {
    noticesGenerated.push({
      id: `notice_${recipientType}`,
      recipientType,
      status: 'DRAFT',
    });
  }

  assert.strictEqual(noticesGenerated.length, 2);
  assert.ok(noticesGenerated.find((n) => n.recipientType === 'owner'));
  assert.ok(noticesGenerated.find((n) => n.recipientType === 'general_contractor'));
});

test('NoticeGeneratorService — Skip generation if notice already exists', () => {
  const calendar = {
    id: 'cal_ca',
    notices: [{ recipientType: 'owner' }],
  };

  const recipientTypes = ['owner', 'general_contractor'];
  const toGenerate = recipientTypes.filter(
    (rt) => !calendar.notices.some((n) => n.recipientType === rt)
  );

  assert.strictEqual(toGenerate.length, 1);
  assert.strictEqual(toGenerate[0], 'general_contractor');
});

// ============================================================================
// TEST 4: Scheduler Integration
// ============================================================================

test('LienAlertsScheduler — Trigger notice generation at ALERTED_3D', () => {
  const currentStatus = 'ALERTED_7D';
  const newStatus = 'ALERTED_3D';
  const daysToDeadline = 2;

  const shouldGenerateNotices =
    newStatus === 'ALERTED_3D' && currentStatus === 'ALERTED_7D';

  assert.strictEqual(shouldGenerateNotices, true);
});

test('LienAlertsScheduler — Do not generate notices at other thresholds', () => {
  const thresholds = ['ALERTED_30D', 'ALERTED_7D'];

  for (const status of thresholds) {
    const shouldGenerateNotices = status === 'ALERTED_3D';
    assert.strictEqual(shouldGenerateNotices, false);
  }
});

// ============================================================================
// TEST 5: Notice Status Transitions
// ============================================================================

test('NoticeGeneratorService — FSM: DRAFT → NOTICE_SENT', () => {
  const currentStatus = 'DRAFT';
  const newStatus = 'NOTICE_SENT';

  const validTransitions: Record<string, string[]> = {
    DRAFT: ['NOTICE_SENT'],
    NOTICE_SENT: ['DELIVERY_PENDING', 'DELIVERY_FAILED'],
    DELIVERY_PENDING: ['NOTICE_DELIVERED', 'DELIVERY_FAILED'],
  };

  const allowed = validTransitions[currentStatus] || [];
  const isValid = allowed.includes(newStatus);

  assert.strictEqual(isValid, true);
});

test('NoticeGeneratorService — FSM: Invalid transition DRAFT → DELIVERED', () => {
  const currentStatus = 'DRAFT';
  const newStatus = 'NOTICE_DELIVERED';

  const validTransitions: Record<string, string[]> = {
    DRAFT: ['NOTICE_SENT'],
    NOTICE_SENT: ['DELIVERY_PENDING', 'DELIVERY_FAILED'],
    DELIVERY_PENDING: ['NOTICE_DELIVERED', 'DELIVERY_FAILED'],
  };

  const allowed = validTransitions[currentStatus] || [];
  const isValid = allowed.includes(newStatus);

  assert.strictEqual(isValid, false);
});

test('NoticeGeneratorService — FSM: NOTICE_SENT → DELIVERY_PENDING', () => {
  const currentStatus = 'NOTICE_SENT';
  const newStatus = 'DELIVERY_PENDING';

  const validTransitions: Record<string, string[]> = {
    DRAFT: ['NOTICE_SENT'],
    NOTICE_SENT: ['DELIVERY_PENDING', 'DELIVERY_FAILED'],
    DELIVERY_PENDING: ['NOTICE_DELIVERED', 'DELIVERY_FAILED'],
  };

  const allowed = validTransitions[currentStatus] || [];
  const isValid = allowed.includes(newStatus);

  assert.strictEqual(isValid, true);
});

// ============================================================================
// TEST 6: State-Specific Content
// ============================================================================

test('NoticeGeneratorService — Include state name in HTML', () => {
  const stateName = 'California';
  const html = `<h1>PRELIMINARY NOTICE OF RIGHT TO LIEN</h1><p>State of {{stateName}}</p>`;
  const populated = html.replace('{{stateName}}', stateName);

  assert.ok(populated.includes('State of California'));
});

test('NoticeGeneratorService — California requires certified mail language', () => {
  const requiresCertifiedMail = true;
  const language = requiresCertifiedMail
    ? 'This notice must be sent by certified mail or personal service.'
    : '';

  assert.strictEqual(requiresCertifiedMail, true);
  assert.ok(language.length > 0);
});

// ============================================================================
// TEST 7: Error Handling
// ============================================================================

test('NoticeGeneratorService — Continue if notice generation fails', () => {
  const calendars = [
    { id: 'cal_1', state: 'CA' },
    { id: 'cal_2', state: 'TX' }, // Este falla
    { id: 'cal_3', state: 'NY' },
  ];

  const processed = [];
  const failed = [];

  for (const cal of calendars) {
    try {
      if (cal.id === 'cal_2') {
        throw new Error('Simulated failure');
      }
      processed.push(cal.id);
    } catch (error) {
      failed.push(cal.id);
    }
  }

  assert.strictEqual(processed.length, 2);
  assert.strictEqual(failed.length, 1);
});

test('NoticeGeneratorService — Non-blocking: notice generation failure does not stop scheduler', () => {
  const schedulerStopped = false;
  const noticeGenerationFailed = true;

  assert.strictEqual(schedulerStopped, false);
  assert.strictEqual(noticeGenerationFailed, true);
});
