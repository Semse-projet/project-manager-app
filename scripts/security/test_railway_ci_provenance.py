"""Unprivileged offline tests for the inline Railway CI provenance guard.

The real guard is extracted from the deployed workflow definition, not
duplicated as a mock. All GitHub responses in these tests are simulated.
"""
from __future__ import annotations
import os
import subprocess
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/railway-deploy.yml"
SHA = "a" * 40
REPO = "Semse-projet/project-manager-app"
RUN_ID = 123
REQUIRED = ("quality-gates", "unit-coverage", "e2e", "merge-gate")


def extract_guard():
    workflow = WORKFLOW.read_text(encoding="utf-8")
    begin = "          python3 - <<'PY'\n"
    end = "\n          PY"
    assert workflow.count(begin) == 1, "Exactly one inline Python guard is required"
    start = workflow.index(begin) + len(begin)
    stop = workflow.index(end, start)
    guard = "\n".join(
        line[10:] if line.startswith("          ") else line
        for line in workflow[start:stop].splitlines()
    )
    namespace = {"__name__": "semse_ci_guard_under_test"}
    exec(compile(guard, str(WORKFLOW), "exec"), namespace)
    return namespace["verify"], workflow


VERIFY, WORKFLOW_TEXT = extract_guard()


def fixture(mutator=None, missing_history=False, incomplete_history=False):
    run = {
        "id": RUN_ID, "event": "push", "head_branch": "main", "head_sha": SHA,
        "repository": {"full_name": REPO},
        "head_repository": {"full_name": REPO},
        "path": ".github/workflows/ci.yml",
        "status": "completed", "conclusion": "success",
        "run_number": 50, "run_attempt": 1,
    }
    jobs = [{"name": name, "status": "completed", "conclusion": "success"}
            for name in REQUIRED]
    data = {
        "branches/main": {"commit": {"sha": SHA}},
        "actions/runs/123": run,
        "actions/runs/123/jobs?per_page=100": {"total_count": 4, "jobs": jobs},
    }
    if mutator:
        mutator(data, run, jobs)

    def get(path):
        if path.startswith("actions/workflows/ci.yml/runs?"):
            if missing_history:
                return {"total_count": 0, "workflow_runs": []}
            if incomplete_history:
                return {"total_count": 101, "workflow_runs": [run]}
            return {"total_count": 1, "workflow_runs": [run]}
        return data[path]

    return get


class RailwayCIProvenanceTests(unittest.TestCase):
    def env(self, event="workflow_run"):
        return {
            "GITHUB_REPOSITORY": REPO, "DEPLOY_SHA": SHA,
            "DEPLOY_EVENT": event, "TRIGGER_CI_RUN_ID": str(RUN_ID),
        }

    def deny(self, phrase, mutator=None, env=None, **options):
        with self.assertRaisesRegex((RuntimeError, KeyError, ValueError), phrase):
            VERIFY(env or self.env(), fixture(mutator, **options))

    def test_successful_trusted_workflow_run(self):
        self.assertEqual(VERIFY(self.env(), fixture()), RUN_ID)

    def test_successful_trusted_manual_dispatch(self):
        self.assertEqual(VERIFY(self.env("workflow_dispatch"), fixture()), RUN_ID)

    def test_approved_workflow_path_may_have_ref_annotation(self):
        get = fixture(lambda d, r, j: r.update(path=".github/workflows/ci.yml@refs/heads/main"))
        self.assertEqual(VERIFY(self.env(), get), RUN_ID)

    def test_wrong_sha_format_rejected(self):
        env = self.env()
        env["DEPLOY_SHA"] = "f00"
        self.deny("invalid repository or SHA", env=env)

    def test_main_has_advanced_rejected(self):
        self.deny("main HEAD",
                  lambda d, r, j: d["branches/main"]["commit"].update(sha="b" * 40))

    def test_missing_trigger_run_id_rejected(self):
        env = self.env()
        env["TRIGGER_CI_RUN_ID"] = ""
        self.deny("triggering workflow ID", env=env)

    def test_unrecognized_trigger_rejected(self):
        self.deny("unsupported event", env=self.env("pull_request"))

    def test_pr_workflow_cannot_authorize(self):
        self.deny("push to main", lambda d, r, j: r.update(event="pull_request"))

    def test_wrong_head_branch_cannot_authorize(self):
        self.deny("push to main", lambda d, r, j: r.update(head_branch="staging"))

    def test_fork_head_repository_rejected(self):
        self.deny("head repository mismatch",
                  lambda d, r, j: r.update(head_repository={"full_name": "attacker/fork"}))

    def test_foreign_repository_rejected(self):
        self.deny("CI repository mismatch",
                  lambda d, r, j: r.update(repository={"full_name": "other/repo"}))

    def test_ci_sha_mismatch_rejected(self):
        self.deny("CI SHA mismatch", lambda d, r, j: r.update(head_sha="b" * 40))

    def test_unknown_workflow_path_rejected(self):
        self.deny("incorrect CI workflow",
                  lambda d, r, j: r.update(path=".github/workflows/unsafe.yml"))

    def test_workflow_prefix_spoof_rejected(self):
        self.deny("incorrect CI workflow",
                  lambda d, r, j: r.update(path=".github/workflows/ci.yml-evil"))

    def test_pending_ci_rejected(self):
        self.deny("not successfully completed",
                  lambda d, r, j: r.update(status="in_progress", conclusion=None))

    def test_failed_ci_rejected(self):
        self.deny("not successfully completed",
                  lambda d, r, j: r.update(conclusion="failure"))

    def test_missing_e2e_job_rejected(self):
        def mutate(data, run, jobs):
            jobs[:] = [j for j in jobs if j['name'] != 'e2e']
            data["actions/runs/123/jobs?per_page=100"]["total_count"] = 3
        self.deny("e2e", mutate)

    def test_missing_merge_gate_rejected(self):
        def mutate(data, run, jobs):
            jobs.pop()
            data["actions/runs/123/jobs?per_page=100"]["total_count"] = 3
        self.deny("merge-gate", mutate)

    def test_skipped_merge_gate_rejected(self):
        self.deny("merge-gate", lambda d, r, j: j[-1].update(conclusion="skipped"))

    def test_skipped_e2e_rejected(self):
        self.deny("e2e", lambda d, r, j: next(x for x in j if x["name"] == "e2e").update(conclusion="skipped"))

    def test_failed_quality_gates_rejected(self):
        self.deny("quality-gates", lambda d, r, j: j[0].update(conclusion="failure"))

    def test_duplicate_successful_job_rejected(self):
        def mutate(data, run, jobs):
            jobs.append(dict(jobs[0]))
            data["actions/runs/123/jobs?per_page=100"]["total_count"] = 5
        self.deny("quality-gates", mutate)

    def test_incomplete_job_page_rejected(self):
        self.deny("incomplete CI job list",
                  lambda d, r, j: d["actions/runs/123/jobs?per_page=100"]
                  .update(total_count=101))

    def test_manual_requires_existing_push_ci(self):
        self.deny("no CI push run", env=self.env("workflow_dispatch"),
                  missing_history=True)

    def test_manual_incomplete_ci_run_page_rejected(self):
        self.deny("incomplete CI run history", env=self.env("workflow_dispatch"),
                  incomplete_history=True)

    def test_merge_gate_is_unskippable_and_unprivileged(self):
        ci = (WORKFLOW.parent / "ci.yml").read_text(encoding="utf-8")
        self.assertEqual(ci.count("\n  merge-gate:\n"), 1)
        block = ci.split("\n  merge-gate:\n", 1)[1].split("\n  # PR #973 only:", 1)[0]
        self.assertIn("needs: [quality-gates, unit-coverage, e2e]", block)
        self.assertIn("if: " + "$" + "{{ always() }}", block)
        self.assertIn("permissions: {}", block)
        self.assertIn("working-directory: " + "$" + "{{ github.workspace }}", block)
        self.assertNotIn("actions/checkout@", block)
        self.assertNotIn("RAILWAY_TOKEN", block)

    def test_merge_gate_shell_denies_failures_skips_and_cancellations(self):
        ci = (WORKFLOW.parent / "ci.yml").read_text(encoding="utf-8")
        block = ci.split("\n  merge-gate:\n", 1)[1].split("\n  # PR #973 only:", 1)[0]
        shell = block.split("        run: |\n", 1)[1]
        script = "\n".join(line[10:] if line.startswith("          ") else line
                           for line in shell.splitlines()).strip()
        env = dict(os.environ, QUALITY_RESULT="success", COVERAGE_RESULT="success",
                   E2E_RESULT="success")
        def trial(values):
            return subprocess.run(["bash", "-c", script], env=dict(env, **values),
                                  capture_output=True, text=True, timeout=5)
        self.assertEqual(trial({}).returncode, 0)
        for variable in ("QUALITY_RESULT", "COVERAGE_RESULT", "E2E_RESULT"):
            for value in ("failure", "skipped", "cancelled", ""):
                with self.subTest(variable=variable, value=value):
                    result = trial({variable: value})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(variable, result.stdout)

    def test_workflow_order_and_scope(self):
        verify_marker = "      - name: Verify exact-main CI provenance (fail closed)"
        deploy_marker = "      - name: Deploy exact commit to Railway (fresh build)"
        self.assertEqual(WORKFLOW_TEXT.count(verify_marker), 1)
        self.assertEqual(WORKFLOW_TEXT.count(deploy_marker), 1)
        self.assertLess(WORKFLOW_TEXT.index(verify_marker),
                        WORKFLOW_TEXT.index(deploy_marker))
        self.assertIn("      actions: read", WORKFLOW_TEXT)
        self.assertIn("github.event.workflow_run.event == 'push'", WORKFLOW_TEXT)
        self.assertIn(
            "github.event.workflow_run.head_repository.full_name == github.repository",
            WORKFLOW_TEXT)


if __name__ == "__main__":
    unittest.main()
