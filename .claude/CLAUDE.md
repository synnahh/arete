# VALERIE — engineering mode

**This is an engineering repository. Treat it as such.**

This file supersedes the "Startup / Business" build at `D:\Work\Projects\.claude\CLAUDE.md`, which VALERIE inherits only because of where it sits in the directory tree. That persona is correct for business work and wrong here: **deliverables in this repository are working, verified code — not documents.**

The user's global operating system at `C:\Users\bjp22\.claude\CLAUDE.md` remains in force.

---

## Sprint control

VALERIE is a P0 project in the FABLE SPRINT.

| | |
|---|---|
| Controller | `D:\Work\FABLE-SPRINT\00-MASTER-CONTROLLER.md` |
| Project control folder | `D:\Work\FABLE-SPRINT\projects\VALERIE\` |
| Entrypoint | `D:\Work\FABLE-SPRINT\prompts\00-START-FABLE.md` |
| Safety | `D:\Work\FABLE-SPRINT\06-SAFETY-BOUNDARIES.md` |

`projects\VALERIE\CURRENT-STATE.md` is what exists. `VISION.md` is what is wanted. Do not confuse them.

## Before you edit anything

⚠️ **This working tree held ~114 uncommitted changes at 2026-09-18, and they are the user's — not yours.**

Run `git status` and `git stash list` first. Triage and checkpoint before your first edit so your work stays separable. **Never** `git reset --hard`, `git checkout --`, `git clean`, or drop a stash here.

`node_modules` is absent — `npm install` before any build.

## This repository

- React 19 · Vite 7 · Tailwind 3 · Tauri 2 · Supabase + Firebase · Sentry
- JavaScript ESM. No TypeScript, no linter, **no tests**
- Ships three ways — Tauri desktop, PWA, Netlify. A change that works in the browser but breaks the Tauri build is not done

## Rules that bite here

**`npm run deploy:pwa` publishes to Firebase.** Outbound. Never run it unprompted.

**Never weaken `.gitignore`.** It excludes `.env`, `**/API KEY*` and `*.key.md`. Those rules are load-bearing.

**Never build a Tailwind class name by string interpolation.** Tailwind content-scans source and purges names it cannot see literally. This cost a previous session real time on the sister project. Use an explicit lookup map.

**Real personal data lives in this application** — health, finance, notes, calendar. A data-loss bug costs more here than anywhere else in the sprint. No destructive migration without an explicit user decision.

## How to work

Verify, do not assume. Attach a verification level to every completion claim — `CODED` is not done. Investigate failures rather than hiding them; never swallow an exception to make a build look clean.

Decide and proceed on ordinary engineering judgement. Ask only when genuinely blocked — `00-MASTER-CONTROLLER.md` §7.
