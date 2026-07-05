# Example Spec — Tool Hub Context Bridge

## Context

SEMSEproject needs a central place to coordinate ChatGPT, Claude, Codex, Gemini, Notion, Figma, GitHub, Railway and n8n.

## Problem

External AI tools do not automatically know the current SEMSEproject context: repo, branch, deploy, active objective, recent errors and project state.

## Goal

Create Tool Hub MVP with app tiles and a copyable Context Bridge prompt.

## Non-goals

- No OAuth.
- No browser automation.
- No live terminal sync.
- No API keys.

## Acceptance criteria

- Tool Hub route loads.
- Shows 9 tool tiles.
- Shows Context Bridge panel.
- Suggested prompt is visible.
- Buttons are present, even if only shell actions.

