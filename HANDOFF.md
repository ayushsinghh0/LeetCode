# HANDOFF — V12.4 Analytics/Settings/rail fit shipped (2026-08-16)

## V12.4 — the last three complaints

Analytics went to the aiml recipe (lead + ML-track rail stacked left, the five question-tabs
wide right, `row-span-2`; "The signals" and the ML-track method prose behind Disclosures):
801→613 fresh / 758 seeded. Settings became three columns at `xl` (the form's two groups side
by side inside a `col-span-2` Section, Save spanning both; the "Preferences" super-heading
removed — its groups name themselves): 1206→613 fresh / 672 seeded. And tailwind.config gained
the **`short:` screen** (`raw: '(max-height: 700px)'`) — the V11 height lesson as a variant —
which compresses the sidebar's fixed rows (wordmark, search, nav `min-h-7`, level block) so all
15 destinations + level ring fit a 590px viewport with **zero nav scrolling**; `overflow-y-auto`
stays as the safety net for even shorter windows. 1176/1176 tests; app chunk 280.77 kB.

# Previous: V12.3 Projection Kit (2026-08-16)

## V12.3 — every page projected to fit (the latest pass)

The user's mandate: no vertical scrolling anywhere at their 1280×~590 viewport, nothing removed,
nothing rebuilt. DESIGN.md § "The projection kit" records the three moves (master–detail /
multi-column ruled grid / the fold) and the learned width bound. Measured at 1280×590, fresh +
200-solve seed: **fit both states** — Today(fresh)/Roadmap/Patterns/Drills/Contest/Bookmarks/
Focus/AI-ML(fresh), Interview ~604. Near (≤100 over, decision layer fully in viewport 1):
Dashboard 668–683, Today seeded 689, aiml seeded 627, Calendar 629, Revision seeded 628,
Achievements fresh 630. Reference depth remains on Companies 750, Settings 796, Analytics
801–1008, Achievements seeded 731 — all with their complete first-viewport answer. Zero
horizontal overflow re-verified at 1024/768/390. Roadmap is now a week-tile master–detail
(ChipRadioRow strip + two-column days; roadmap.test adapted — 7 day rows render, all 68 reachable
via tiles); aiml.test's three catalogue assertions now click the fold first. 1176/1176 tests.

# Previous: V12 Marginalia & Moments (2026-08-16)

**State: V9 through V12.4 are complete and MERGED to `main` (fast-forward from
`v9-composed-interface`, 2026-08-16) and pushed** — the branch outlier is resolved; `main` is
the current line again, as it was through V6–V8.

## What V12 added (the "make it feel alive" pass)

A full audit against a fresh premium-polish brief found V9–V11 had already shipped its structural
asks (probe re-verified: zero overflow across 16 routes × dark/light × 1280×590/390×780 under a
~200-solve seeded state — seed generator pattern: build state through real thunks in a throwaway
vitest file, dump `selectPersistedState`, inject via puppeteer `evaluateOnNewDocument`). What was
genuinely missing was warmth, and it shipped as four small systems:

- **Marginalia** (`src/components/shared/Ornament.tsx`, documented in DESIGN.md § Marginalia):
  three hairline engravings — sprig / fleuron / printer's star — on exactly four reflective
  moments (epigraph, Done for today, Session complete, Earned shelf). Budgeted: a fifth
  placement must displace one.
- **Celebrations wear the app's inks** (`useCelebration.ts`): confetti palette is now the
  fountain-blue/ochre/sage/clay/ivory set with `disableForReducedMotion: true` (the global
  reduced-motion CSS cannot reach a canvas). Tests assert call counts, not options — safe.
- **The completion tick settles in** (`TodayTasks.tsx`): spring pop inside
  `AnimatePresence initial={false}` so already-done rows never animate on mount and reopening
  snaps (un-completing is not a moment).
- **Register fix**: `SessionComplete`'s "Needs another pass" / "Next" labels were still the
  hand-rolled eyebrow the "Held" comment claimed was fixed — all three are `Eyebrow` now.

Deliberately NOT done, with reasons stated in the session record: no multi-hue semantic palette
(the one-ink world is user-pinned; difficulty/pattern inks already carry color), no sidebar
group headers (work/shelf ruling exists; three more rows don't fit 590px), no greeting microcopy
(PRODUCT.md locks plain copy).

## V12.1 — Fit by composition (same day)

The user reported the remaining vertical scroll on Today/Roadmap. The V10 lesson forbids height
locks, so the answer is density (DESIGN.md § Fit by composition): Today 1017→800px of content at
1280×590 (support line dropped, `DailyGoalProgress dense` one-row variant, capacity chips moved
into the plan Section's `action` slot at a fixed `w-[21rem]`, plan rows `lg:min-h-9`, plans past
6 items fold behind an in-list "Show N more · ~Xm" row — `VISIBLE_ROWS` in SessionPlan.tsx);
Roadmap 1341→1075 (day rows read on one baseline — Day N + Meta inline + count — `py-2.5`, rail
`pt-2` keeps the node aligned); Patterns 1859→1523 (rows `py-2`, 32px icon plates). Today now
fits a 1280×800 laptop with zero scroll; at 590 the whole decision layer (masthead, goal bar,
hero, chips, first plan rows / current roadmap day) sits in viewport 1 and only depth scrolls.
All copy the tests assert was preserved; no test changed.

## V12.2 — The three zones (same day, after user screenshots)

The user's own light-theme screenshots (fresh state, 1280×~590) still showed scroll on Today and
Roadmap, with the rail nearly empty — height overflowing while a third of the width sat unused.
DESIGN.md § "When density is not enough, spend the width" is the recorded rule. Today's body is
now a page-local grid: three tracks at `xl` (hero | plan | 16rem rail), the old two-column band
at `lg` via explicit `col-start`/`row-span` placement, one column below — DOM order (work, plan,
context) untouched, so tests, phones and screen readers see the same page. Roadmap dropped its
masthead support line and tightened day rows to `py-1.5`/`gap-1` (rail `pt-1`). Measured, both
states (fresh + 200-solve seed) × {1280×590, 1024×700, 390×780}: **fresh Today at 1280×590 is
590px — literally zero scroll**; seeded 705; Roadmap 983 with the entire open week + next week
header inside viewport 1; zero horizontal overflow everywhere. 1175/1175 tests unchanged.

V11 retires V10's load-bearing idea while keeping its shell. The user's real machine (1080p at
150% scaling ≈ 1280×590 CSS) crushed V10's fixed-height panels into clipped scroll boxes with
loud Windows scrollbars on nearly every route. The contract is now: **the shell still locks at
`lg` and the sidebar stays put, `<main>` is the single scroll container
(`scrollbar-gutter: stable`), and pages flow at natural height — nothing below `main` owns a
scrollbar.** `docs/superpowers/specs/2026-08-16-flowing-application-design.md` is the authority;
read its "Findings worth keeping".

## Where things stand

- **1175/1175 tests across 83 files. `npx tsc --noEmit` clean. `npm run build` clean**, app chunk
  280.60 kB against the 301 kB budget (V11: 280.44 — V12 cost 0.16 kB).
- Probe-verified (real Chrome, all 15 routes × 5 viewports incl. 1280×590): zero document
  overflow, zero horizontal overflow, zero nested scrollers. The probe script pattern lives in
  the V11 design record.
- DESIGN.md § Layout now carries "The scroll contract (V11)" — the one paragraph to read before
  touching AppShell/Page/Sidebar overflow behavior.

## What V11 actually changed

- `Screen`/`ScreenBody`/`Panel` (Page.tsx) are flow primitives now — no `lg:h-full`, no
  `min-h-0` chains, no `overflow-y-auto`. `Panel` is a named region, not a scroller.
- Per-page height locks removed: Today, Dashboard, Analytics, AI/ML, Bookmarks (work columns,
  rails, and all ten forced-flex `TabsContent` classNames).
- AppShell's gutter: `max-w-6xl` ceiling restored, `md:py-6 md:pb-12`, no `lg:h-full`;
  `main` gained `lg:[scrollbar-gutter:stable]`. PageTransition dropped its `h-full`.
- Scrollbar manners in index.css: `.scrollbar-quiet` (sidebar nav — invisible until
  hover/focus-within), `.scrollbar-none` (tab strip). TabsList pans below `md`, wraps above —
  it overflowed a 390px phone by 120px before.
- Polish: `Progress` animates from zero on first paint (aria untouched); nav icons transition
  their ink; `EmptyState` got the pressed-seal ring; Settings' Save tucks under the form's own
  closing rule (`-mt-4`, no second hairline).

## Rules that bit during V6–V11 — still standing

- **New (V11): a layout that only works above a height it cannot control is a layout bug.**
  Verify at ~590px effective height (150%-scaled 1080p), not just 720/800.
- **New (V11): `overflow-y: auto` computes `overflow-x` to `auto`** — an inner scroll region
  turns 1px of horizontal overflow into a drawn horizontal scrollbar. Prefer removing the region.
- **New (V11): Git Bash mangles `/route` args into filesystem paths** — `MSYS_NO_PATHCONV=1`
  when passing routes to node CLIs.
- **New (V11): browser-pane MCP unavailable again** (extension account mismatch);
  `npm i --no-save puppeteer-core` + installed Chrome is the reliable measurement/screenshot
  path, including forced-`.light` captures (a partial persisted payload gets quarantined — force
  the class post-load instead).
- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; passes solo.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit
  messages via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.
- Adding an import of `@/data/mlTracks`, `@/data/mlProjects` or `@/utils/engine/insights` to
  `store/selectors.ts` or `store/actions.ts` silently puts a large chunk back on the app bundle.
- (V10, still true for `main` and dialogs): `overflow` clips absolutely-positioned descendants
  ONLY when the scroll container is their containing block — `main` and `Panel` keep `relative`.
- (V10): Radix `TabsContent` is `display:block`; `[hidden]` is UA-origin, so any author `display`
  (`flex`, `md:flex`) un-hides inactive panels. Use `data-[state=active]:flex` if ever needed.
- (V10): `Screen` collides with the DOM global `Screen` type — a missing import reads as "cannot
  be used as a JSX component".
- (V9): jsdom does not hide closed `<details>` content and `<summary>` has no `button` role —
  assert the `open` attribute (`familyPanel.test.tsx` is the worked example).
- (V9): `text-muted-foreground/80` fails AA on the light theme; full-alpha `muted-foreground` is
  the floor for small text.

## Known limitation carried forward

`button.tsx` ships `h-10` default / `h-9` small (40px / 36px). Both clear WCAG 2.2 AA's 24×24
minimum; neither reaches the 44px AAA/HIG figure, and `size="sm"` has ~68 call sites. Individual
controls that are the primary interaction of their row were raised to `min-h-11`. Moving the
scale itself is a design decision awaiting a call, not an open bug.

## The law books

`CLAUDE.md` (architecture law), `PRODUCT.md` (locked product truth), `DESIGN.md` (visual system +
the mandatory composition contract + § The scroll contract), and the design records under
`docs/superpowers/specs/` (V6 practice engine, V7 adaptive mastery, V8 performance engine, V9
composed interface, V10 zero-scroll — superseded by — V11 flowing application).
