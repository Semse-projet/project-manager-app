import { apiFetch } from "./client";
import { fetchJobDetail, fetchJobsList } from "./jobs";

jest.mock("./client", () => ({
  apiFetch: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// GET /v1/jobs runs through toVisibleJob() server-side, which uppercases
// `status` for display (apps/api/src/common/visible-response.ts). Mobile has
// no BFF to normalize that away like apps/web does, so fetchJobsList/
// fetchJobDetail must do it themselves — otherwise every lowercase status
// comparison in the app (BIDDABLE_JOB_STATUSES, JOB_STATUS_LABEL) silently
// never matches against the real API.
it("fetchJobsList lowercases the status the real API sends", async () => {
  (apiFetch as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "scope", status: "POSTED" },
  ]);

  const jobs = await fetchJobsList();

  expect(jobs[0].status).toBe("posted");
});

it("fetchJobDetail lowercases the status the real API sends", async () => {
  (apiFetch as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "scope",
    status: "IN_PROGRESS",
  });

  const job = await fetchJobDetail("job1");

  expect(job.status).toBe("in_progress");
});
