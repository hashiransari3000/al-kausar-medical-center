#!/usr/bin/env bash
# ============================================================
# VERIFICATION: check all security alarms + subscriptions
# Shows each protection control is active and fed by metrics
# ============================================================
export PATH="$PATH:/home/hashir3000/awscli"
REGION="ap-south-1"

echo "============================================================"
echo "SECURITY MONITORING HEALTH CHECK"
echo "============================================================"

echo ""
echo "-- SNS Email subscriptions (must be 'Confirmed') --"
aws sns list-subscriptions-by-topic --topic-arn "arn:aws:sns:ap-south-1:593521254468:AlKausarMedicalAlerts" --region "$REGION" \
  --query 'Subscriptions[].[Endpoint,SubscriptionArn,Owner]' --output text
aws sns list-subscriptions-by-topic --topic-arn "arn:aws:sns:us-east-1:593521254468:AlKausarWAFAlerts" --region us-east-1 \
  --query 'Subscriptions[].[Endpoint,SubscriptionArn,Owner]' --output text

echo ""
echo "-- CloudWatch Alarm states (ALARM = fired, OK = waiting) --"
for a in AlKausarApi4xxSpike CreateAppointmentErrorAlarm CreateOrderErrorAlarm GeneratePrescriptionUploadUrlErrorAlarm; do
  st=$(aws cloudwatch describe-alarms --alarm-names "$a" --region "$REGION" --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null)
  [ "$st" = "ALARM" ] && mark="** FIRED **" || mark=""
  printf "   %-40s %s %s\n" "$a" "$st" "$mark"
done
# CloudFront WAF alarm lives in us-east-1 (metrics are global for CloudFront)
st=$(aws cloudwatch describe-alarms --alarm-names AlKausarCloudFrontWAFBlocked --region us-east-1 --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null)
[ "$st" = "ALARM" ] && mark="** FIRED **" || mark=""
printf "   %-40s %s %s\n" "AlKausarCloudFrontWAFBlocked" "$st" "$mark"

echo ""
echo "-- WAF rule exposure (web ACL counts) --"
aws wafv2 get-web-acl --name AlKausarCloudFrontWAF --scope CLOUDFRONT --id 4fadc407-17ea-4b95-99fa-c6f7c783106f --region us-east-1 \
  --query 'WebACL.{DefaultAction:DefaultAction, ARN:ARN}' --output text
echo ""