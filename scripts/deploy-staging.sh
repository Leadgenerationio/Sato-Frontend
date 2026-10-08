#!/usr/bin/env bash
# Deploy the TIP OF origin/staging to the staging preview and move the staging alias to it. Never production.
#
#   pnpm deploy:staging            # deploy and move the alias
#   pnpm deploy:staging --dry-run  # run every check, change nothing
#
# This project has no GitHub link on Vercel, so merging into staging does not deploy: run this after a merge (BRANCHING.md rule 4).
# What it guarantees:
#   - it only ever builds a clean copy of origin/staging (your local branch and uncommitted files cannot leak in);
#   - it never passes --prod or --target: the deployment is a PREVIEW, and it checks that Vercel says so before moving the alias;
#   - the build talks to the staging backend (VITE_API_URL is fixed here, not read from your shell);
#   - the alias is only moved to a deployment that is Ready, and it checks the alias afterwards.
# Needs: git, the Vercel CLI logged in to the lead-generation-io team, and a .vercel/project.json link to sato-frontend in the repo root
# (run `vercel link` once; .vercel is git-ignored).
set -euo pipefail

STAGING_API="https://sato-backend-staging-staging.up.railway.app"
ALIAS_HOST="sato-frontend-staging.vercel.app"
SCOPE="lead-generation-io"
PROJECT="sato-frontend"
VERCEL="${VERCEL_BIN:-vercel}" # tests point this at a stub

die() { echo "deploy-staging: $*" >&2; exit 1; }

DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    *) die "unknown argument '$arg'. Only --dry-run is accepted: this script never deploys to production (no --prod, no --target)." ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
[ -f .vercel/project.json ] || die "no .vercel/project.json here. Run 'vercel link' once and pick the $PROJECT project in the $SCOPE team."
grep -q "\"projectName\": *\"$PROJECT\"" .vercel/project.json || die ".vercel/project.json is not linked to $PROJECT. Run 'vercel link' again."

git fetch -q origin staging
TIP="$(git rev-parse --short origin/staging)"
echo "deploy-staging: origin/staging is at $TIP: $(git log -1 --format=%s origin/staging | cut -c1-80)"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/stato-fe-staging.XXXXXX")"
cleanup() { git worktree remove --force "$WORK" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
git worktree add -q --detach "$WORK" origin/staging
mkdir -p "$WORK/.vercel" && cp .vercel/project.json "$WORK/.vercel/project.json"

if [ "$DRY" = 1 ]; then
  echo "deploy-staging: dry run OK. Would deploy $TIP as a preview with VITE_API_URL=$STAGING_API and point $ALIAS_HOST at it."
  exit 0
fi

cd "$WORK"
OUT="$("$VERCEL" deploy --yes --scope "$SCOPE" --build-env "VITE_API_URL=$STAGING_API" --env "VITE_API_URL=$STAGING_API" 2>&1)" || { echo "$OUT" >&2; die "vercel deploy failed"; }
URL="$(printf '%s\n' "$OUT" | grep -Eo 'https://[A-Za-z0-9.-]+\.vercel\.app' | tail -n 1)"
[ -n "$URL" ] || { echo "$OUT" >&2; die "could not read the deployment URL from vercel's output"; }
echo "deploy-staging: deployed $TIP to $URL"

INSPECT="$("$VERCEL" inspect "$URL" --scope "$SCOPE" 2>&1)" || { echo "$INSPECT" >&2; die "vercel inspect failed: not moving the alias"; }
printf '%s\n' "$INSPECT" | grep -Eq '^[[:space:]]*target[[:space:]]+preview' || die "the deployment is not a PREVIEW (Vercel says otherwise). Not moving the alias. Check it in the Vercel dashboard NOW."
printf '%s\n' "$INSPECT" | grep -Eq 'status[[:space:]]+.*Ready' || die "the deployment is not Ready yet. Not moving the alias. Run the alias step again when it is."

"$VERCEL" alias set "$URL" "$ALIAS_HOST" --scope "$SCOPE" >/dev/null || die "vercel alias set failed"
AFTER="$("$VERCEL" inspect "https://$ALIAS_HOST" --scope "$SCOPE" 2>&1)" || die "could not inspect the alias after moving it"
printf '%s\n' "$AFTER" | grep -Fq "${URL#https://}" || die "the alias does not point at $URL after the move. Check it in the Vercel dashboard."
echo "deploy-staging: https://$ALIAS_HOST now serves $TIP ($URL). It is behind Vercel login; open it while logged in to look at it."
