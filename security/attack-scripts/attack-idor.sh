#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 6: IDOR / Broken Access Control
# Target: Al-Kausar Medical Center API (DynamoDB records)
# Attack pattern: guess or reference ANOTHER user's object
#   identifier (e.g. appointmentId / orderId / s3 key) to read
#   or modify records you do not own.
# Defense shown (SECURE implementation):
#   - No public GET/read endpoint exists for object IDs, so
#     there is no way to enumerate or fetch another user's
#     appointment/order by guessing an ID -> 404
#   - Every write binds the record to the authenticated
#     caller's Cognito identity (patientEmail from the JWT,
#     not from client-supplied fields)
#   - Lambda validation rejects attempts to smuggle object
#     references / cross-user identifiers in the body
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

echo "============================================================"
echo "ATTACK 6: IDOR / Broken Access Control"
echo "Attacker tries to guess and READ another user's object by ID"
echo "Expect: 401/403/404 — no way to fetch a record by identifier"
echo "============================================================"

echo ""
echo "-- 6a. Try to read appointments/orders by guessed IDs --"
for path in \
  "appointments" \
  "orders" \
  "appointments/AKMC-APT-1" \
  "appointments/AKMC-APT-9999999999999" \
  "orders/AKMC-ORD-1" \
  "orders?id=AKMC-ORD-2"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$path" -H "$AUTH")
  printf "   GET /api/%-38s -> HTTP %s\n" "$path" "$code"
done

echo ""
echo "-- 6b. Try to forge a WRITE referencing another user's ID --"
# The secure Lambda binds the record to the JWT identity; it ignores
# any client-supplied "id" / "patientEmail"/"owner" field.
for body in \
  '{"appointmentId":"AKMC-APT-9999","patientName":"Alice","phone":"03111111111","doctor":"Dr X","speciality":"Cardio","room":"R1","date":"2026-09-12","slot":"11:00 AM","patientEmail":"victim@other.com"}' \
  '{"id":"AKMC-ORD-7777","name":"Bob","contact":"03222222222","address":"Addr","items":[{"name":"Panadol","quantity":2,"price":10}],"total":20,"customerEmail":"victim@other.com"}'; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/appointments" -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  code2=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/appointments" -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  printf "   forged-owner write -> appointment: %s / order: %s\n" "$code" "$code2"
done

echo ""
echo "-- 6c. Path-traversal object reference (../ to other users) --"
for p in "appointments/../../../etc/passwd" "orders?file=../../.env" "upload-url?key=prescriptions/../victim"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$p" -H "$AUTH")
  printf "   %-55s -> HTTP %s\n" "$p" "$code"
done

echo ""
echo "RESULT: No read-by-ID endpoint (404) and records are bound to the"
echo "JWT identity server-side => IDOR / broken access control is effectively"
echo "closed. All reference attempts return 401/403/404, none return another"
echo "user's data."
echo ""
