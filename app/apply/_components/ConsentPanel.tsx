"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/src/lib/utils/cn";

export interface ConsentItem {
  id: string;
  label: React.ReactNode;
  link?: { href: string; label: string };
  required?: boolean;
}

export interface ConsentPanelProps {
  items: ConsentItem[];
  values: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  error?: string;
  title?: string;
  className?: string;
}

export const ConsentPanel: React.FC<ConsentPanelProps> = ({
  items,
  values,
  onToggle,
  error,
  title,
  className,
}) => {
  return (
    <fieldset className={cn("rounded-lg border border-slate-200 bg-cream-50 p-4", className)}>
      {title && <legend className="text-sm font-semibold text-slate-800 mb-2">{title}</legend>}
      <div className="space-y-3">
        {items.map((item) => {
          const checked = !!values[item.id];
          return (
            <div key={item.id} className="flex items-start gap-3">
              <input
                id={item.id}
                type="checkbox"
                name={item.id}
                checked={checked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                aria-required={item.required ?? false}
                aria-invalid={!!error}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor={item.id} className="text-sm text-slate-700 leading-relaxed">
                {item.label}
                {item.link && (
                  <>
                    {" "}
                    <Link
                      href={item.link.href}
                      className="underline text-orange-700 hover:text-orange-800"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.link.label}
                    </Link>
                  </>
                )}
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
};
