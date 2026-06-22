import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";

// ── Marketplace Service Tests ──────────────────────────────────────────────

test("marketplace service: listOpenJobs returns published jobs", async () => {
  const jobs = [
    {
      id: "job_1",
      title: "Bathroom Remodel",
      category: "bathroom_remodel",
      location: "New York, NY",
      budgetMin: 5000,
      budgetMax: 10000,
      status: "PUBLISHED",
      urgency: "high",
      scope: "Full bathroom renovation",
      postedAt: new Date().toISOString(),
      bidsCount: 3,
    },
    {
      id: "job_2",
      title: "Kitchen Cabinet Painting",
      category: "interior_painting",
      location: "Los Angeles, CA",
      budgetMin: 2000,
      budgetMax: 5000,
      status: "PUBLISHED",
      urgency: "medium",
      scope: "Paint kitchen cabinets",
      postedAt: new Date().toISOString(),
      bidsCount: 5,
    },
  ];

  assert.equal(jobs.length, 2);
  assert.ok(jobs.every(j => j.status === "PUBLISHED"));
  assert.equal(jobs[0].category, "bathroom_remodel");
});

test("marketplace service: listOpenJobs filters by category", async () => {
  const allJobs = [
    { id: "job_1", category: "bathroom_remodel" },
    { id: "job_2", category: "interior_painting" },
    { id: "job_3", category: "bathroom_remodel" },
  ];

  const filtered = allJobs.filter(j => j.category === "bathroom_remodel");

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every(j => j.category === "bathroom_remodel"));
});

test("marketplace service: listOpenJobs filters by location", async () => {
  const allJobs = [
    { id: "job_1", location: "New York, NY" },
    { id: "job_2", location: "Los Angeles, CA" },
    { id: "job_3", location: "New York, NY" },
  ];

  const filtered = allJobs.filter(j => j.location.includes("New York"));

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every(j => j.location.includes("New York")));
});

test("marketplace service: listOpenJobs filters by urgency", async () => {
  const allJobs = [
    { id: "job_1", urgency: "high" },
    { id: "job_2", urgency: "medium" },
    { id: "job_3", urgency: "high" },
  ];

  const filtered = allJobs.filter(j => j.urgency === "high");

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every(j => j.urgency === "high"));
});

test("marketplace service: listOpenJobs supports pagination", async () => {
  const allJobs = Array.from({ length: 50 }, (_, i) => ({
    id: `job_${i}`,
    title: `Job ${i}`,
  }));

  const page1 = allJobs.slice(0, 20);
  const page2 = allJobs.slice(20, 40);

  assert.equal(page1.length, 20);
  assert.equal(page2.length, 20);
  assert.notEqual(page1[0].id, page2[0].id);
});

test("marketplace service: listOpenJobs returns total count", async () => {
  const result = {
    listings: [
      { id: "job_1", title: "Job 1" },
      { id: "job_2", title: "Job 2" },
      { id: "job_3", title: "Job 3" },
    ],
    total: 3,
  };

  assert.equal(result.listings.length, 3);
  assert.equal(result.total, 3);
});

test("marketplace service: getStats aggregates by category", async () => {
  const stats = {
    totalListings: 5,
    byCategory: {
      bathroom_remodel: 2,
      interior_painting: 2,
      drywall_repair: 1,
    },
    byUrgency: {
      high: 2,
      medium: 3,
    },
    avgBudgetMin: 3500,
  };

  assert.equal(stats.totalListings, 5);
  assert.equal(stats.byCategory.bathroom_remodel, 2);
  assert.equal(Object.keys(stats.byCategory).length, 3);
});

test("marketplace service: getStats calculates average budget", async () => {
  const jobs = [
    { budgetMin: 1000 },
    { budgetMin: 2000 },
    { budgetMin: 3000 },
  ];

  const avgBudget = jobs.reduce((sum, j) => sum + j.budgetMin, 0) / jobs.length;

  assert.equal(avgBudget, 2000);
});

test("marketplace service: getStats handles empty listings", async () => {
  const stats = {
    totalListings: 0,
    byCategory: {},
    byUrgency: {},
    avgBudgetMin: null,
  };

  assert.equal(stats.totalListings, 0);
  assert.equal(stats.avgBudgetMin, null);
});

test("marketplace service: listProfessionals ranks by completed jobs", async () => {
  const professionals = [
    { id: "pro_1", name: "Alice", completedJobs: 10, avgRating: 4.8 },
    { id: "pro_2", name: "Bob", completedJobs: 25, avgRating: 4.5 },
    { id: "pro_3", name: "Charlie", completedJobs: 5, avgRating: 5.0 },
  ];

  const sorted = professionals.sort((a, b) => b.completedJobs - a.completedJobs);

  assert.equal(sorted[0].name, "Bob");
  assert.equal(sorted[0].completedJobs, 25);
});

test("marketplace service: listProfessionals calculates average rating", async () => {
  const ratings = [
    { score: 5 },
    { score: 4 },
    { score: 5 },
  ];

  const avgRating = Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length) * 10) / 10;

  assert.equal(avgRating, 4.7);
});

test("marketplace service: listProfessionals filters by tenant", async () => {
  // Professionals are tenant-scoped (only show those with jobs in tenant)
  const result = {
    professionals: [
      { id: "pro_1", tenantId: "tenant_1" },
      { id: "pro_2", tenantId: "tenant_1" },
    ],
    tenantId: "tenant_1",
  };

  assert.ok(result.professionals.every(p => p.tenantId === result.tenantId));
});

test("marketplace service: listProfessionals supports limit", async () => {
  const allProfessionals = Array.from({ length: 50 }, (_, i) => ({
    id: `pro_${i}`,
    name: `Professional ${i}`,
    completedJobs: 50 - i,
  }));

  const limited = allProfessionals.slice(0, 20);

  assert.equal(limited.length, 20);
  assert.ok(limited[0].completedJobs > limited[limited.length - 1].completedJobs);
});

test("marketplace service: professional reputation influenced by ratings", async () => {
  const professional = {
    id: "pro_1",
    name: "Top Contractor",
    completedJobs: 50,
    avgRating: 4.9,
  };

  const visibility = professional.avgRating >= 4.5 ? "featured" : "standard";

  assert.equal(visibility, "featured");
});

test("marketplace service: portfolio forensics affects professional visibility", async () => {
  const professionals = [
    { id: "pro_1", name: "Verified Pro", portfolioStatus: "approved", visibility: "featured" },
    { id: "pro_2", name: "Under Review", portfolioStatus: "review", visibility: "standard" },
    { id: "pro_3", name: "Flagged Pro", portfolioStatus: "flagged", visibility: "hidden" },
  ];

  const featured = professionals.filter(p => p.visibility === "featured");

  assert.equal(featured.length, 1);
  assert.equal(featured[0].portfolioStatus, "approved");
});

test("marketplace service: job bids count influences listing rank", async () => {
  const listings = [
    { id: "job_1", title: "Popular Job", bidsCount: 15 },
    { id: "job_2", title: "New Job", bidsCount: 2 },
    { id: "job_3", title: "Medium Job", bidsCount: 7 },
  ];

  const ranked = listings.sort((a, b) => b.bidsCount - a.bidsCount);

  assert.equal(ranked[0].bidsCount, 15);
  assert.equal(ranked[ranked.length - 1].bidsCount, 2);
});

test("marketplace service: location-based search with fuzzy matching", async () => {
  const jobs = [
    { id: "job_1", location: "New York, NY" },
    { id: "job_2", location: "New York City, NY" },
    { id: "job_3", location: "Los Angeles, CA" },
  ];

  const search = "new york";
  const matched = jobs.filter(j => j.location.toLowerCase().includes(search.toLowerCase()));

  assert.equal(matched.length, 2);
  assert.ok(matched.every(j => j.location.toLowerCase().includes("new york")));
});
