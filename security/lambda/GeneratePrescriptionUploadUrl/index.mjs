import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const BUCKET_NAME = "alkausar-prescriptions-hashir";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_ORIGINS = new Set([
  "https://d3sh4djt5tzbsr.cloudfront.net",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

const DEFAULT_ORIGIN = "https://d3sh4djt5tzbsr.cloudfront.net";

const ALLOWED_FILE_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|pdf)$/i;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST"
  };
}

function response(statusCode, origin, bodyObj) {
  return {
    statusCode,
    headers: cors(origin),
    body: JSON.stringify(bodyObj)
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
      return response(400, origin, { message: "Invalid JSON body" });
    }
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType.trim() : "";
    const fileSize = body.fileSize;

    if (!fileName || !fileType) {
      return response(400, origin, { message: "fileName and fileType are required" });
    }

    if (!ALLOWED_FILE_TYPES.has(fileType)) {
      return response(400, origin, { message: "fileType must be one of: image/jpeg, image/png, application/pdf" });
    }

    if (!ALLOWED_EXTENSIONS.test(fileName)) {
      return response(400, origin, { message: "fileName must end in .jpg, .jpeg, .png, or .pdf" });
    }

    if (fileName.length > 200) {
      return response(400, origin, { message: "fileName is too long" });
    }

    if (typeof fileSize === "number" && (fileSize <= 0 || fileSize > MAX_FILE_SIZE)) {
      return response(400, origin, { message: "fileSize must be between 1 byte and 5 MB" });
    }

    // Strip any path traversal and embeddable markup from filename
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `prescriptions/${Date.now()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300
    });

    return response(200, origin, {
      uploadUrl,
      key,
      expiresIn: 300
    });
  } catch (error) {
    console.error("Error:", error);

    return response(500, origin, { message: "Failed to generate upload URL" });
  }
};