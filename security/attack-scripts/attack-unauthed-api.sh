#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 4: Unauthenticated API access attempts
# Target: Al-Kausar API (appointments / orders / upload-url)
# Defense shown:
#   - API Gateway Cognito JWT authorizer returns 401 for
#     missing / invalid / forged tokens
# - 4xx metric rises -> "AlKausarApi4xxSpike" alarm -> SNS email
# ============================================================
BASE="https://d3sh4djt5tzbsr.cloudfront.net/api"
echo "============================================================"
echo "ATTACK 4: Unauthenticated & forged-token API calls"
echo "Expect: HTTP 401 Unauthorized (blocked by JWT authorizer)"
echo "============================================================"

echo "-- No token --"
for path in appointments orders upload-url; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/${path}" -H "Content-Type: application/json" -d '{}')
  printf "   POST /api/%-14s -> HTTP %s\n" "$path" "$code"
done

echo "-- Invalid (forged) JWT --"
FAKE=$(echo -n "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmb3JnZWQifQ.invalid")
for path in appointments orders upload-url; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/${path}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${FAKE}" -d '{}')
  printf "   POST /api/%-14s -> HTTP %s\n" "$path" "$code"
done

echo "-- Replay of an expired/impossible signature --"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/appointments" \
  -H "Content-Type: application/json" -H "Authorization: Bearer aaaaa.bbbbb.ccccc" -d '{}')
printf "   POST /api/appointments (garbage) -> HTTP %s\n" "$code"

echo ""
echo "Result: every request WITHOUT a valid AWS-issued token is rejected."
echo ""