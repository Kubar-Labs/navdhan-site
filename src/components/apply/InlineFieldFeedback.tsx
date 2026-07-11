import { cn } from "@/src/lib/utils/cn";

export type InlineFieldFeedbackState = "idle" | "info" | "warning" | "error";

export interface InlineFieldFeedbackProps {
  fieldId: string;
  state: InlineFieldFeedbackState;
  messageTemplate: string;
  variables?: Record<string, string | number>;
}

const stateClasses: Record<InlineFieldFeedbackState, string> = {
  idle: "text-nt-slate-500",
  info: "text-nt-slate-600",
  warning: "text-nt-amber-600",
  error: "text-nt-red-500",
};

function renderTemplate(template: string, variables?: Record<string, string | number>): string {
  if (!variables) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function InlineFieldFeedback({
  fieldId,
  state,
  messageTemplate,
  variables,
}: InlineFieldFeedbackProps) {
  if (!messageTemplate) return null;
  return (
    <p
      id={`${fieldId}--feedback`}
      className={cn("mt-1 text-xs", stateClasses[state])}
      role={state === "error" ? "alert" : undefined}
    >
      {renderTemplate(messageTemplate, variables)}
    </p>
  );
}
