"use client";

import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/src/lib/utils/cn";
import {
  ApplyApiError,
  deleteRequirementDocument,
  fetchRequirements,
  uploadRequirementDocument,
} from "@/app/apply/lib/api";
import type { RequirementRow, RequirementsResponse } from "@/app/apply/lib/types";

export interface DocumentChecklistProps {
  requirements: RequirementsResponse;
  onChange: (requirements: RequirementsResponse) => void;
  filter?: (row: RequirementRow) => boolean;
  className?: string;
  emptyMessage?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Not uploaded",
  partial: "Partially covered",
  collected: "Uploaded",
  accepted_for_review: "Under review",
  rejected: "Rejected — please re-upload",
  waived: "Waived",
  not_applicable: "Not needed (alternative provided)",
  missing: "Missing",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-800",
  collected: "bg-green-100 text-green-800",
  accepted_for_review: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  waived: "bg-slate-100 text-slate-500",
  not_applicable: "bg-slate-100 text-slate-500",
  missing: "bg-red-100 text-red-800",
};

function needsCoverageDates(row: RequirementRow): boolean {
  return row.coverage_mode === "month_range" || row.coverage_mode === "fiscal_year";
}

const DocumentRow: React.FC<{
  row: RequirementRow;
  lockVersion: number;
  onChange: (requirements: RequirementsResponse) => void;
}> = ({ row, lockVersion, onChange }) => {
  const [file, setFile] = useState<File | null>(null);
  const [coverageFrom, setCoverageFrom] = useState(row.required_period_from ?? "");
  const [coverageTo, setCoverageTo] = useState(row.required_period_to ?? "");
  // "" = the upload adds a new document. Any other value = the borrower
  // explicitly chose to replace that specific existing document.
  const [replaceTargetId, setReplaceTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = row.status === "not_applicable" || row.status === "waived";

  const handleUpload = useCallback(async () => {
    if (!file) {
      setError("Choose a PDF file first");
      return;
    }
    if (needsCoverageDates(row) && (!coverageFrom || !coverageTo)) {
      setError("Enter the period this document covers");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await uploadRequirementDocument({
        applicationRequirementId: row.application_requirement_id,
        expectedLockVersion: lockVersion,
        file,
        coverageFrom: needsCoverageDates(row) ? coverageFrom : undefined,
        coverageTo: needsCoverageDates(row) ? coverageTo : undefined,
        supersedesDocumentId: replaceTargetId || undefined,
      });
      onChange(updated);
      setFile(null);
      setReplaceTargetId("");
    } catch (uploadError) {
      setError(
        uploadError instanceof ApplyApiError
          ? uploadError.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [file, coverageFrom, coverageTo, replaceTargetId, row, lockVersion, onChange]);

  const handleDelete = useCallback(
    async (documentId: string) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await deleteRequirementDocument(documentId, lockVersion);
        onChange(updated);
        setReplaceTargetId((current) => (current === documentId ? "" : current));
      } catch (deleteError) {
        setError(
          deleteError instanceof ApplyApiError
            ? deleteError.message
            : "Could not remove the file. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [lockVersion, onChange],
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 p-4 space-y-3",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">
            {row.display_name}
            {row.obligation === "optional" && (
              <span className="ml-2 text-xs text-slate-500">(optional)</span>
            )}
            {row.alt_group && (
              <span className="ml-2 text-xs text-slate-500">
                (any one document of this type is required)
              </span>
            )}
          </p>
          {row.min_count > 1 && (
            <p className="text-xs text-slate-500">Needs {row.min_count} documents</p>
          )}
          {needsCoverageDates(row) && row.required_period_from && row.required_period_to && (
            <p className="text-xs text-slate-500">
              Period: {row.required_period_from} to {row.required_period_to}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            STATUS_STYLES[row.status] ?? "bg-slate-100 text-slate-700",
          )}
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      </div>

      {row.documents.length > 0 && (
        <ul className="space-y-1">
          {row.documents.map((document, index) => (
            <li
              key={document.document_id}
              className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded px-2 py-1"
            >
              <span>
                Document {index + 1} · {(document.size_bytes / 1024).toFixed(0)} KB
                {document.coverage_from && document.coverage_to
                  ? ` · ${document.coverage_from} to ${document.coverage_to}`
                  : ""}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(document.document_id)}
                  disabled={busy}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-end gap-2">
          {needsCoverageDates(row) && (
            <>
              <label className="text-xs text-slate-600">
                From
                <input
                  type="date"
                  value={coverageFrom}
                  onChange={(event) => setCoverageFrom(event.target.value)}
                  className="block rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                To
                <input
                  type="date"
                  value={coverageTo}
                  onChange={(event) => setCoverageTo(event.target.value)}
                  className="block rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </>
          )}
          {row.documents.length > 0 && (
            <label className="text-xs text-slate-600">
              Action
              <select
                value={replaceTargetId}
                onChange={(event) => setReplaceTargetId(event.target.value)}
                className="block rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">Add a new document</option>
                {row.documents.map((document, index) => (
                  <option key={document.document_id} value={document.document_id}>
                    Replace document {index + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={busy || !file}
            className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? "Uploading…" : replaceTargetId ? "Replace" : "Upload"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export const DocumentChecklist: React.FC<DocumentChecklistProps> = ({
  requirements,
  onChange,
  filter,
  className,
  emptyMessage = "Nothing to upload here yet.",
}) => {
  const rows = filter ? requirements.requirements.filter(filter) : requirements.requirements;

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row) => (
        <DocumentRow
          key={row.application_requirement_id}
          row={row}
          lockVersion={requirements.lock_version}
          onChange={onChange}
        />
      ))}
    </div>
  );
};

export function useRequirements(enabled: boolean): {
  requirements: RequirementsResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setRequirements: (requirements: RequirementsResponse) => void;
} {
  const [requirements, setRequirements] = useState<RequirementsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRequirements();
      setRequirements(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof ApplyApiError
          ? fetchError.message
          : "Could not load the document checklist.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !requirements) {
      void reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload]);

  return { requirements, loading, error, reload, setRequirements };
}
