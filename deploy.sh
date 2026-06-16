#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# The Imitation Gate — one-command deploy (single Cloud Run service: game + API).
# Your Gemini key lives ONLY as a Cloud Run secret. It is never in the game code.
# Re-run any time to redeploy. Requires: gcloud CLI + Node. See DEPLOY-BACKEND.md.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

echo "── The Imitation Gate · deploy ──────────────────────────────"
echo "(tip: list your project ids with  gcloud projects list )"
# Each value can come from the environment (e.g. after: set -a; source .env; set +a)
# or you'll be prompted. Project id ≠ project name — see 'gcloud projects list'.
PROJECT="${PROJECT:-}"; [ -z "$PROJECT" ] && read -rp "GCP project id: " PROJECT
REGION="${REGION:-}"; [ -z "$REGION" ] && { read -rp "Region [us-central1]: " REGION; REGION=${REGION:-us-central1}; }
GEMKEY="${GEMINI_API_KEY:-}"; [ -z "$GEMKEY" ] && { read -rsp "Paste your Gemini API key (hidden): " GEMKEY; echo; }
# Model: flagship by default; type gemini-3.1-flash for faster/cheaper voicing.
MODEL="${GEMINI_MODEL:-}"; [ -z "$MODEL" ] && { read -rp "Gemini model [gemini-3.1-pro]: " MODEL; MODEL=${MODEL:-gemini-3.1-pro}; }
[ -z "$PROJECT" ] && { echo "No project id — aborting."; exit 1; }
[ -z "$GEMKEY" ] && { echo "No Gemini key — aborting."; exit 1; }

echo "→ Setting project + enabling APIs…"
gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com >/dev/null

echo "→ Ensuring Firestore database (ignore error if it already exists)…"
gcloud firestore databases create --location="nam5" --type=firestore-native 2>/dev/null || true

echo "→ Storing the Gemini key in Secret Manager…"
if gcloud secrets describe gemini-key >/dev/null 2>&1; then
  printf "%s" "$GEMKEY" | gcloud secrets versions add gemini-key --data-file=- >/dev/null
else
  printf "%s" "$GEMKEY" | gcloud secrets create gemini-key --data-file=- >/dev/null
fi
unset GEMKEY

echo "→ Building the game into server/public…"
node build.js >/dev/null

echo "→ Deploying to Cloud Run (game + API, one service)…"
gcloud run deploy imitation-gate \
  --source server \
  --region "$REGION" \
  --allow-unauthenticated \
  --max-instances 2 \
  --set-secrets GEMINI_API_KEY=gemini-key:latest \
  --set-env-vars "GEMINI_MODEL=$MODEL,DAILY_VOICE_CAP=2000,PER_IP_PER_MIN=20"

URL=$(gcloud run services describe imitation-gate --region "$REGION" --format='value(status.url)')

echo "→ Locking the API to your own URL (so no other site can use your key)…"
gcloud run services update imitation-gate --region "$REGION" \
  --update-env-vars "ALLOWED_ORIGINS=$URL" >/dev/null

# Grant Firestore access to the runtime service account. Cloud Run uses the
# project's DEFAULT compute SA unless a custom one is set, and `describe` reports
# it as empty in that case — so resolve it from the project number explicitly.
echo "→ Granting the runtime service account Firestore access…"
SA=$(gcloud run services describe imitation-gate --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')
if [ -z "$SA" ]; then
  NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
  SA="${NUM}-compute@developer.gserviceaccount.com"
fi
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$SA" --role="roles/datastore.user" >/dev/null \
  && echo "   granted roles/datastore.user to $SA" \
  || echo "   ⚠ could not grant to $SA — do it once in the Console (IAM → grant Cloud Datastore User)."

echo ""
echo "✅ Live: $URL"
echo "   Open it — Daily Gate & Long Shift are Gemini-voiced for everyone, no key needed."
echo "   Health check: curl $URL/api/health"
echo ""
echo "⚠️  Last step (2 min): Console → Billing → Budgets → create a \$5 budget alert."
echo "   Keep the Gemini key on the free tier and a bill is impossible."
echo ""
echo "When judging ends: gcloud run services delete imitation-gate --region $REGION"
echo "(and rotate the key in AI Studio). The game keeps working offline regardless."
