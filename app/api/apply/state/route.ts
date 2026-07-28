import { extractSessionId } from "@/src/lib/apply/server/session";
import {
  csrfInvalidResponse,
  sessionInvalidResponse,
  validationErrorResponse,
} from "@/src/lib/apply/server/errors";
import { getOrCreateApplication, touchApplication } from "@/src/lib/apply/server/store";
import { APPLICATION_STEPS, type ApplicationStep } from "@/src/types/apply";
import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import {
  readJsonBody,
  validateLoanIntentPayload,
  validatePersonalContactPayload,
  validateAadhaarPayload,
  validatePanPayload,
  validateGstPayload,
  jsonResponse,
} from "@/app/api/apply/lib/helpers";

export async function GET(request: Request): Promise<Response> {
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return sessionInvalidResponse();
  }
  const url = new URL(request.url);
  const requestedApplicationId = url.searchParams.get("application_id") ?? undefined;
  const app = getOrCreateApplication(sessionId, requestedApplicationId);
  return jsonResponse({
    application_id: app.id,
    current_step: app.currentStep,
    status: app.status,
    expires_at: app.expiresAt,
    values: {},
  });
}

const STEP_VALIDATORS: Record<
  ApplicationStep,
  ((payload: Record<string, unknown>) => { field: string; message_i18n_key: string }[]) | null
> = {
  loan_intent: validateLoanIntentPayload,
  personal_contact: validatePersonalContactPayload,
  aadhaar_verification: validateAadhaarPayload,
  pan_verification: validatePanPayload,
  gst_verification: validateGstPayload,
  itr_upload: null,
  bank_statements: null,
  review_submit: null,
  submission_result: null,
};

function isApplicationStep(value: unknown): value is ApplicationStep {
  return typeof value === "string" && APPLICATION_STEPS.includes(value as ApplicationStep);
}

function stepIndex(step: ApplicationStep): number {
  return APPLICATION_STEPS.indexOf(step);
}

function nextStep(currentStep: ApplicationStep): ApplicationStep | null {
  const index = stepIndex(currentStep);
  if (index < 0 || index >= APPLICATION_STEPS.length - 1) return null;
  return APPLICATION_STEPS[index + 1] ?? null;
}

function advanceFromPayload(
  currentStep: ApplicationStep,
  payload: Record<string, unknown>,
): ApplicationStep | null {
  if (currentStep === "gst_verification" && payload.gstin_skipped === true) {
    const idx = APPLICATION_STEPS.indexOf("gst_verification");
    return APPLICATION_STEPS[idx + 1] ?? null;
  }
  return nextStep(currentStep);
}

export async function POST(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) {
    return csrfInvalidResponse();
  }
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return sessionInvalidResponse();
  }

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const requestedApplicationId =
    typeof body.application_id === "string" && body.application_id
      ? body.application_id
      : undefined;
  const app = getOrCreateApplication(sessionId, requestedApplicationId);
  const requestedStep = body.current_step;

  if (!isApplicationStep(requestedStep)) {
    return validationErrorResponse([
      { field: "current_step", message_i18n_key: "apply.errors.invalidStep" },
    ]);
  }

  const currentIdx = stepIndex(app.currentStep);
  const requestedIdx = stepIndex(requestedStep);

  // Re-submission of the current or any earlier step is allowed; skipping ahead is not.
  if (requestedIdx > currentIdx) {
    return jsonResponse(
      {
        error: "INVALID_TRANSITION",
        current_step: app.currentStep,
        expected_step: app.currentStep,
      },
      409,
    );
  }

  const payload =
    typeof body.payload === "object" && body.payload !== null
      ? (body.payload as Record<string, unknown>)
      : {};

  const validator = STEP_VALIDATORS[requestedStep];
  if (validator) {
    const fieldErrors = validator(payload);
    if (fieldErrors.length > 0) {
      return validationErrorResponse(fieldErrors);
    }
  }

  mergePayloadIntoApplication(app, requestedStep, payload);
  const next = advanceFromPayload(requestedStep, payload);
  if (next) {
    app.currentStep = next;
  }
  touchApplication(app);

  return jsonResponse({
    application_id: app.id,
    current_step: app.currentStep,
    status: app.status,
    expires_at: app.expiresAt,
  });
}

function mergePayloadIntoApplication(
  app: ReturnType<typeof getOrCreateApplication>,
  step: ApplicationStep,
  payload: Record<string, unknown>,
): void {
  switch (step) {
    case "loan_intent":
      if (typeof payload.loan_amount === "number") {
        app.loanAmount = String(payload.loan_amount);
      }
      if (typeof payload.tenure_months === "number") {
        app.tenureMonths = payload.tenure_months;
      }
      if (typeof payload.purpose === "string") {
        app.purpose = payload.purpose as typeof app.purpose;
      }
      if (payload.referral_code === null || typeof payload.referral_code === "string") {
        app.referralCode = (payload.referral_code as string | null) || null;
      }
      break;
    default:
      break;
  }
}
