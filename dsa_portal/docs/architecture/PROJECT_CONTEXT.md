# Project Context: Automated KYC / eSign Verification System (Indian Lending)

## What We Are Building

An automated borrower verification pipeline for the Indian financial/lending market.
The system collects borrower data, builds a structured **Data Packet**, then calls
**Perfios APIs** to verify each document/data point — automating what is traditionally a
manual KYC + eSign (DSN) process.

---

## APIs Used: Perfios Only

All verifications go through **Perfios** (hub.perfios.ai).
Perfios is a single platform covering identity, financial documents, and statement analysis.

**Registration**: https://hub.perfios.ai/app/register
**Sandbox**: instant access with 10,000+ free test credits, no credit card

---

## Verifications Required

| # | What to Verify | Perfios Product | Input |
|---|---|---|---|
| 1 | Aadhaar Card | Aadhaar Verification API | Aadhaar number → OTP to linked mobile |
| 2 | PAN Card | PAN Verification API | PAN number |
| 3 | GSTIN (GSTR-1 + GSTR-3B) | GST Verification + GST Analyser | GSTIN |
| 4 | Bank Statement (last 1 year) | Bank Statement Analyser (BSA) | PDF upload or Account Aggregator |
| 5 | ITR (last 3 years) | ITR Analyser | PDF upload OR e-Filing credentials |
| 6 | Form 26AS | ITR Analyser suite | PDF upload OR e-Filing credentials |

---

## Data Packet (Structured JSON assembled before API calls)

```json
{
  "borrower_id": "unique ID",
  "personal": {
    "name": "",
    "pan": "",
    "aadhaar": "",
    "dob": "",
    "mobile": "",
    "email": ""
  },
  "address": {
    "current": "",
    "permanent": ""
  },
  "employment": {
    "type": "salaried | self_employed | business",
    "employer": "",
    "monthly_income": 0,
    "gstin": ""
  },
  "documents": {
    "bank_statements": [],
    "itr_pdfs": [],
    "form_26as_pdfs": []
  },
  "verification_results": {
    "aadhaar": {},
    "pan": {},
    "gstin": {},
    "bank_statement": {},
    "itr": {},
    "form_26as": {}
  },
  "status": "pending | verified | rejected | review"
}
```

---

## Perfios Products Mapped to Use Cases

### 1. Aadhaar Verification API
- **URL**: https://perfios.ai/aadhaar-verification-api/
- OTP sent to UIDAI-linked mobile → borrower submits OTP → eKYC XML returned
- Returns: name, gender, DOB, address, photo (base64)

### 2. PAN Verification API
- **URL**: https://perfios.ai/pan-verification-api/
- Real-time check against Income Tax department database
- Returns: full name, PAN type, validity, Aadhaar link status, DOB

### 3. GST Verification API + GST Analyser
- **GST Verify URL**: https://perfios.ai/gst-verification-api/
- **GST Analyser URL**: https://perfios.ai/products/gst-analyser/
- GSTIN verify: legal name, trade name, registration date, taxpayer status
- GST Analyser: GSTR-1 (sales/turnover), GSTR-3B (tax summary), monthly breakdown

### 4. Bank Statement Analyser (BSA)
- **URL**: https://perfios.ai/in/products/bank-statement-analyser/
- Supports 4000+ bank statement formats
- Async: upload PDF → get transactionId → poll for JSON report
- Returns: average monthly balance, salary credits, EMI outflows, fraud flags

### 5 & 6. ITR Analyser (covers ITR + Form 26AS)
- **URL**: https://perfios.ai/products/itr-analyser/
- Two modes: online fetch (e-Filing credentials) OR PDF upload
- ITR: income, deductions, tax liability per assessment year (AY2024-25, AY2023-24, AY2022-23)
- Form 26AS: TDS from employer/bank, advance tax paid, high-value transactions

---

## Project Structure

```
verification/
├── PROJECT_CONTEXT.md
├── backend/
│   └── scripts/                  ← API test scripts (one per Perfios API)
│       ├── .env.example          ← credential template
│       ├── requirements.txt
│       ├── config.py             ← shared auth config
│       ├── test_aadhaar.py       ← Aadhaar eKYC test
│       ├── test_pan.py           ← PAN verification test
│       ├── test_gstin.py         ← GSTIN + GSTR-1/3B test
│       ├── test_bank_statement.py ← BSA upload + report test
│       ├── test_itr.py           ← ITR 3-year test
│       ├── test_form26as.py      ← Form 26AS test
│       ├── run_all_tests.py      ← runs all tests
│       └── samples/              ← place test PDFs here
└── frontend/
```

---

## Setup to Run Tests

```bash
# 1. Install dependencies
pip install -r backend/scripts/requirements.txt

# 2. Set up credentials
cp backend/scripts/.env.example backend/scripts/.env
# Edit .env with sandbox credentials from hub.perfios.ai

# 3. Place sample PDFs in backend/scripts/samples/
#    bank_statement.pdf, itr_v.pdf, form_26as.pdf

# 4. Run individual test
cd backend/scripts
python test_pan.py

# 5. Run all tests
python run_all_tests.py
```

---

## Important Note on Endpoints

All API endpoint paths in the test scripts are **PLACEHOLDERS** (e.g. `/kyc/pan/verify`).
The exact paths are in the Perfios developer docs, accessible only after registering at
**hub.perfios.ai**. Once you register and get sandbox credentials:
1. Open the API docs in Perfios Hub
2. Replace the `url = f"{BASE_URL}/..."` lines in each test script with actual paths
3. Adjust request payload field names if they differ from what's documented

---

## Regulatory Context

- **eKYC**: UIDAI Aadhaar OTP flow, compliant with RBI guidelines
- **eSign (DSN)**: IT Act 2000 — digital signature for loan agreement
- **Account Aggregator**: RBI-licensed framework (Perfios is an FIU/FIP participant)
- **Data Consent**: every API call includes `"consent": "Y"` — borrower consent is mandatory

---

*Created: 2026-04-23 | Status: Test scripts written — awaiting Perfios sandbox credentials*
