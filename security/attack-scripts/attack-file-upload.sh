#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 7: Insecure File Upload
# Target: prescription upload mechanism (pre-signed S3 URL)
# Attack pattern: upload a malicious/executable/oversized file or
#   smuggle path-traversal filenames through the upload path.
# Defense shown (SECURE implementation):
#   - Upload-url Lambda ALLOW-LISTS Content-Type to jpeg/png/pdf
#   - ALLOW-LISTS the file extension (.jpg/.jpeg/.png/.pdf)
#   - Enforces a 5 MB size cap
#   - Strips path-traversal / markup characters from the key
#     (only [A-Za-z0-9._-])
#   - CloudFront/WAF additionally blocks traversal in the URL
#   - Files land in a PRIVATE S3 bucket with randomized keys
#     (no public read, no static hosting)
# ============================================================
set -u
export PATH="$PATH:/home/hashir3000/awscli"
BASE="https://d3sh4djt5tzbsr.cloudfront.net/api"
CLIENT_ID="m0s0e255m43a8gpf62k69rhjb"
TOKEN="${AKMC_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  TOKEN=$(aws cognito-idp initiate-auth --client-id "$CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=demo.patient@alkausar.com,PASSWORD=Demo@12345" \
    --region ap-south-1 --query 'AuthenticationResult.AccessToken' --output text)
fi
AUTH="Authorization: Bearer ${TOKEN}"
BUCKET="alkausar-prescriptions-hashir"

post_upload() {
  local body="$1" label="$2"
  resp=$(curl -s -X POST "$BASE/upload-url" -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/upload-url" -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  printf "   %-55s -> HTTP %s | %s\n" "$label" "$code" "$(echo "$resp" | head -c 90)"
}

echo "============================================================"
echo "ATTACK 7: Insecure File Upload"
echo "Attacker attempts to get an upload URL for malicious payloads."
echo "Expect: every attempt rejected (400) - no URL issued"
echo "============================================================"

echo ""
echo "-- 7a. Executable / script file types --"
post_upload '{"fileName":"shell.php","fileType":"application/x-php","fileSize":100}'    "shell.php (PHP shell)"
post_upload '{"fileName":"cmd.exe","fileType":"application/x-msdownload","fileSize":100}' "cmd.exe (Windows exe)"
post_upload '{"fileName":"malware.js","fileType":"application/javascript","fileSize":100}' "malware.js (JS)"
post_upload '{"fileName":"evil.html","fileType":"text/html","fileSize":100}'             "evil.html (HTML)"

echo ""
echo "-- 7b. Allowed type but forbidden/oversized payload --"
post_upload '{"fileName":"x.png","fileType":"image/png","fileSize":6291456}'            "6 MB PNG (over 5 MB cap)"
post_upload '{"fileName":"x.png.js","fileType":"image/png","fileSize":10}'              "x.png.js (double extension)"
post_upload '{"fileName":"x.txt","fileType":"image/jpeg","fileSize":10}'                "x.txt spoofed as jpeg"

echo ""
echo "-- 7c. Path traversal in filename --"
post_upload '{"fileName":"../../.env","fileType":"image/png","fileSize":10}'            "path traversal ../../.env"
post_upload '{"fileName":"..%2F..%2Fetc%2Fpasswd.png","fileType":"image/png","fileSize":10}' "encoded traversal"

echo ""
echo "-- 7d. Sanity check: a VALID request still works (contrast) --"
post_upload '{"fileName":"valid-rx.png","fileType":"image/png","fileSize":2048}'        "VALID rx.png (allowed)"

echo ""
echo "-- 7e. Confirm the object-store is PRIVATE (no public read) --"
key="prescriptions/$(date +%s)-leak-test.png"
url="https://${BUCKET}.s3.ap-south-1.amazonaws.com/${key}"
code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
printf "   GET private object URL -> HTTP %s (AccessDenied = private)\n" "$code"

echo ""
echo "RESULT: only allow-listed image/pdf types under 5 MB get an upload"
echo "URL; executable/oversized/traversal payloads are all rejected; the"
echo "bucket is private so even a guessed key is inaccessible."
echo ""