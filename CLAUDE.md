# The Steward's Codex — Claude Code project rules

Single-file RPG habit tracker (vanilla JS, everything in `index.html`) + Netlify functions + Supabase cloud sync. Built by Arron Bullock (EECOH Living) for real daily logging — **data integrity is non-negotiable**.

## Hard rules (never break)
1. **`index.html` is the entire app.** No build step, no frameworks.
2. **Storage key `eecoh-codex-v1` NEVER changes.** Renaming it wipes local data.
3. **Run `node codex-harness.js` after every change. All suites must pass before committing.**
4. **Local-first sync is sacred:** localStorage writes first, always. Cloud adoption ONLY when remote `rev` is strictly greater than local `_rev` (see `Cloud.pullMerge`). Never invert this, never adopt on equal revs, never block the UI on network.
5. **Every save must bump `state._rev`** (in `Store.save`) — the sync merge depends on it.
6. **No secrets in the repo.** `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` live in Netlify env vars only. Client config comes from `/.netlify/functions/config`.
7. **New interactive elements need reachability manifest entries** (`codex-tests/reachability.test.js`). Listener scopes: forge/fuel/timer/activation handlers in the training-pane listener; cross-pane UI in document-level `onDocClick`/`onDocKeydown`.
8. **Migrations must be additive** — loading old state (local OR cloud) must never lose fields.
9. **Fixed-position UI** (bottom nav, subDock, timer): no ancestor may gain `transform`/`filter`. Scroll navigation stays occlusion-aware.
10. **Anti-grind guardrail**: the weekly training ceiling autoregulates DOWN, never up.
11. **Build stamp**: bump `const BUILD` on every user-facing change.

## Conventions
- `restSec` written ONLY by the ☕ Break control. Held timers own the slot until their move/set is checked.
- "Fill from current" = first unchecked set, forward-only.
- Sub-tab and main-tab order = frequency ramp toward the thumb; defaults live in `SUB_DEFAULT`, decoupled from chip order. Handedness mirrors via `html.lefty`.
- Update `UPDATES.md` (append) with every meaningful change.

## Deploy
Push to `main` → GitHub Actions runs the harness → Netlify auto-deploys. Supabase schema: `supabase-setup.sql` (idempotent).
