import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

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
      patientEmail: claims.email || claims.username || "anonymous"
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Appointments",
        Item: appointment
      })
    );

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