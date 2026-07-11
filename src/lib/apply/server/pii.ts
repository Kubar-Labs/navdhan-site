/**
 * PII masking helpers.
 *
 * Rules follow backend-cdd.md section 5.2.
 * Never log or return full Aadhaar, PAN, mobile, or other identifiers.
 */

export function maskFullName(value: string | null | undefined): string {
  if (!value) return "[REDACTED]";
  const first = value.trim().split(/\s+/)[0];
  if (!first) return "[REDACTED]";
  return `${first} ***`;
}

export function maskMobileNumber(mobile: string | null | undefined): string {
  if (!mobile || mobile.length < 4) return "XXXXXX****";
  const head = mobile.slice(0, 2);
  const tail = mobile.slice(-4);
  const middleLength = Math.max(0, mobile.length - 6);
  return `${head}${"X".repeat(middleLength)}${tail}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "[REDACTED]";
  const [local, domain] = email.split("@");
  if (!domain) return "[REDACTED]";
  const maskedLocal =
    local.length > 0 ? `${local[0]}${"*".repeat(Math.max(0, local.length - 1))}` : "*";
  return `${maskedLocal}@${domain}`;
}

export function maskAadhaarNumber(aadhaar: string | null | undefined): string {
  if (!aadhaar || aadhaar.length < 4) return "XXXX XXXX ****";
  const lastFour = aadhaar.slice(-4);
  return `XXXX XXXX ${lastFour}`;
}

export function maskPanNumber(pan: string | null | undefined): string {
  if (!pan || pan.length < 3) return "XXXXX****X";
  if (pan.length !== 10) {
    const head = pan.slice(0, Math.min(5, pan.length));
    return `${head}****X`;
  }
  return `${pan.slice(0, 5)}***${pan.slice(-1)}`;
}

export function maskGstin(gstin: string | null | undefined): string {
  if (!gstin || gstin.length < 5) return "**[REDACTED]**";
  const head = gstin.slice(0, 2);
  const tail = gstin.slice(-3);
  const middleLength = Math.max(0, gstin.length - 5);
  return `${head}${"*".repeat(middleLength)}${tail}`;
}

export function maskBusinessPinCode(pin: string | null | undefined): string {
  if (!pin || pin.length < 4) return "XXXXXX";
  const head = pin.slice(0, 2);
  const tail = pin.slice(-2);
  const middleLength = Math.max(0, pin.length - 4);
  return `${head}${"X".repeat(middleLength)}${tail}`;
}

export function redact(value: string | null | undefined): string {
  return value ? "[REDACTED]" : "[REDACTED]";
}

const PII_MASKERS: Record<string, ((value: string | null | undefined) => string) | undefined> = {
  full_name: maskFullName,
  mobile_number: maskMobileNumber,
  phone: maskMobileNumber,
  email: maskEmail,
  aadhaar_number: maskAadhaarNumber,
  aadhaar: maskAadhaarNumber,
  pan_number: maskPanNumber,
  pan: maskPanNumber,
  gstin: maskGstin,
  business_pin_code: maskBusinessPinCode,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeForLogs<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogs(item)) as unknown as T;
  }
  if (!isRecord(obj)) {
    return obj;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const masker = PII_MASKERS[key.toLowerCase()];
    if (masker) {
      result[key] = masker(obj[key] as string | null | undefined);
    } else if (isRecord(obj[key]) || Array.isArray(obj[key])) {
      result[key] = sanitizeForLogs(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result as T;
}
