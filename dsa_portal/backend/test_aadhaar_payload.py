"""
Find the exact payload/header combo that returns validId: Yes.
Run: python test_aadhaar_payload.py
"""
import sys, asyncio, httpx
from dotenv import load_dotenv
import os

load_dotenv(override=True)

SECURE_ID   = os.getenv("PERFIOS_USERNAME")
SECURE_CRED = os.getenv("PERFIOS_PASSWORD")
ORG_ID      = os.getenv("PERFIOS_ORG_ID")

AADHAAR_NO = sys.argv[1] if len(sys.argv) > 1 else "314241320210"
MOBILE     = sys.argv[2] if len(sys.argv) > 2 else "7521018614"
URL = "https://hub.perfios.ai/ssp/kyc/api/v3/aadhaar-mobilelink"

BASE_HDR = {
    "X-Secure-ID":       SECURE_ID,
    "X-Secure-Cred":     SECURE_CRED,
    "X-Organization-ID": ORG_ID,
    "Content-Type":      "application/json",
}

VARIANTS = [
    # (label, extra_headers, body)
    ("int mobile+aadhaar, customerRefId=123, no X-header",
     {},
     {"consent": "Y", "mobile": int(MOBILE), "aadhaar": int(AADHAAR_NO), "customerRefId": "123"}),

    ("int mobile+aadhaar, customerRefId=123, WITH X-header",
     {"X-Customer-Reference-ID": "123"},
     {"consent": "Y", "mobile": int(MOBILE), "aadhaar": int(AADHAAR_NO), "customerRefId": "123"}),

    ("str mobile+aadhaar, customerRefId=123",
     {},
     {"consent": "Y", "mobile": MOBILE, "aadhaar": AADHAAR_NO, "customerRefId": "123"}),

    ("int mobile+aadhaar, NO customerRefId, no X-header",
     {},
     {"consent": "Y", "mobile": int(MOBILE), "aadhaar": int(AADHAAR_NO)}),

    ("int mobile+aadhaar, NO customerRefId, WITH X-header",
     {"X-Customer-Reference-ID": "123"},
     {"consent": "Y", "mobile": int(MOBILE), "aadhaar": int(AADHAAR_NO)}),

    ("str fields matching docs exactly: consent/mobile/aadhaar as strings",
     {},
     {"consent": "Y", "mobile": MOBILE, "aadhaar": AADHAAR_NO}),
]

async def call(client, headers, body):
    resp = await client.post(URL, json=body, headers=headers)
    data = resp.json()
    r = data.get("result") or {}
    return resp.status_code, data.get("statusCode"), r.get("validId"), r.get("isMobileLinked"), r.get("isVerified")

async def main():
    print(f"Aadhaar: {AADHAAR_NO[:4]}XXXX{AADHAAR_NO[-4:]}  Mobile: {MOBILE}\n")
    async with httpx.AsyncClient(timeout=30) as client:
        for label, extra_hdrs, body in VARIANTS:
            hdrs = {**BASE_HDR, **extra_hdrs}
            http, code, valid, linked, verified = await call(client, hdrs, body)
            ok = "<<< WORKS!" if valid and valid.lower() == "yes" else ""
            print(f"[{http}|{code}] validId={valid} isMobileLinked={linked} isVerified={verified}  {ok}")
            print(f"        {label}")
            print(f"        body={body}\n")

asyncio.run(main())
