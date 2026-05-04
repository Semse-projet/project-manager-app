# Codex Workflow for SEMSE

Use this workflow when modifying the SEMSE workspace.

## 1. Confirm the target

- Check `pwd`
- Confirm whether the task belongs to `labsemse/` root docs or `project-manager-app/`
- If the request is ambiguous, prefer inspection over assumptions

## 2. Inspect before editing

- Read the nearest `README.md`
- Review `SEMSE_CONTEXT.md` and `ROADMAP.md` when work affects architecture
- Use fast search to locate existing implementations before adding files

## 3. Respect the repo boundaries

- Root Git repo: `labsemse/`
- Canonical app repo content: `project-manager-app/`
- Avoid editing `archive/` and `_satellites-archive/` except for explicit archival maintenance

## 4. Git safety rules

- Never run `git init` inside nested folders unless explicitly requested and verified
- Never use `git add .` by default
- Stage files selectively
- Review `git status --short` before commit
- Keep commits narrow and descriptive

## 5. Implementation rules

- Reuse existing scripts from `project-manager-app/package.json`
- Prefer existing packages and shared modules over duplication
- Add or update docs whenever behavior, structure or workflows change
- Keep secrets out of commits and examples

## 6. Verification

- Run the smallest relevant verification command
- Prefer targeted checks before broad suites
- If you cannot run a check, state that clearly

## 7. Close-out

- Summarize changed files
- State what was verified
- Call out remaining risks or next steps
