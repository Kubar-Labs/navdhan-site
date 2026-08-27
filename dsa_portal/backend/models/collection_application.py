"""Validated request and response contracts for collection application setup."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


DigestHex = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
ReferralCode = Annotated[
    str, StringConstraints(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)
]
PersonName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=2,
        max_length=150,
        pattern=r"^[A-Za-z\s'.-]+$",
    ),
]
OptionalName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]
MobileNumber = Annotated[str, StringConstraints(pattern=r"^[6-9][0-9]{9}$")]
EmailAddress = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=255,
        pattern=r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$",
    ),
]
PanNumber = Annotated[
    str, StringConstraints(to_upper=True, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
]
AadhaarNumber = Annotated[str, StringConstraints(pattern=r"^[0-9]{12}$")]
Gstin = Annotated[
    str,
    StringConstraints(
        to_upper=True,
        pattern=r"^(0[1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[1-9A-Z]$",
    ),
]


class CollectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionCreate(CollectionRequest):
    token_digest: DigestHex


class LoanIntent(CollectionRequest):
    expected_lock_version: Annotated[int, Field(ge=0)]
    constitution: Literal["proprietorship", "partnership", "private_limited"]
    requested_amount: Annotated[
        int, Field(ge=500_000, le=10_000_000, multiple_of=10_000)
    ]
    requested_tenure_months: Annotated[int, Field(ge=3, le=12)]
    purpose: Literal[
        "working_capital",
        "machinery",
        "inventory",
        "business_expansion",
        "debt_refinancing",
        "other",
    ]
    referral_code: ReferralCode | None = None


class VersionedCollectionRequest(CollectionRequest):
    expected_lock_version: Annotated[int, Field(ge=0)]


class BusinessProfile(VersionedCollectionRequest):
    business_legal_name: Name
    trade_name: OptionalName | None = None
    business_type_code: Literal["trading", "manufacturing", "services"]
    income_type_code: Literal["business_income", "salary", "other"]
    type_of_office: Literal[
        "factory_premises", "home_office", "owned_office", "rented_office", "other"
    ]
    location_tier: Literal["tier1", "tier2", "tier3"]
    business_pincode: Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{5}$")]
    annual_turnover_range: Literal["0_10", "10_50", "50_100", "100_500", "500_plus"]
    gst_registered: bool


class PersonDetails(VersionedCollectionRequest):
    full_name: PersonName
    mobile_number: MobileNumber
    email: EmailAddress
    type_of_residence: Literal["family_owned", "owned", "rented", "other"]
    employment_status_code: Literal["self_employed", "salaried", "other"]


class PartyUpdate(PersonDetails):
    ownership_pct: Annotated[float, Field(ge=0, le=100)] | None = None


class PartyDetails(PartyUpdate):
    role: Literal["co_applicant", "director"]


class PersonalPan(VersionedCollectionRequest):
    pan_number: PanNumber


class PersonalAadhaar(VersionedCollectionRequest):
    aadhaar_number: AadhaarNumber


class EntityPan(VersionedCollectionRequest):
    entity_pan: PanNumber


class GstRegistration(VersionedCollectionRequest):
    gst_registered: bool
    gst_consent: bool
    gstin: Gstin | None = None
    state_code: (
        Annotated[str, StringConstraints(pattern=r"^(0[1-9]|[1-2][0-9]|3[0-8])$")]
        | None
    ) = None

    def model_post_init(self, __context: object) -> None:
        if self.gst_registered != (
            self.gstin is not None and self.state_code is not None
        ):
            raise ValueError(
                "gstin and state_code must be supplied exactly when GST registered"
            )
        if self.gst_registered != self.gst_consent:
            raise ValueError(
                "GST consent must be granted exactly when GST details are supplied"
            )
        if self.gstin is not None and self.gstin[:2] != self.state_code:
            raise ValueError("state_code must match the GSTIN prefix")
