import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1/verify',
})

export const startCase = (data: {
  borrower_name: string
  mobile: string
  consent_text: string
  consent_version?: string
  borrower_type?: 'business' | 'individual'
  entity_legal_name: string
}) => api.post('/cases/start', data).then(r => r.data as {
  case_id: string
  case_uuid: string
  accepted_at: string
})

export const verifyAadhaar = (data: {
  aadhaar_no: string
  mobile: string
  case_id: string
  loan_amount?: number
  loan_type?: string
}) => {
  const form = new FormData()
  form.append('aadhaar_no', data.aadhaar_no)
  form.append('mobile', data.mobile)
  form.append('case_id', data.case_id)
  if (data.loan_amount != null) form.append('loan_amount', String(data.loan_amount))
  if (data.loan_type)           form.append('loan_type', data.loan_type)
  return api.post('/aadhaar/verify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const verifyPAN = (data: {
  pan: string
  case_id: string
  name?: string
  loan_amount?: number
  loan_type?: string
}) => {
  const form = new FormData()
  form.append('pan', data.pan)
  form.append('case_id', data.case_id)
  if (data.name)                form.append('name', data.name)
  if (data.loan_amount != null) form.append('loan_amount', String(data.loan_amount))
  if (data.loan_type)           form.append('loan_type', data.loan_type)
  return api.post('/pan/verify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const checkPANLink = (data: {
  pan: string
  aadhaar_no: string
  name: string
  case_id: string
  consent_text: string
}) => api.post('/pan/link', data).then(r => r.data)

// KYB (business borrowers only): PAN auth → writes to kyb_verifications
export const verifyPanKyb = (data: {
  pan: string
  case_id: string
  name?: string
  loan_amount?: number
  loan_type?: string
}) => {
  const form = new FormData()
  form.append('pan', data.pan)
  form.append('case_id', data.case_id)
  if (data.name)                form.append('name', data.name)
  if (data.loan_amount != null) form.append('loan_amount', String(data.loan_amount))
  if (data.loan_type)           form.append('loan_type', data.loan_type)
  return api.post('/kyb/pan/verify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data as { status_code?: string; request_id?: string; name?: string; raw?: unknown })
}

// KYB (business borrowers only): PAN → CIN/LLPIN
export interface CinLlpinResult { entity_id?: string; name?: string }
export const fetchCinLlpin = (data: {
  pan: string
  case_id: string
}) => api.post('/kyb/pan/cin-llpin', data).then(r => r.data as {
  status_code?: string
  request_id?:  string
  results:      CinLlpinResult[]
  raw?:         unknown
})

// KYB (business borrowers only): GST search by PAN
export interface GstSearchHit {
  gstin_id?:           string
  state?:              string
  auth_status?:        string
  application_status?: string
  registration_name?:  string
  pan?:                string
}
export const fetchGstByPan = (data: {
  pan: string
  case_id: string
}) => api.post('/kyb/pan/gst-by-pan', data).then(r => r.data as {
  status_code?: string
  request_id?:  string
  count:        number
  results:      GstSearchHit[]
  raw?:         unknown
})


export const verifyGST = (data: {
  gstin: string
  case_id: string
}) => api.post('/gst/verify', data).then(r => r.data)

export const getGSTReturns = (data: {
  gstin: string
  case_id: string
  due_info: boolean
  liability_details: boolean
  latest_fy: boolean
}) => api.post('/gst/returns', data).then(r => r.data)

export const saveITR = (data: {
  pan: string
  password: string
  case_id: string
  number_of_years?: number
}) => api.post('/itr/save', data).then(r => r.data)

export const fetchITR = (data: {
  pan: string
  password: string
  case_id: string
  number_of_years: number
  additional_data: boolean
  partial_report: boolean
  api_version: string
}) => api.post('/itr/fetch', data).then(r => r.data)

export const fetch26AS = (data: {
  pan: string
  password: string
  case_id: string
  years: string[]
  source: string
  api_version: string
}) => api.post('/26as/fetch', data).then(r => r.data)

export const plUpload = (data: {
  case_id: string
  file: File
}) => {
  const form = new FormData()
  form.append('case_id', data.case_id)
  form.append('file', data.file)
  return api.post('/pl/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

// ITR alt-input paths
export const uploadITR = (data: { case_id: string; file: File }) => {
  const form = new FormData()
  form.append('case_id', data.case_id)
  form.append('file', data.file)
  return api.post('/itr/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
export const skipITR = (data: { case_id: string }) =>
  api.post('/itr/skip', data).then(r => r.data)

// Form 26AS alt-input paths
export const upload26AS = (data: { case_id: string; file: File }) => {
  const form = new FormData()
  form.append('case_id', data.case_id)
  form.append('file', data.file)
  return api.post('/26as/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
export const skip26AS = (data: { case_id: string }) =>
  api.post('/26as/skip', data).then(r => r.data)

export const bsaUpload = (data: {
  case_id: string
  file: File
  password?: string
  loan_amount?: number
  loan_duration_months?: number
  loan_type?: string
}) => {
  const form = new FormData()
  form.append('case_id', data.case_id)
  form.append('file', data.file)
  if (data.password)              form.append('password', data.password)
  if (data.loan_amount != null)   form.append('loan_amount', String(data.loan_amount))
  if (data.loan_duration_months != null)
                                  form.append('loan_duration_months', String(data.loan_duration_months))
  if (data.loan_type)             form.append('loan_type', data.loan_type)
  return api.post('/bsa/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
