#!/usr/bin/env bash
#
# bootstrap-governance.sh — apply the pipeline's human gates to the repository.
#
# WHY THIS SCRIPT EXISTS
# ----------------------
# Workflow YAML cannot create its own gates. A job that declares
# `environment: production` will run straight through with nobody asked for
# anything unless that environment exists AND has required reviewers configured
# in repository *settings*. Likewise, CODEOWNERS is inert until branch
# protection turns on "Require review from Code Owners".
#
# So the gates described in docs/CI-CD.md are only half in the repository. This
# script is the other half. Until it has been run, the pipeline is a pipeline
# with no gates in it.
#
# USAGE
#   ./scripts/bootstrap-governance.sh [--repo owner/name] [--dry-run]
#
# REQUIREMENTS
#   - gh CLI, authenticated as a repository ADMIN (gh auth login)
#   - jq
#
set -euo pipefail

REPO="${REPO:-vrkaushiklakkaraj/payment-processing-app}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    REPO="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

OWNER="${REPO%%/*}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if $DRY_RUN; then
    printf '  [dry-run] gh %s\n' "$*"
  else
    gh "$@"
  fi
}

# --- Team → role mapping ----------------------------------------------------
# Keep in step with .github/CODEOWNERS.
#
#   payments-eng-leads    Engineering Lead          @shubham.mujumdar4
#   payments-architects   Solution Architect        @shubham.mujumdar3
#   payments-qa           QA Lead                   @shubham.mujumdar6
#   payments-compliance   Compliance & FC Risk      @shubham.mujumdar7
#   payments-sre          SRE / Platform            @shubham.mujumdar9
#   payments-product      Product Owner             @shubham.mujumdar1
#   payments-delivery     Delivery Manager          @shubham.mujumdar8

TEAM_QA=payments-qa
TEAM_PRODUCT=payments-product
TEAM_DELIVERY=payments-delivery
TEAM_COMPLIANCE=payments-compliance
TEAM_SRE=payments-sre

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
log "Preflight"

command -v gh >/dev/null || die "gh CLI not found. Install from https://cli.github.com/"
command -v jq >/dev/null || die "jq not found."
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

PERMS=$(gh api "repos/${REPO}" --jq '.permissions.admin' 2>/dev/null) \
  || die "Cannot read ${REPO}. Check the name and your access."
[[ "$PERMS" == "true" ]] \
  || die "You need ADMIN on ${REPO} to set branch protection and environments. Current: not admin."

OWNER_TYPE=$(gh api "users/${OWNER}" --jq '.type')
IS_PRIVATE=$(gh api "repos/${REPO}" --jq '.private')

echo "Repository:  ${REPO}"
echo "Owner type:  ${OWNER_TYPE}"
echo "Private:     ${IS_PRIVATE}"
$DRY_RUN && echo "Mode:        DRY RUN (nothing will be changed)"

# Two hard constraints that will otherwise fail confusingly halfway through.
if [[ "$OWNER_TYPE" != "Organization" ]]; then
  warn "This repository belongs to a USER, not an organisation."
  warn "GitHub teams do not exist outside an organisation, so the @${OWNER}/payments-*"
  warn "team reviewers in CODEOWNERS and below cannot be created."
  warn ""
  warn "To demonstrate the gates on a personal repository, set reviewers to"
  warn "individual GitHub usernames instead. Set REVIEWER_USERS below and"
  warn "re-run; the script will use user reviewers in place of team reviewers."
  warn ""
  USE_USER_REVIEWERS=true
else
  USE_USER_REVIEWERS=false
fi

if [[ "$IS_PRIVATE" == "true" ]]; then
  warn "Environment protection rules on PRIVATE repositories require GitHub Pro,"
  warn "Team or Enterprise. On a private Free repository the environments will be"
  warn "created but the reviewer requirement will be silently dropped — meaning"
  warn "Gates 2, 3 and 5 will NOT stop anything. Verify in the UI after running."
fi

# Individual usernames used when team reviewers are unavailable. Replace these
# with the real GitHub accounts of the people named in the roster.
REVIEWER_USERS="${REVIEWER_USERS:-}"

resolve_reviewers() {
  # Emits the JSON array for an environment's `reviewers` field.
  local teams=("$@")
  local json="[]"

  if $USE_USER_REVIEWERS; then
    if [[ -z "$REVIEWER_USERS" ]]; then
      echo "[]"
      return
    fi
    for user in ${REVIEWER_USERS//,/ }; do
      local uid
      uid=$(gh api "users/${user}" --jq '.id' 2>/dev/null) || {
        warn "Unknown GitHub user '${user}' — skipping."; continue; }
      json=$(jq -c --argjson id "$uid" '. + [{type:"User", id:$id}]' <<<"$json")
    done
  else
    for team in "${teams[@]}"; do
      local tid
      tid=$(gh api "orgs/${OWNER}/teams/${team}" --jq '.id' 2>/dev/null) || {
        warn "Team '${team}' does not exist in ${OWNER} — create it, then re-run."; continue; }
      json=$(jq -c --argjson id "$tid" '. + [{type:"Team", id:$id}]' <<<"$json")
    done
  fi
  echo "$json"
}

# ---------------------------------------------------------------------------
# Environments — Gates 2, 3 and 5
# ---------------------------------------------------------------------------
create_environment() {
  local name="$1" wait_timer="$2" branch_policy="$3"; shift 3
  local reviewers; reviewers=$(resolve_reviewers "$@")
  local count; count=$(jq 'length' <<<"$reviewers")

  log "Environment: ${name}"
  echo "  wait timer:  ${wait_timer} minute(s)"
  echo "  reviewers:   ${count}"
  echo "  branches:    ${branch_policy}"

  [[ "$count" -eq 0 ]] && warn "No reviewers resolved — '${name}' will NOT gate anything."

  local policy
  if [[ "$branch_policy" == "any" ]]; then
    policy='null'
  else
    policy='{"protected_branches":false,"custom_branch_policies":true}'
  fi

  local body
  body=$(jq -n \
    --argjson wait "$wait_timer" \
    --argjson reviewers "$reviewers" \
    --argjson policy "$policy" \
    '{wait_timer:$wait, prevent_self_review:true, reviewers:$reviewers, deployment_branch_policy:$policy}')

  if $DRY_RUN; then
    echo "  [dry-run] PUT repos/${REPO}/environments/${name}"
    jq . <<<"$body" | sed 's/^/    /'
  else
    gh api -X PUT "repos/${REPO}/environments/${name}" --input - <<<"$body" >/dev/null
    echo "  created."
  fi

  if [[ "$branch_policy" != "any" ]]; then
    if $DRY_RUN; then
      echo "  [dry-run] POST deployment-branch-policies name=${branch_policy}"
    else
      gh api -X POST "repos/${REPO}/environments/${name}/deployment-branch-policies" \
        -f "name=${branch_policy}" >/dev/null 2>&1 || true
      echo "  restricted to branch: ${branch_policy}"
    fi
  fi
}

#                  name          wait  branch       reviewer teams
create_environment dev            0    development
create_environment staging        0    development  "$TEAM_QA"
create_environment uat            0    development  "$TEAM_PRODUCT"
# The wait timer on production is deliberate: it makes a reflexive approval
# impossible and gives anyone watching a window to object.
create_environment production    10    main         "$TEAM_DELIVERY" "$TEAM_COMPLIANCE" "$TEAM_SRE"

# ---------------------------------------------------------------------------
# Branch protection — Gates 1 and 4
# ---------------------------------------------------------------------------
protect_branch() {
  local branch="$1" approvals="$2" enforce_admins="$3"

  log "Branch protection: ${branch}"
  echo "  required approvals:      ${approvals}"
  echo "  code owner review:       required"
  echo "  admins bound by rules:   ${enforce_admins}"

  # Only the aggregate gates are required, so adding a job to a workflow does
  # not mean editing repository settings.
  local body
  body=$(jq -n \
    --argjson approvals "$approvals" \
    --argjson admins "$enforce_admins" \
    '{
       required_status_checks: {
         strict: true,
         contexts: ["CI gate", "Security gate"]
       },
       enforce_admins: $admins,
       required_pull_request_reviews: {
         required_approving_review_count: $approvals,
         require_code_owner_reviews: true,
         dismiss_stale_reviews: true,
         require_last_push_approval: true
       },
       restrictions: null,
       allow_force_pushes: false,
       allow_deletions: false,
       required_conversation_resolution: true,
       required_linear_history: false
     }')

  if $DRY_RUN; then
    echo "  [dry-run] PUT repos/${REPO}/branches/${branch}/protection"
    jq . <<<"$body" | sed 's/^/    /'
  else
    gh api -X PUT "repos/${REPO}/branches/${branch}/protection" \
      -H "Accept: application/vnd.github+json" --input - <<<"$body" >/dev/null
    echo "  applied."
  fi
}

# development: one approval. Day-to-day flow must not be so heavy that people
# route around it.
protect_branch development 1 false

# main: two approvals and admins are bound by the same rules. This is Gate 4 —
# the release PR — and an admin who can bypass it is not a gate.
protect_branch main 2 true

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
log "Verification"

if $DRY_RUN; then
  echo "Dry run complete. Re-run without --dry-run to apply."
  exit 0
fi

echo "Environments:"
gh api "repos/${REPO}/environments" \
  --jq '.environments[] | "  \(.name): \([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers | length] | add // 0) reviewer group(s)"'

for branch in development main; do
  if gh api "repos/${REPO}/branches/${branch}/protection" >/dev/null 2>&1; then
    echo "Branch ${branch}: protected"
  else
    echo "Branch ${branch}: NOT PROTECTED"
  fi
done

cat <<'EOF'

Remaining manual steps — these have no API and must be done in the UI:

  1. Settings → Code security → enable Dependabot alerts, Dependabot security
     updates, secret scanning and push protection.
  2. Settings → Actions → General → Workflow permissions → "Read repository
     contents and packages permissions" (the workflows request what they need
     per-job).
  3. Settings → Branches → confirm no "CODEOWNERS errors" are reported. If the
     teams do not exist, GitHub ignores the file silently and Gate 1 is not real.
  4. Verify a gate actually stops something before trusting it: push a commit to
     development and confirm the "Deploy to staging" job reports "Waiting for
     approval" rather than running through.

Step 4 is the only one that proves any of this works.
EOF
