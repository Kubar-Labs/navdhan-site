/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  uploadRequirementDocument: vi.fn(),
  deleteRequirementDocument: vi.fn(),
  fetchRequirements: vi.fn(),
}));

vi.mock("@/app/apply/lib/api", () => ({
  ...api,
  ApplyApiError: class ApplyApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public code?: string,
    ) {
      super(message);
    }
  },
}));

import { DocumentChecklist, useRequirements } from "./DocumentChecklist";
import { ApplyApiError } from "@/app/apply/lib/api";
import type {
  RequirementDocument,
  RequirementRow,
  RequirementsResponse,
} from "@/app/apply/lib/types";

function requirementDocument(
  overrides: Partial<RequirementDocument> = {},
): RequirementDocument {
  return {
    document_id: "doc-1",
    mime_type: "application/pdf",
    size_bytes: 1000,
    uploaded_at: null,
    coverage_from: null,
    coverage_to: null,
    status: "uploaded",
    scan_result: "clean",
    ...overrides,
  };
}

function row(overrides: Partial<RequirementRow> = {}): RequirementRow {
  return {
    application_requirement_id: "req-1",
    document_type_code: "pan_card",
    display_name: "PAN Card",
    category: "kyc",
    attaches_to: "person",
    application_party_id: "party-1",
    facility_id: null,
    obligation: "mandatory",
    blocks_submission: true,
    alt_group: null,
    coverage_mode: "none",
    min_count: 1,
    required_period_from: null,
    required_period_to: null,
    fiscal_year_start: null,
    status: "pending",
    documents: [],
    ...overrides,
  };
}

function response(rows: RequirementRow[], lock_version = 1): RequirementsResponse {
  return {
    application_id: "app-1",
    lock_version,
    credit_declaration: { has_active_credit_facilities: null, declared_cibil_score: null },
    facilities: [],
    requirements: rows,
  };
}

function pdfFile(name = "doc.pdf"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "application/pdf" });
}

describe("DocumentChecklist", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the backend-driven checklist for whatever requirement rows it is given", () => {
    const data = response([
      row({ application_requirement_id: "req-1", document_type_code: "pan_card", display_name: "PAN Card" }),
      row({
        application_requirement_id: "req-2",
        document_type_code: "gst_certificate",
        display_name: "GST Certificate",
        attaches_to: "entity",
        application_party_id: null,
      }),
    ]);

    render(<DocumentChecklist requirements={data} onChange={vi.fn()} />);

    expect(screen.getByText("PAN Card")).toBeVisible();
    expect(screen.getByText("GST Certificate")).toBeVisible();
  });

  it("defaults an upload to adding a new document rather than replacing the existing one", async () => {
    const existing = row({
      documents: [
        requirementDocument(),
      ],
    });
    const data = response([existing]);
    const updated = response([existing]);
    api.uploadRequirementDocument.mockResolvedValue(updated);
    const onChange = vi.fn();

    render(<DocumentChecklist requirements={data} onChange={onChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await screen.findByRole("button", { name: "Upload" });
    expect(api.uploadRequirementDocument).toHaveBeenCalledWith(
      expect.objectContaining({ supersedesDocumentId: undefined }),
    );
    expect(onChange).toHaveBeenCalledWith(updated);
  });

  it("replaces only the specifically selected document when the borrower chooses Replace", async () => {
    const existing = row({
      documents: [
        requirementDocument(),
        requirementDocument({ document_id: "doc-2", size_bytes: 2000 }),
      ],
    });
    const data = response([existing]);
    api.uploadRequirementDocument.mockResolvedValue(response([existing]));

    render(<DocumentChecklist requirements={data} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "doc-2" } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() =>
      expect(api.uploadRequirementDocument).toHaveBeenCalledWith(
        expect.objectContaining({ supersedesDocumentId: "doc-2" }),
      ),
    );
  });

  it("displays every linked document for a multi-document requirement", () => {
    const data = response([
      row({
        min_count: 2,
        documents: [
          requirementDocument({
            coverage_from: "2023-04-01",
            coverage_to: "2024-03-31",
          }),
          requirementDocument({
            document_id: "doc-2",
            size_bytes: 2000,
            coverage_from: "2024-04-01",
            coverage_to: "2025-03-31",
          }),
        ],
      }),
    ]);

    render(<DocumentChecklist requirements={data} onChange={vi.fn()} />);

    expect(screen.getByText(/Document 1/)).toBeVisible();
    expect(screen.getByText(/Document 2/)).toBeVisible();
  });

  it("shows the not_applicable state for an alt_group sibling and hides its upload controls", () => {
    const data = response([
      row({ alt_group: "vintage_proof", status: "not_applicable", document_type_code: "vat_proof", display_name: "VAT Proof" }),
    ]);

    render(<DocumentChecklist requirements={data} onChange={vi.fn()} />);

    expect(screen.getByText("Not needed (alternative provided)")).toBeVisible();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("renders only facility-scoped rows when filtered to one facility", () => {
    const data = response([
      row({ application_requirement_id: "req-entity", attaches_to: "entity", application_party_id: null, display_name: "GST Certificate" }),
      row({
        application_requirement_id: "req-facility",
        attaches_to: "facility",
        application_party_id: null,
        facility_id: "facility-1",
        document_type_code: "sanction_letter",
        display_name: "Sanction Letter",
      }),
    ]);

    render(
      <DocumentChecklist
        requirements={data}
        onChange={vi.fn()}
        filter={(r) => r.facility_id === "facility-1"}
      />,
    );

    expect(screen.getByText("Sanction Letter")).toBeVisible();
    expect(screen.queryByText("GST Certificate")).toBeNull();
  });

  it("surfaces an optimistic-lock conflict without calling onChange", async () => {
    const data = response([row()]);
    api.uploadRequirementDocument.mockRejectedValue(
      new ApplyApiError("Application was updated; refresh and retry", 409),
    );
    const onChange = vi.fn();

    render(<DocumentChecklist requirements={data} onChange={onChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Application was updated; refresh and retry")).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows scan state and never offers quarantined or failed files as replacement targets", () => {
    const data = response([
      row({
        documents: [
          requirementDocument({
            document_id: "pending",
            status: "quarantined",
            scan_result: "pending",
          }),
          requirementDocument({
            document_id: "infected",
            status: "scan_failed",
            scan_result: "infected",
          }),
        ],
      }),
    ]);

    render(<DocumentChecklist requirements={data} onChange={vi.fn()} />);

    expect(screen.getByText("Scanning for malware…")).toBeVisible();
    expect(screen.getByText(/Unsafe file detected/)).toBeVisible();
    expect(screen.queryByLabelText("Action")).toBeNull();
  });
});

describe("useRequirements", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => vi.useRealTimers());

  it("preserves the last successfully loaded snapshot when a later reload fails", async () => {
    const first = response([row()]);
    api.fetchRequirements.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error("down"));

    const { result } = renderHook(() => useRequirements(true));

    await waitFor(() => expect(result.current.requirements).toEqual(first));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe("Could not load the document checklist.");
    expect(result.current.requirements).toEqual(first);
  });

  it("polls until a quarantined document receives a terminal scan result", async () => {
    vi.useFakeTimers();
    const pending = response([
      row({
        documents: [
          requirementDocument({ status: "quarantined", scan_result: "pending" }),
        ],
      }),
    ]);
    const clean = response([
      row({ status: "collected", documents: [requirementDocument()] }),
    ]);
    api.fetchRequirements.mockResolvedValueOnce(pending).mockResolvedValueOnce(clean);

    const { result } = renderHook(() => useRequirements(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.requirements).toEqual(pending);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(api.fetchRequirements).toHaveBeenCalledTimes(2);
    expect(result.current.requirements).toEqual(clean);
  });
});
