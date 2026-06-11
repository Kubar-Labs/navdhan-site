export type StepId =
  | 'welcome'
  | 'borrower_type'
  | 'consent'
  | 'aadhaar'
  | 'pan'
  | 'business_pan'
  | 'gst'
  | 'bank'
  | 'pl'
  | 'itr'
  | 'form26as'
  | 'summary'

export type BorrowerType = 'individual' | 'business'


export interface StepConfig {
  id: StepId
  label: string
  description: string
}

export interface StepResult {
  status: 'idle' | 'loading' | 'success' | 'error' | 'skipped'
  data?: Record<string, unknown>
  error?: string
}

export interface VerificationState {
  caseId: string
  borrowerType: BorrowerType | null
  aadhaar: StepResult
  pan: StepResult
  panLink: StepResult
  businessPan: StepResult
  gst: StepResult
  gstReturns: StepResult
  bank: StepResult
  pl: StepResult
  itr: StepResult
  form26as: StepResult
}
