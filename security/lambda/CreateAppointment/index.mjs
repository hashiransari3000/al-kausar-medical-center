import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const ses = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});

const SES_SENDER = process.env.SES_SENDER || "";
const USER_POOL_ID = process.env.USER_POOL_ID || "ap-south-1_lK4hqogAM";

async function resolveEmail(claims) {
  if (claims.email) return claims.email;
  const username = claims.username || claims["cognito:username"];
  if (!username) return "anonymous";
  try {
    const res = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
    const emailAttr = (res.UserAttributes || []).find((a) => a.Name === "email");
    return emailAttr?.Value || "anonymous";
  } catch (error) {
    console.error("Could not resolve user email:", error.message);
    return "anonymous";
  }
}

const ALLOWED_ORIGINS = new Set([
  "https://d3sh4djt5tzbsr.cloudfront.net",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

const DEFAULT_ORIGIN = "https://d3sh4djt5tzbsr.cloudfront.net";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST"
  };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasXssPattern(value) {
  return /<\s*\w+[^>]*>|<\/?\s*script|<script|javascript:|onerror\s*=|onload\s*=/i.test(value);
}

function isValidName(value) {
  return /^[a-zA-Z][a-zA-Z .'-]{1,149}$/.test(value);
}

function isValidPhone(value) {
  return /^\+?\d[\d\s\-()]{9,19}$/.test(value);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !isNaN(Date.parse(value));
}

function validateAppointment(body) {
  const errors = [];
  const patientName = cleanText(body.patientName);
  const phone = cleanText(body.phone);
  const doctor = cleanText(body.doctor);
  const speciality = cleanText(body.speciality);
  const room = cleanText(body.room);
  const date = cleanText(body.date);
  const slot = cleanText(body.slot);
  const message = cleanText(body.message || "No message added");

  if (!patientName) errors.push("patientName is required");
  else if (!isValidName(patientName)) errors.push("patientName contains invalid characters or length");
  else if (hasXssPattern(patientName)) errors.push("patientName contains forbidden markup");

  if (!phone) errors.push("phone is required");
  else if (!isValidPhone(phone)) errors.push("phone must be 10-20 digits");

  if (!doctor) errors.push("doctor is required");
  else if (doctor.length > 100 || hasXssPattern(doctor)) errors.push("doctor is invalid");

  if (!speciality) errors.push("speciality is required");
  else if (speciality.length > 60 || hasXssPattern(speciality)) errors.push("speciality is invalid");

  if (!room) errors.push("room is required");
  else if (room.length > 30 || hasXssPattern(room)) errors.push("room is invalid");

  if (!date) errors.push("date is required");
  else if (!isValidDate(date)) errors.push("date must be a valid YYYY-MM-DD date");

  if (!slot) errors.push("slot is required");
  else if (slot.length > 30 || hasXssPattern(slot)) errors.push("slot is invalid");

  if (message.length > 500) errors.push("message must be 500 characters or fewer");
  else if (hasXssPattern(message)) errors.push("message contains forbidden markup");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    appointment: {
      appointmentId: "AKMC-APT-" + Date.now(),
      patientName,
      phone,
      doctor,
      speciality,
      room,
      date,
      slot,
      message,
      status: "Booked",
      createdAt: new Date().toISOString()
    }
  };
}

async function sendAppointmentConfirmation(appointment) {
  const to = appointment.patientEmail;
  if (!SES_SENDER || !to || to === "anonymous") return;

  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        <div style="background:#0b3d2e;color:#fff;padding:16px 24px;font-size:20px;font-weight:bold">Al-Kausar Medical Center</div>
        <div style="padding:24px;color:#222">
          <p>Dear ${appointment.patientName},</p>
          <p>Your appointment has been <strong>confirmed</strong>. Please arrive 10 minutes early and carry any relevant medical records.</p>
          <table cellpadding="8" style="border-collapse:collapse;margin:16px 0;width:100%">
            <tr><td style="background:#f4f4f4"><b>Appointment ID</b></td><td>${appointment.appointmentId}</td></tr>
            <tr><td style="background:#f4f4f4"><b>Doctor</b></td><td>${appointment.doctor} (${appointment.speciality})</td></tr>
            <tr><td style="background:#f4f4f4"><b>Date</b></td><td>${appointment.date}</td></tr>
            <tr><td style="background:#f4f4f4"><b>Time Slot</b></td><td>${appointment.slot}</td></tr>
            <tr><td style="background:#f4f4f4"><b>Room</b></td><td>${appointment.room}</td></tr>
            <tr><td style="background:#f4f4f4"><b>Status</b></td><td>${appointment.status}</td></tr>
          </table>
          <p>Thank you for choosing Al-Kausar Medical Center.</p>
          <p style="color:#888;font-size:12px">This is an automated confirmation email.</p>
        </div>
      </div>`;

    await ses.send(
      new SendEmailCommand({
        Source: SES_SENDER,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: "Appointment Confirmed - Al-Kausar Medical Center" },
          Body: { Html: { Data: html } }
        }
      })
    );
  } catch (error) {
    console.error("Confirmation email could not be sent:", error.message);
  }
}

export const handler = async (event) => {
  const origin = event.headers?.origin || "";

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: cors(origin), body: "" };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return {
        statusCode: 400,
        headers: cors(origin),
        body: JSON.stringify({ message: "Invalid JSON body" })
      };
    }
    const claims = event.requestContext?.authorizer?.jwt?.claims || {};
    const patientEmail = await resolveEmail(claims);

    const result = validateAppointment(body);

    if (!result.ok) {
      return {
        statusCode: 400,
        headers: cors(origin),
        body: JSON.stringify({ message: "Validation failed", errors: result.errors })
      };
    }

    const appointment = {
      ...result.appointment,
      patientEmail
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Appointments",
        Item: appointment
      })
    );

    await sendAppointmentConfirmation(appointment);

    return {
      statusCode: 200,
      headers: cors(origin),
      body: JSON.stringify({
        message: "Appointment booked successfully",
        appointment
      })
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: cors(origin),
      body: JSON.stringify({ message: "Failed to book appointment" })
    };
  }
};