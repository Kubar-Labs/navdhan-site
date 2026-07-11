"use client";

import React from "react";
import { cn } from "@/src/lib/utils/cn";

export interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  children,
  error,
  hint,
  required,
  className,
}) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="text-orange-600 ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
