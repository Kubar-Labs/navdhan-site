"use client";

import { Check } from "lucide-react";
import { WizardStepId } from "@/app/apply/lib/types";

export interface WizardStepDefinition {
  id: WizardStepId;
  title: string;
  description?: string;
}

export interface StepperLabels {
  stepLabel?: (current: number, total: number) => string;
}

export interface StepperProps {
  steps: WizardStepDefinition[];
  currentStepId: WizardStepId;
  completedSteps?: WizardStepId[];
  condensed?: boolean;
  labels?: StepperLabels;
}

export function Stepper({
  steps,
  currentStepId,
  completedSteps = [],
  condensed = false,
  labels,
}: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <nav
      aria-label={
        labels?.stepLabel
          ? labels.stepLabel(currentIndex + 1, steps.length)
          : `Step ${currentIndex + 1} of ${steps.length}`
      }
      className="w-full"
    >
      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = completedSteps.includes(step.id);
          const isPast = index < currentIndex;
          const stepNumber = index + 1;

          return (
            <li
              key={step.id}
              className={`relative flex ${index === steps.length - 1 ? "flex-none" : "flex-1"}`}
            >
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isActive || isCompleted
                      ? "bg-nt-orange-600 text-white"
                      : "border border-nt-slate-300 text-nt-slate-500"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </span>
                {!condensed && (
                  <span
                    className={`mt-2 hidden text-center text-xs font-medium sm:block ${
                      isActive || isCompleted || isPast ? "text-nt-slate-900" : "text-nt-slate-500"
                    }`}
                  >
                    {step.title.includes(" ") ? step.title.replace(" ", " \u200b") : step.title}
                  </span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 mt-4 h-px flex-1 ${
                    isCompleted || isPast ? "bg-nt-orange-600" : "bg-nt-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
