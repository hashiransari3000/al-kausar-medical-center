# InfoSec Lab — Al-Kausar Medical Center on AWS
## Security hard-ening, live attack demos, and alerting

This project converts the existing Al-Kausar Medical Center serverless application
into a security-learning lab. Real AWS-native controls were installed and real
attacks were run against the live site to prove each control works.

---

## 1. What already existed
- S3 website bucket `alkausar-medical-center-hashir` + CloudFront `E254YSDM3NUG6Y`
- API Gateway (HTTP API) `5wkbhqk1n9` with Lambdas:
  - `CreateAppointment`, `CreateOrder`, `GeneratePrescriptionUploadUrl`
- DynamoDB tables `Appointments`, `Orders`
- **No auth, no validation, no WAF, wildcard CORS** (the "before" state)

## 2. Security controls added

| Layer | Control | Resource |
|---|---|---|
| Identity | Amazon Cognito User Pool `AlKausarPatientPool` | `ap-south-1_lK4hqogAM` |
| API auth | Cognito JWT authorizer on all POST routes | authorizer `7yvp13` |
| Edge defense | AWS WAF (cloudfront scope) | `AlKausarCloudFrontWAF` |
| Rate control | WAF rate-based rule (1000 req/5 min/IP) | — |
| API rate control | API Gateway throttling 20 req/s, burst 60 | `5wkbhqk1n9` |
| Input validation | Lambda hardening (regex, type checks, XSS filter) | 3 Lambdas |
| CORS lock-down | Allow-list origins (CloudFront + localhost dev) | stage CORS |
| Audit | access-logging → CloudWatch `/aws/apigateway/alkausar-http-api` | — |
| Alerting | 7 CloudWatch alarms → SNS → email | `AlKausarMedicalAlerts` + `AlKausarWAFAlerts` |

### WAF rules (AWS managed rule groups)
- Cross-site scripting (XSS) rules — `AWSManagedRulesCommonRuleSet`
- SQL injection rules — `AWSManagedRulesSQLiRuleSet`
- Known bad inputs (PHP/cmd injection, path traversal) — `AWSManagedRulesKnownBadInputsRuleSet`
- Bot / bad-reputation IP block — `AWSManagedRulesAmazonIpReputationList`
- Rate-based rule — caps requests per IP

> **Design note:** AWS WAF (regional) cannot attach to API Gateway **HTTP APIs**, so
> API traffic is routed through CloudFront under `/api/*`, putting the SAME WAF in
> front of both the website and the API.

## 3. New Click-through flow
1. User opens `https://d3sh4djt5tzbsr.cloudfront.net/`
2. "Patient Login" → AWS Hosted UI (Cognito) at `alkausar-lab.auth...`
3. Sign in (PKCE OAuth `code` flow) → redirect back to `/login.html` → token stored
4. Appointment/Order/Prescription forms now attach `Authorization: Bearer <token>`
5. Logged-out or expired users are redirected to login (401 handling)

## 4. Attack scripts & verified results

| Script | Attack | Expected | Verified |
|---|---|---|---|
| `attack-xss.sh` | XSS payloads (script/svg/onerror) | 403 (WAF) | ✅ 7/7 = 403 |
| `attack-sqli.sh` | SQLi payloads (`' OR 1=1`, `UNION SELECT`, `DROP`) | 403 (WAF) / 400 (Lambda) | ✅ 7/7 = 403 |
| `attack-unauthed-api.sh` | no token + forged JWT | 401 (authorizer) | ✅ 8/8 = 401 |
| `attack-brute-force.sh` | password guessing | rejected (NotAuthorized) | ✅ 40/40 rejected |
| `attack-bot-flood.sh` | API flood | throttling 429/503 | ✅ 40-burst → 26×503 + 14×200 |

Representative results from the live edge:

```
POST /api/appointments?id=1' OR '1'='1            -> HTTP 403   (WAF SQLi)
POST /api/appointments  {"q":"<script>alert(1)</script>"} -> HTTP 403 (WAF XSS)
POST /api/appointments (no token)                 -> HTTP 401   (JWT authorizer)
POST /api/orders (forged token)                   -> HTTP 401
login attempts with wrong password                -> NotAuthorized (Cognito)
```

**Verified alert firing:** during the attack demos, `AlKausarApi4xxSpike`
**went to `ALARM`** (the wave of 401/403 responses exceeded the 4xx threshold),
proving the CloudWatch → SNS email alert pipeline works (emails deliver after the
subscription is confirmed).

### CloudWatch alarms → SNS email
| Alarm | Metric | Threshold |
|---|---|---|
| `AlKausarApi4xxSpike` | 4xx | > 40 / 5 min |
| `AlKausarCloudFrontWAFBlocked` | CloudFront WAF BlockedRequests | > 0 / 5 min |
| `CreateAppointmentErrorAlarm` | Errors | > 0 |
| `CreateOrderErrorAlarm` | Errors | > 0 |
| `GeneratePrescriptionUploadUrlErrorAlarm` | Errors | > 0 |

> **Brute-force**: Amazon Cognito natively rejects every wrong password
> (`NotAuthorizedException`) — verified 40/40 rapid attempts all failed. Cognito does
> **not** publish a `SignInFailures` CloudWatch metric (even with Advanced Security /
> Threat Protection enabled, which we tested and reverted to avoid cost), so brute-force
> is demonstrated via the native rejection rather than a CloudWatch alarm.

## 5. Running the demo
```bash
cd security/attack-scripts
./attack-xss.sh            # XSS blocked
./attack-sqli.sh           # SQLi blocked
./attack-unauthed-api.sh   # 401 without token
./attack-brute-force.sh    # failed logins + alarm
./attack-bot-flood.sh      # (valid token) throttling
./check-alerts.sh          # alarm + subscription status
```

## 6. Notes / caveats for the report
- SNS email subscriptions must be clicked "Confirm" before alerts deliver.
- SignInFailures metric + alarm update take ~2–3 minutes to appear.
- The WAF `AlKausarApiWAF` (regional) was created first but is **not attachable to
  an HTTP API**; it is intentionally unused in favor of the CloudFront WAF.
- Access tokens are short-lived (1 h); re-login required for continued testing.
- AWS CLI: `export PATH=$PATH:/home/hashir3000/awscli` (account `593521254468`).