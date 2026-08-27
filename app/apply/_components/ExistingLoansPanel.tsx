"use client";

import React, {
  forwardRef,
  type ForwardedRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import { cn } from "@/src/lib/utils/cn";
import { addCreditFacility, ApplyApiError, saveCreditDeclaration } from "@/app/apply/lib/api";
import type { FacilityType, RequirementsResponse } from "@/app/apply/lib/types";
import { DocumentChecklist } from "./DocumentChecklist";

export interface ExistingLoansPanelProps {
  requirements: RequirementsResponse;
  onChange: (requirements: RequirementsResponse) => void;
  className?: string;
}

export interface ExistingLoansPanelHandle {
  persistDeclarationForContinue: () => Promise<boolean>;
}

const FACILITY_TYPE_OPTIONS: { value: FacilityType; label: string }[] = [
  { value: "business", label: "Business loan" },
  { value: "home", label: "Home loan" },
  { value: "personal", label: "Personal loan" },
  { value: "car", label: "Car loan" },
  { value: "vehicle", label: "Vehicle loan" },
  { value: "education", label: "Education loan" },
  { value: "gold", label: "Gold loan" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

function ExistingLoansPanelImpl(
  { requirements, onChange, className }: ExistingLoansPanelProps,
  ref: ForwardedRef<ExistingLoansPanelHandle>,
) {
  const declared = requirements.credit_declaration.has_active_credit_facilities;
  const [hasActive, setHasActive] = useState<boolean | null>(declared);
  const [cibilScore, setCibilScore] = useState(
    requirements.credit_declaration.declared_cibil_score?.toString() ?? "",
  );
  const [declarationError, setDeclarationError] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);

  const [facilityType, setFacilityType] = useState<FacilityType>("business");
  const [lenderName, setLenderName] = useState("");
  const [originalLoanAmount, setOriginalLoanAmount] = useState("");
  const [outstandingAmount, setOutstandingAmount] = useState("");
  const [emiAmount, setEmiAmount] = useState("");
  const [interestRatePercent, setInterestRatePercent] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [emisPaidCount, setEmisPaidCount] = useState("");
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [addingFacility, setAddingFacility] = useState(false);

  const submitDeclaration = useCallback(
    async (requireCompleteFacilities = false) => {
      const score = Number(cibilScore);
      if (hasActive === null) {
        setDeclarationError("Select whether you have active loans");
        return false;
      }
      if (!Number.isInteger(score) || score < 300 || score > 900) {
        setDeclarationError("Enter a CIBIL score between 300 and 900");
        return false;
      }
      if (!hasActive && requirements.facilities.length > 0) {
        setDeclarationError("Remove active loans before declaring that you have none");
        return false;
      }
      if (
        hasActive === declared &&
        score === requirements.credit_declaration.declared_cibil_score
      ) {
        if (hasActive && requireCompleteFacilities && requirements.facilities.length === 0) {
          setDeclarationError("Add at least one active loan before continuing");
          return false;
        }
        setDeclarationError(null);
        return true;
      }
      setDeclaring(true);
      setDeclarationError(null);
      try {
        const updated = await saveCreditDeclaration({
          has_active_credit_facilities: hasActive,
          declared_cibil_score: score,
          expected_lock_version: requirements.lock_version,
        });
        onChange(updated);
        if (hasActive && requireCompleteFacilities && updated.facilities.length === 0) {
          setDeclarationError("Add at least one active loan before continuing");
          return false;
        }
        return true;
      } catch (error) {
        setDeclarationError(
          error instanceof ApplyApiError ? error.message : "Could not save. Please try again.",
        );
        return false;
      } finally {
        setDeclaring(false);
      }
    },
    [
      cibilScore,
      declared,
      hasActive,
      onChange,
      requirements.credit_declaration.declared_cibil_score,
      requirements.facilities.length,
      requirements.lock_version,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      persistDeclarationForContinue: () => submitDeclaration(true),
    }),
    [submitDeclaration],
  );

  const submitFacility = useCallback(async () => {
    const originalLoan = Number(originalLoanAmount);
    const outstanding = Number(outstandingAmount);
    const emi = Number(emiAmount);
    const roi = Number(interestRatePercent);
    const tenure = Number(tenureMonths);
    const emisPaid = Number(emisPaidCount);

    if (!lenderName.trim()) {
      setFacilityError("Enter the lender name");
      return;
    }
    if (!Number.isInteger(originalLoan) || originalLoan < 0) {
      setFacilityError("Enter a valid loan amount");
      return;
    }
    if (!Number.isInteger(outstanding) || outstanding < 0) {
      setFacilityError("Enter a valid outstanding amount");
      return;
    }
    if (!Number.isInteger(emi) || emi < 0) {
      setFacilityError("Enter a valid EMI amount");
      return;
    }
    if (!Number.isFinite(roi) || roi < 0 || roi > 100) {
      setFacilityError("Enter a valid rate of interest (0-100)");
      return;
    }
    if (!Number.isInteger(tenure) || tenure <= 0) {
      setFacilityError("Enter a valid tenure in months");
      return;
    }
    if (!startDate || !endDate) {
      setFacilityError("Enter the start and end date");
      return;
    }
    if (endDate < startDate) {
      setFacilityError("End date cannot be before the start date");
      return;
    }
    if (!Number.isInteger(emisPaid) || emisPaid < 0) {
      setFacilityError("Enter a valid paid-EMI count");
      return;
    }

    setAddingFacility(true);
    setFacilityError(null);
    try {
      const updated = await addCreditFacility({
        facility_type: facilityType,
        lender_name: lenderName.trim(),
        original_loan_amount: originalLoan,
        outstanding_amount: outstanding,
        emi_amount: emi,
        interest_rate_percent: roi,
        tenure_months: tenure,
        start_date: startDate,
        end_date: endDate,
        emis_paid_count: emisPaid,
        expected_lock_version: requirements.lock_version,
      });
      onChange(updated);
      setLenderName("");
      setOriginalLoanAmount("");
      setOutstandingAmount("");
      setEmiAmount("");
      setInterestRatePercent("");
      setTenureMonths("");
      setStartDate("");
      setEndDate("");
      setEmisPaidCount("");
    } catch (error) {
      setFacilityError(
        error instanceof ApplyApiError
          ? error.message
          : "Could not add this loan. Please try again.",
      );
    } finally {
      setAddingFacility(false);
    }
  }, [
    facilityType,
    lenderName,
    originalLoanAmount,
    outstandingAmount,
    emiAmount,
    interestRatePercent,
    tenureMonths,
    startDate,
    endDate,
    emisPaidCount,
    requirements.lock_version,
    onChange,
  ]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">
            Do you have any active/existing loans or credit facilities?
          </legend>
          <div className="mt-3 flex gap-3">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((option) => (
              <label
                key={option.label}
                className={cn(
                  "cursor-pointer rounded border px-4 py-1.5 text-sm focus-within:ring-2 focus-within:ring-orange-600 focus-within:ring-offset-2",
                  hasActive === option.value
                    ? "border-orange-600 bg-orange-50 text-orange-700"
                    : "border-slate-300 text-slate-700",
                )}
              >
                <input
                  type="radio"
                  name="has_active_credit_facilities"
                  value={option.label.toLowerCase()}
                  checked={hasActive === option.value}
                  onChange={() => setHasActive(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm text-slate-700">
          Your CIBIL score
          <input
            type="number"
            min={300}
            max={900}
            required
            value={cibilScore}
            onChange={(event) => setCibilScore(event.target.value)}
            className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void submitDeclaration()}
          disabled={declaring}
          className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {declaring ? "Saving…" : "Save"}
        </button>
        {declarationError && (
          <p className="text-sm text-red-600" role="alert">
            {declarationError}
          </p>
        )}
      </div>

      {declared === true && (
        <>
          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Add an existing loan</p>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-slate-700">
                Type
                <select
                  value={facilityType}
                  onChange={(event) => setFacilityType(event.target.value as FacilityType)}
                  className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {FACILITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Lender name
                <input
                  type="text"
                  value={lenderName}
                  onChange={(event) => setLenderName(event.target.value)}
                  className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Loan amount
                <input
                  type="number"
                  min={0}
                  value={originalLoanAmount}
                  onChange={(event) => setOriginalLoanAmount(event.target.value)}
                  className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Outstanding amount
                <input
                  type="number"
                  min={0}
                  value={outstandingAmount}
                  onChange={(event) => setOutstandingAmount(event.target.value)}
                  className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                EMI amount
                <input
                  type="number"
                  min={0}
                  value={emiAmount}
                  onChange={(event) => setEmiAmount(event.target.value)}
                  className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                ROI (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={interestRatePercent}
                  onChange={(event) => setInterestRatePercent(event.target.value)}
                  className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Tenure (months)
                <input
                  type="number"
                  min={1}
                  value={tenureMonths}
                  onChange={(event) => setTenureMonths(event.target.value)}
                  className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Paid EMI count
                <input
                  type="number"
                  min={0}
                  value={emisPaidCount}
                  onChange={(event) => setEmisPaidCount(event.target.value)}
                  className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={submitFacility}
              disabled={addingFacility}
              className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {addingFacility ? "Adding…" : "Add loan"}
            </button>
            {facilityError && (
              <p className="text-sm text-red-600" role="alert">
                {facilityError}
              </p>
            )}
          </div>

          {requirements.facilities.map((facility) => (
            <div key={facility.facility_id} className="space-y-2">
              <div className="text-sm text-slate-800">
                <p className="font-medium">
                  {facility.lender_name} —{" "}
                  {FACILITY_TYPE_OPTIONS.find((option) => option.value === facility.facility_type)
                    ?.label ?? facility.facility_type}
                </p>
                <p className="text-xs text-slate-500">
                  Loan amount ₹{facility.original_loan_amount ?? "—"} · Outstanding ₹
                  {facility.outstanding_amount ?? "—"} · EMI ₹{facility.emi_amount ?? "—"} · ROI{" "}
                  {facility.interest_rate_percent ?? "—"}% · Tenure {facility.tenure_months ?? "—"}{" "}
                  months
                </p>
                <p className="text-xs text-slate-500">
                  {facility.start_date ?? "—"} to {facility.end_date ?? "—"} · Paid EMIs{" "}
                  {facility.emis_paid_count ?? "—"}
                </p>
              </div>
              <DocumentChecklist
                requirements={requirements}
                onChange={onChange}
                filter={(row) => row.facility_id === facility.facility_id}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export const ExistingLoansPanel = forwardRef<ExistingLoansPanelHandle, ExistingLoansPanelProps>(
  ExistingLoansPanelImpl,
);

ExistingLoansPanel.displayName = "ExistingLoansPanel";
