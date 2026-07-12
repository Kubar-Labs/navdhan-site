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
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId));

  const formatStepTitle = (title: string) => {
    return title.includes(" ") ? title.replace(" ", " \u200b") : title;
  };

  return (
    <nav
      aria-label={
        labels?.stepLabel
          ? labels.stepLabel(currentIndex + 1, steps.length)
          : `Step ${currentIndex + 1} of ${steps.length}`
      }
      className="w-full"
    >
      {/* Mobile/Tablet progress indicator - below 768px */}
      <div className="md:hidden flex flex-col gap-2.5 px-1 py-2">
        <div className="flex justify-between items-center text-xs font-semibold tracking-wide text-nt-slate-600">
          <span>{`Step ${currentIndex + 1} of ${steps.length}`}</span>
          <span className="text-nt-orange-600 font-bold">
            {formatStepTitle(steps[currentIndex]?.title ?? "")}
          </span>
        </div>
        <div className="w-full bg-nt-slate-100 h-2 rounded-full overflow-hidden border border-nt-slate-200/30">
          <div
            className="bg-gradient-to-r from-nt-orange-500 to-nt-orange-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop/Tablet detailed stepper - 768px and up */}
      <div className="hidden md:block relative px-4 py-6">
        {/* Background connector line */}
        <div className="absolute left-[32px] right-[32px] top-10 h-0.5 -translate-y-1/2 bg-nt-slate-200 z-0" />

        {/* Foreground active progress line */}
        <div
          className="absolute left-[32px] right-[32px] top-10 h-0.5 -translate-y-1/2 bg-nt-orange-600 transition-all duration-500 ease-in-out z-0"
          style={{ width: `${steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0}%` }}
        />

        <ol className="relative flex w-full justify-between items-start z-10">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const isCompleted = completedSteps.includes(step.id);
            const isPast = index < currentIndex;
            const stepNumber = index + 1;

            return (
              <li
                key={step.id}
                className="flex flex-col items-center group relative"
                style={{ width: "32px" }}
              >
                {/* Circle step indicator */}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 z-10 outline-none select-none ${
                    isActive
                      ? "bg-nt-orange-600 text-white ring-4 ring-nt-orange-500/20 scale-110 shadow-[0_2px_8px_rgba(234,88,12,0.2)]"
                      : isCompleted || isPast
                      ? "bg-nt-orange-600 text-white"
                      : "bg-white border-2 border-nt-slate-200 text-nt-slate-400 group-hover:border-nt-slate-300"
                  }`}
                >
                  {isCompleted || isPast ? (
                    <Check className="h-4 w-4 stroke-[3px]" />
                  ) : (
                    stepNumber
                  )}
                </span>

                {/* Absolutely positioned label to prevent layout shifts & overflow */}
                {!condensed && (
                  <span
                    className={`absolute top-10 whitespace-nowrap text-[10px] font-semibold tracking-wide transition-all duration-300 pointer-events-none ${
                      isActive
                        ? "text-nt-slate-900 scale-100 opacity-100"
                        : "text-nt-slate-400 scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                    }`}
                  >
                    {formatStepTitle(step.title)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}


