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
      className="w-full py-2 overflow-x-auto no-scrollbar"
    >
      <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-nt-slate-500 min-w-max">
        <span>Step {currentIndex + 1} of {steps.length}</span>
        <span className="text-nt-orange-600 font-medium">{steps[currentIndex]?.title}</span>
      </div>

      <ol className="flex w-full items-center justify-between gap-1 sm:gap-1.5 min-w-0">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = completedSteps.includes(step.id);
          const isPast = index < currentIndex;
          const stepNumber = index + 1;

          return (
            <li
              key={step.id}
              className={`relative flex items-center min-w-0 ${index === steps.length - 1 ? "flex-none" : "flex-1"}`}
            >
              <div className="group relative flex flex-col items-center shrink-0">
                <span
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 shadow-xs ${
                    isActive
                      ? "bg-nt-orange-600 text-white ring-3 ring-nt-orange-600/20 scale-105"
                      : isCompleted || isPast
                      ? "bg-nt-slate-900 text-white"
                      : "border border-nt-slate-300 bg-white text-nt-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : stepNumber}
                </span>
                {!condensed && (
                  <span
                    className={`mt-1.5 hidden text-center text-[10px] sm:text-[11px] font-medium leading-tight max-w-[56px] sm:max-w-[64px] truncate md:block transition-colors ${
                      isActive
                        ? "text-nt-orange-600 font-semibold"
                        : isCompleted || isPast
                        ? "text-nt-slate-800"
                        : "text-nt-slate-400"
                    }`}
                  >
                    {step.title.includes(" ") ? step.title.replace(" ", " \u200b") : step.title}
                  </span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className="mx-0.5 sm:mx-1 h-[2px] min-w-[8px] flex-1 rounded-full bg-nt-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCompleted || isPast ? "bg-nt-orange-600 w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
