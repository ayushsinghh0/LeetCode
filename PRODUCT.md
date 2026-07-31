# PRODUCT.md — DSA Roadmap

## What it is

A local-first, single-user web app that drives daily LeetCode-style practice: a fixed 539-question roadmap across 28 algorithm patterns, paced at 8 new questions per day (~68 days), with spaced-repetition revision on a 1/3/7/15/30-day ladder. Everything runs in the browser; progress persists to localStorage. No accounts, no server, no social features.

A second learning track runs beside the DSA roadmap: the **AI/ML course** (100xDevs cohort) — 26 core week-modules paced as two-day sprints (day 1 lecture, day 2 practice; 52 sessions) plus 5 optional single-session extras. Cleared weeks enter the same 1/3/7/15/30 review ladder. Both tracks are first-class citizens of one activity system: streaks, the heatmap, the calendar, XP, achievements, and the revision surface all count work from either track.

## Who uses it, and where

One person: a software engineer preparing for technical interviews, self-directed, practicing daily — typically evening sessions at a desk after work, plus quick phone check-ins (what's due today, mark a revision done) during the day. They return every single day for ~10 weeks; the app is a daily ritual, not a occasional destination.

## The job

- Answer instantly: "what do I do today?" (today's new questions + revisions due + today's course session + course reviews due).
- Keep the spaced-repetition schedule honest: due queues, overdue flags, weekly top-up revision days (every 7th day), mastery after 5 passes — for questions and course weeks alike.
- Show honest progress: day X of 68, per-pattern completion, streaks, estimated finish date, weak-pattern signals.
- Sustain motivation across 68 days: XP/levels, achievements, streaks, small celebrations — the user opted into gamification deliberately; it should feel earned, not noisy.
- Capture per-question notes (markdown) and confidence self-ratings that feed revision prioritization.

## Product truths and constraints

- Dataset is fixed: 539 questions, 28 patterns, difficulty mix committed in the repo. Pattern names are canonical (Two Pointers, Sliding Window, Dynamic Programming, …). The course dataset (26 core weeks + 5 extras, resource links) is likewise committed in the repo.
- Revision rules, XP values, streak rules are locked spec (do not alter in design work). Course XP register: 20 per session, 50 per cleared week, 10 per review — same locked status.
- A day counts as active (streak, heatmap, calendar) when either track saw work: solves, question revisions, course sessions, or course reviews.
- Tech: Vite + React 18 + TypeScript strict + Tailwind 3.4 + vendored shadcn/Radix primitives + Redux Toolkit + Recharts + Framer Motion. The full Vitest suite must stay green; UI copy is asserted in tests — behavior and copy are product truth.
- Routes: Dashboard `/`, Today, Roadmap, AI/ML course `/aiml`, Patterns (+detail), Revision, Calendar, Analytics, Achievements, Bookmarks, Settings, a 404 catch-all, and a bare distraction-free Focus mode at `/focus` with a pomodoro.
- Dark theme is the default (evening desk sessions under lamp light); a light theme exists and must remain first-class. Theme toggle lives in Settings.
- Mobile matters (phone check-ins): bottom nav on small screens, sidebar on desktop.

## Brand commitments

- Direction (user-pinned 2026-07-31): full redesign replacing the violet/cyan gradient-glass identity; **warm editorial** world — softer, paper-inspired, serif display voice, generous whitespace, calmer and more human. Rendition must avoid the generic cream+serif+terracotta cliché; derive materials from the audience's real editorial world (practice ledgers, mid-century textbooks, planners).
- No hype language; the app's existing copy is plain and stays.
