#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 2: SQL Injection payloads
# Target: Al-Kausar Medical Center API (DynamoDB backend)
# Defense shown:
#   - AWS WAF SQLi managed rules block at the edge -> HTTP 403
#   - Backend is NoSQL DynamoDB (immune to classic SQLi)
#   - Lambda validation rejects malformed/malicious input -> 400
# ============================================================
BASE="https://d3sh4djt5tzbsr.cloudfront.net"
echo "============================================================"
echo "ATTACK 2: SQL Injection -> API Gateway /appointments"
echo "Expect: AWS WAF blocks with HTTP 403 (or 400 from Lambda)"
echo "============================================================"

PAYLOADS=(
  "1' OR '1'='1"
  "1; DROP TABLE appointments; --"
  "admin' --"
  "' UNION SELECT username,password FROM users--"
  "1' AND SLEEP(5)--"
  "' OR 1=1 /*"
)

i=0
for p in "${PAYLOADS[@]}"; do
  i=$((i+1))
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$p")
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/appointments?id=${enc}")
  printf "  payload %d: %-55s -> HTTP %s\n" "$i" "${p:0:50}" "$code"
done

# SQLi in the JSON body (this must be caught by Lambda validation/hardening)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/appointments" \
  -H "Content-Type: application/json" \
  --data '{"patientName":"'\'' OR 1=1--","phone":"03180215568","doctor":"D","speciality":"S","room":"R","date":"2026-09-10","slot":"A"}')
printf "  body SQLi: %-55s -> HTTP %s (400 = validated by Lambda)\n" "patientName=' OR 1=1--" "$code"

echo ""
echo "Result: 403 = WAF blocked. 400 = Lambda validation rejected. No 200 = data safe."
echo ""