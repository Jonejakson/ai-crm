#!/bin/bash
set -e

cd "C:/ai_crm/my-app"

cat <<'EOF' > /tmp/commit-message.txt
feat: billing, owner, and support updates

Apply pending billing changes, trial switching, owner dashboard/support ticket updates, and related UI/infra adjustments.
EOF

git add .
git commit -m "$(cat /tmp/commit-message.txt)"
rm /tmp/commit-message.txt
git status --short
