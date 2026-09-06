#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 8: Cross-Site Request Forgery (CSRF)
# Target: state-changing API endpoints (appointment/order POST)
# Attack pattern: a malicious page (evil origin) tries to make the
#   victim's BROWSER issue a state-changing request, relying on the
#   browser auto-sending cookies.
# Defense shown (SECURE implementation):
#   - Authentication uses an Authorization: Bearer JWT stored in
#     sessionStorage, NOT a cookie. A cross-origin page cannot read
#     or attach this header => classic CSRF is not exploitable.
#   - Server CORS sends Access-Control-Allow-Origin only for the
#     allow-listed clinic origin; for any other origin the response
#     header is ABSENT => the malicious read of the response is
#     blocked by the browser (no ACAO) even if the request is sent.
#   - State-changing writes are additionally validated server-side.
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

BODY='{"patientName":"CSRF Victim","phone":"03111111111","doctor":"Dr X","speciality":"Cardio","room":"R1","date":"2026-09-12","slot":"11:00 AM"}'

echo "============================================================"
echo "ATTACK 8: Cross-Site Request Forgery (CSRF)"
echo "Malicious origin attempts a state-changing request."
echo "Expect: request may complete server-side BUT has no cookie to"
echo "        exploit and the evil origin cannot read the response"
echo "        (no Access-Control-Allow-Origin for unlisted origin)."
echo "============================================================"

echo ""
echo "-- 8a. Simulated evil-origin POST (what an XSS on evil.com would try) --"
for origin in "https://evil.com" "https://phishing.io" "null" ""; do
  args=()
  [ -n "$origin" ] && args=(-H "Origin: $origin")
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/appointments" \
    -H "$AUTH" -H "Content-Type: application/json" "${args[@]}" -d "$BODY")
  printf "   Origin=%-32s -> HTTP %s\n" "${origin:-<none>}" "$code"
done

echo ""
echo "-- 8b. Readable by the attacker? (CORS reflection) --"
for origin in "https://evil.com" "https://d3sh4djt5tzbsr.cloudfront.net"; do
  acao=$(curl -s -D - -o /dev/null -X POST "$BASE/appointments" \
    -H "$AUTH" -H "Content-Type: application/json" -H "Origin: $origin" -d "$BODY" \
    | grep -i "^access-control-allow-origin" | tr -d '\r' | cut -d' ' -f2)
  printf "   Origin=%-40s allows-read=%-40s\n" "$origin" "${acao:-<NO ACCESS-CONTROL-ALLOW-ORIGIN -> browser blocks read>}"
done

echo ""
echo "-- 8c. Classic cookie-based CSRF would need a session Cookie --"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/appointments" \
  -H "Content-Type: application/json" -H "Cookie: session=fake" -d "$BODY")
printf "   POST with only a session cookie (no Bearer) -> HTTP %s (401 => cookie not accepted)\n" "$code"

echo ""
echo "RESULT: sessions are Bearer-JWT based (no auto-sent cookie), CORS is"
echo "allow-listed with no reflection to untrusted origins => response cannot be"
echo "read by an attacker; CSRF is not exploitable in the secure implementation."
echo ""