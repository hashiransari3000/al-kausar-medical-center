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

function isValidContact(value) {
  return /^\+?\d[\d\s\-()]{9,19}$/.test(value);
}

function isSafeNumeric(value) {
  return typeof value === "number" && isFinite(value) && value >= 0;
}

function validateOrder(body) {
  const errors = [];
  const name = cleanText(body.name);
  const contact = cleanText(body.contact);
  const address = cleanText(body.address);
  const items = Array.isArray(body.items) ? body.items : [];
  const total = body.total;

  if (!name) errors.push("name is required");
  else if (!isValidName(name)) errors.push("name contains invalid characters or length");
  else if (hasXssPattern(name)) errors.push("name contains forbidden markup");

  if (!contact) errors.push("contact is required");
  else if (!isValidContact(contact)) errors.push("contact must be 10-20 digits");

  if (!address) errors.push("address is required");
  else if (address.length > 300) errors.push("address must be 300 characters or fewer");
  else if (hasXssPattern(address)) errors.push("address contains forbidden markup");

  if (!isSafeNumeric(total)) errors.push("total must be a non-negative number");

  if (items.length === 0) errors.push("items must contain at least one medicine");
  else if (items.length > 50) errors.push("too many items");
  else {
    for (const item of items) {
      const itemName = cleanText(item.name);
      if (!itemName || itemName.length > 100 || hasXssPattern(itemName)) {
        errors.push("item name is invalid");
        break;
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
        errors.push("item quantity must be between 1 and 100");
        break;
      }
      if (!isSafeNumeric(item.price)) {
        errors.push("item price must be a non-negative number");
        break;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    order: {
      orderId: "AKMC-ORD-" + Date.now(),
      name,
      contact,
      address,
      items: items.map(i => ({
        id: i.id,
        name: cleanText(i.name),
        price: i.price,
        quantity: i.quantity
      })),
      total,
      status: "Order Placed",
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
    const result = validateOrder(body);

    if (!result.ok) {
      return {
        statusCode: 400,
        headers: cors(origin),
        body: JSON.stringify({ message: "Validation failed", errors: result.errors })
      };
    }

    const order = {
      ...result.order,
      customerEmail: claims.email || claims.username || "anonymous"
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Orders",
        Item: order
      })
    );

    return {
      statusCode: 200,
      headers: cors(origin),
      body: JSON.stringify({
        message: "Order placed successfully",
        order
      })
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: cors(origin),
      body: JSON.stringify({ message: "Failed to place order" })
    };
  }
};