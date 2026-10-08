# Branching and review

Two developers work on this repo: **Yash** and **Hari**. These rules apply to
every change, including small ones.

## The branches

- **`main` is production.** Never commit, merge, push or change settings on
  `main`, or on the production services. Going to production is a separate
  decision, taken after Sam signs off on staging, through one reviewed PR.
- **`staging` is where all work happens.** The staging Vercel preview
  (`sato-frontend-staging.vercel.app`) always runs the tip of `staging`, and it
  talks to the staging backend.
- The old `Development` branch is no longer used.

## Rules

1. **Start from `staging`.** `git fetch origin && git checkout -b feat/short-name origin/staging`.
   Never branch from `main`.
2. **Every change has a PR, and its base is `staging`.** No direct pushes to
   `staging`, no force-pushes anywhere.
3. **The other developer approves.** Yash's PRs are approved by Hari. Hari's PRs
   are approved by Yash. The author never approves or merges their own PR before
   the other developer has approved it. (`.github/CODEOWNERS` asks the other
   person for a review automatically.)
4. **Merging an approved PR into `staging` is followed by a staging deploy.**
   This project has no GitHub link on Vercel, so a merge does not deploy by
   itself: run `pnpm deploy:staging` (see below). Then look at it on staging and
   update the tracker.
5. **Say it in the PR.** The description names the tracker target(s) it
   finishes, what was tested, and what is not in it. Use the PR template.
6. **The tracker is the record.** Every PR and every deploy is on the plan and
   tracker page (the shared artifact). A target is done only when it is in
   `staging`, deployed, and checked there.
7. **Migrations.** Re-check the migration number against `origin/staging` before
   every push: two open PRs must not use the same number.

## Deploying to staging

```
pnpm deploy:staging            # deploy the tip of origin/staging and move the staging alias
pnpm deploy:staging --dry-run  # run every check, change nothing
```

The decision (tracker p03): keep the deploy manual, but make it one safe command instead of steps done by hand.
`scripts/deploy-staging.sh`:

- builds a **clean copy of `origin/staging`**, so your local branch and uncommitted files can never reach staging;
- **never deploys to production**: it accepts no `--prod` or `--target`, and it checks that Vercel reports the new deployment as a *preview* and *Ready* before it moves anything;
- points the build at the **staging backend** (fixed in the script, not read from your shell);
- moves `sato-frontend-staging.vercel.app` to the new deployment, then checks the alias.

One-time setup: install the Vercel CLI, log in to the `lead-generation-io` team, and run `vercel link` in the repo root to link `sato-frontend` (the `.vercel` folder is git-ignored). The page is behind Vercel login, so open it while logged in to look at it.
Connecting `staging` to Vercel's own Git integration was considered and not done: it changes the Vercel project's settings, and this keeps production out of reach.

## Promote to `main` (later, not now)

Only after Sam signs off on staging, and only on Yash's say-so: one PR from
`staging` to `main`, approved by Hari, merged by Yash. Nothing else touches `main`.

## What never to do

- Commit or push to `main`.
- Branch from `main`, or open a PR whose base is `main`, for this work.
- Merge your own PR before the other developer approves it.
- `git push --force` on `staging` or `main`.
- Run a command that can change production settings (for example `vercel curl`,
  which creates a deployment-protection bypass secret, or any `vercel --prod` deploy).
