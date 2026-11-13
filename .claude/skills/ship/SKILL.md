---
name: ship
description: Take one change to this site from request to a verified, committed change ready to deploy - plan, build, test, verify, then hand over the push. Use when Harry types /ship followed by what he wants changed.
argument-hint: <what to change>
disable-model-invocation: true
---

# /ship: plan → build → test → verify → deploy

Take this change from request to a verified commit, without stopping to ask Harry
anything unless a stop rule below says so:

**$ARGUMENTS**

Work through the five stages in order. Each has an exit gate; don't start the next stage
until the gate is met. The guard hook (`.claude/hooks/guard.mjs`) enforces the hard
limits whatever these instructions say: it blocks pushing, switching tests off, rewriting
visual baselines with a raw flag, and personal details in anything that ships.

## 1. Plan

Run the `planner` subagent with the request above. It is read-only and returns acceptance
criteria, risks, a Playwright test for every criterion and the files to change.

**Gate:** every criterion has a named test. If the plan's "Needs Harry" is anything but
"Nothing", stop and show him the plan: that part is his decision.

## 2. Build

- Start a branch: `git switch -c ship/<short-kebab-name>`.
- Write the tests the plan named first, then make them pass with the smallest change.
- Follow `CLAUDE.md`: a unique `data-testid` on every control, no inline styles, a
  reduced-motion path for anything that moves, content readable without JavaScript.
- Update `README.md` and `CLAUDE.md` if structure, decisions or status changed.

Every edit is formatted by a hook as you go.

**Gate:** each file in the plan is changed, and nothing outside the plan is.

## 3. Test

- `npm run lint`
- The spec files you touched: `npx playwright test tests/<file>.spec.ts`
- Then everything CI runs: `npm run verify`

A failure is information about the change, not an obstacle. Fix the code. Never get to
green by deleting, skipping or loosening a test, or by raising a timeout. If the plan said
a visual change was intended, run `npm run test:visual:update`, look at the new images,
and note that the Linux baselines need the "Update visual baselines" workflow (Harry
runs it).

**Gate:** `npm run verify` passes. After three failed attempts at the same failure, stop
and report what you tried.

## 4. Verify

Run the `verifier` subagent. Give it only the request and the plan, not your account of
the work: it starts cold, reads the diff, runs the checks itself and returns PASS or FAIL
for each criterion.

**Gate:** PASS. On FAIL, go back to stage 2 with its findings. After two failed
verifications, stop and report.

## 5. Deploy

- Commit on the branch: `git add` the changed files by name, then one commit whose
  message says what changed and why.
- Do not push, and do not merge. A push to `main` is what deploys the live site, so that
  one step is Harry's (the guard hook blocks it for you).

Finish with this report:

```
## Ready to ship: <request in one line>

Plan      <n> acceptance criteria, <n> tests (<n> new)
Build     <files changed>, on branch ship/<name>
Test      npm run verify: <n> passed, <n> failed, <n> skipped
Verify    PASS, by the verifier subagent (<n>/<n> criteria)
Deploy    committed as <short sha>. Waiting for you:

  git switch main
  git merge --ff-only ship/<name>
  git push

GitHub Actions then re-runs every check and deploys only if they pass.
Afterwards, confirm the live site is serving this commit:

  npm run smoke:live
```

Add a "Notes" line for anything the verifier flagged that didn't block, and for visual
baselines that still need the Linux workflow.

## Stop rules

Stop and report, rather than push on, when:

- the plan needs a decision that is Harry's
- the same failure survives three fixes, or verification fails twice
- the guard hook blocks something you believe the change needs
- the change would need a rule in `CLAUDE.md` section 6 to be broken
