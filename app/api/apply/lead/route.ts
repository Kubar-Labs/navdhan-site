import { NextResponse } from "next/server";

const PURPOSE_OPTIONS = [
  "working_capital",
  "machinery",
  "inventory",
  "business_expansion",
  "debt_refinancing",
  "other",
];

function isValidLoanAmount(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 500_000 && n <= 10_000_000;
}

function isValidTenure(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 3 && n <= 12;
}

function isValidPurpose(value: unknown): boolean {
  return typeof value === "string" && PURPOSE_OPTIONS.includes(value);
}

function isValidName(value: unknown): boolean {
  return typeof value === "string" && /^[A-Za-z\s'.-]{2,150}$/.test(value.trim());
}

function isValidMobile(value: unknown): boolean {
  return typeof value === "string" && /^[6-9]\d{9}$/.test(value);
}

function isValidEmail(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPinCode(value: unknown): boolean {
  return typeof value === "string" && /^[1-9]\d{5}$/.test(value);
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid JSON" }, { status: 400 });
  }

  const errors: { field: string; message: string }[] = [];
  if (!isValidLoanAmount(body.amount)) errors.push({ field: "amount", message: "Invalid loan amount" });
  if (!isValidTenure(body.tenure)) errors.push({ field: "tenure", message: "Invalid tenure" });
  if (!isValidPurpose(body.purpose)) errors.push({ field: "purpose", message: "Invalid purpose" });
  if (!isValidName(body.fullName)) errors.push({ field: "fullName", message: "Invalid name" });
  if (!isValidMobile(body.mobile)) errors.push({ field: "mobile", message: "Invalid mobile number" });
  if (!isValidEmail(body.email)) errors.push({ field: "email", message: "Invalid email" });
  if (!isValidPinCode(body.pinCode)) errors.push({ field: "pinCode", message: "Invalid PIN code" });
  if (body.consentData !== true || body.consentLender !== true) {
    errors.push({ field: "consent", message: "Consent is required" });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "VALIDATION_ERROR", errors }, { status: 422 });
  }

  // NOTE: This is a lightweight MVP lead-capture stub. In production, persist
  // the lead to the database and trigger the follow-up workflow.
  return NextResponse.json({ success: true, received_at: new Date().toISOString() });
}
