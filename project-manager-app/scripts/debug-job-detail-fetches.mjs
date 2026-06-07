const base = 'http://127.0.0.1:3301';

async function show(path) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`\n=== ${path} ===`);
    console.log(`status=${res.status}`);
    console.log(text.slice(0, 1200));
  } catch (error) {
    console.log(`\n=== ${path} ===`);
    console.log('FETCH ERROR');
    console.log(error);
  }
}

await show('/api/semse/jobs/job_smoke_001');
await show('/api/semse/jobs/job_smoke_001/milestones');
await show('/api/semse/disputes');
await show('/api/semse/jobs/job_smoke_001/evidence');
await show('/api/semse/jobs/job_smoke_001/escrow');
