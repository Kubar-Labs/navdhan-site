import { describe, it, expect } from "vitest";
import {
  validateLoanAmount,
  validateTenureMonths,
  validatePurpose,
  validateReferralCode,
  validateFullName,
  validateMobileNumber,
  validateEmail,
  validateBusinessPinCode,
  validateAadhaarNumber,
  validateAadhaarOtp,
  validatePanNumber,
  validateGstin,
} from "@/app/apply/lib/validation";

describe("apply validation rules", () => {
  describe("loan_amount", () => {
    it("accepts 500000", () => {
      expect(validateLoanAmount(500000)).toBe(true);
    });

    it("accepts 10000000", () => {
      expect(validateLoanAmount(10000000)).toBe(true);
    });

    it("accepts multiples of 10000", () => {
      expect(validateLoanAmount(1250000)).toBe(true);
    });

    it("rejects amounts below 500000", () => {
      expect(validateLoanAmount(499999)).toBe(false);
    });

    it("rejects amounts above 10000000", () => {
      expect(validateLoanAmount(10000001)).toBe(false);
    });

    it("rejects non-multiples of 10000", () => {
      expect(validateLoanAmount(500001)).toBe(false);
    });

    it("rejects non-integer amounts", () => {
      expect(validateLoanAmount(500000.5)).toBe(false);
    });
  });

  describe("tenure_months", () => {
    it("accepts 3", () => {
      expect(validateTenureMonths(3)).toBe(true);
    });

    it("accepts 12", () => {
      expect(validateTenureMonths(12)).toBe(true);
    });

    it("rejects below 3", () => {
      expect(validateTenureMonths(2)).toBe(false);
    });

    it("rejects above 12", () => {
      expect(validateTenureMonths(13)).toBe(false);
    });

    it("rejects non-integer tenures", () => {
      expect(validateTenureMonths(6.5)).toBe(false);
    });
  });

  describe("purpose", () => {
    it.each([
      "working_capital",
      "machinery",
      "inventory",
      "business_expansion",
      "debt_refinancing",
      "other",
    ])("accepts %s", (purpose) => {
      expect(validatePurpose(purpose)).toBe(true);
    });

    it("rejects unknown purposes", () => {
      expect(validatePurpose("personal_expense")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validatePurpose("")).toBe(false);
    });
  });

  describe("referral_code", () => {
    it("accepts null", () => {
      expect(validateReferralCode(null)).toBe(true);
    });

    it("accepts valid alphanumeric code", () => {
      expect(validateReferralCode("NAV-DHAN_2026")).toBe(true);
    });

    it("rejects codes over 20 characters", () => {
      expect(validateReferralCode("a".repeat(21))).toBe(false);
    });

    it("rejects invalid characters", () => {
      expect(validateReferralCode("code@home")).toBe(false);
    });
  });

  describe("full_name", () => {
    it("accepts plain names", () => {
      expect(validateFullName("Amit Sharma")).toBe(true);
    });

    it("accepts names with apostrophes, dots, hyphens", () => {
      expect(validateFullName("R. K. O'Connor-Smith")).toBe(true);
    });

    it("rejects names shorter than 2 characters", () => {
      expect(validateFullName("A")).toBe(false);
    });

    it("rejects names over 150 characters", () => {
      expect(validateFullName("A".repeat(151))).toBe(false);
    });

    it("rejects names with digits", () => {
      expect(validateFullName("Amit123")).toBe(false);
    });
  });

  describe("mobile_number", () => {
    it.each(["9876543210", "6000000000", "9999999999"])(
      "accepts %s",
      (mobile) => {
        expect(validateMobileNumber(mobile)).toBe(true);
      }
    );

    it("rejects +91 prefix", () => {
      expect(validateMobileNumber("+919876543210")).toBe(false);
    });

    it("rejects 91 prefix", () => {
      expect(validateMobileNumber("919876543210")).toBe(false);
    });

    it("rejects short numbers", () => {
      expect(validateMobileNumber("987654321")).toBe(false);
    });

    it("rejects long numbers", () => {
      expect(validateMobileNumber("98765432100")).toBe(false);
    });

    it("rejects numbers starting with 0-5", () => {
      expect(validateMobileNumber("5123456789")).toBe(false);
    });

    it("rejects non-digits", () => {
      expect(validateMobileNumber("98765abc10")).toBe(false);
    });
  });

  describe("email", () => {
    it.each([
      "borrower@example.com",
      "a.b+c@example.co.in",
      "user@sub.example.com",
    ])("accepts %s", (email) => {
      expect(validateEmail(email)).toBe(true);
    });

    it.each([
      "not-an-email",
      "missing@",
      "@example.com",
      "a@b.c",
    ])("rejects %s", (email) => {
      expect(validateEmail(email)).toBe(false);
    });

    it("rejects emails over 255 characters", () => {
      expect(validateEmail("a".repeat(250) + "@test.com")).toBe(false);
    });
  });

  describe("business_pin_code", () => {
    it("accepts valid 6-digit pin", () => {
      expect(validateBusinessPinCode("110001")).toBe(true);
    });

    it("rejects pins starting with 0", () => {
      expect(validateBusinessPinCode("010001")).toBe(false);
    });

    it("rejects 5-digit pins", () => {
      expect(validateBusinessPinCode("11001")).toBe(false);
    });

    it("rejects 7-digit pins", () => {
      expect(validateBusinessPinCode("1100001")).toBe(false);
    });

    it("rejects non-digits", () => {
      expect(validateBusinessPinCode("11000A")).toBe(false);
    });
  });

  describe("aadhaar_number", () => {
    it("accepts 12 digits", () => {
      expect(validateAadhaarNumber("123456789012")).toBe(true);
    });

    it("rejects 11 digits", () => {
      expect(validateAadhaarNumber("12345678901")).toBe(false);
    });

    it("rejects 13 digits", () => {
      expect(validateAadhaarNumber("1234567890123")).toBe(false);
    });

    it("rejects non-digits", () => {
      expect(validateAadhaarNumber("12345678901A")).toBe(false);
    });
  });

  describe("aadhaar_otp", () => {
    it("accepts 6 digits", () => {
      expect(validateAadhaarOtp("123456")).toBe(true);
    });

    it("rejects 5 digits", () => {
      expect(validateAadhaarOtp("12345")).toBe(false);
    });

    it("rejects 7 digits", () => {
      expect(validateAadhaarOtp("1234567")).toBe(false);
    });

    it("rejects non-digits", () => {
      expect(validateAadhaarOtp("12345A")).toBe(false);
    });
  });

  describe("pan_number", () => {
    it("accepts valid uppercase PAN", () => {
      expect(validatePanNumber("ABCDE1234F")).toBe(true);
    });

    it("rejects lowercase PAN", () => {
      expect(validatePanNumber("abcde1234f")).toBe(false);
    });

    it("rejects wrong format", () => {
      expect(validatePanNumber("ABCD12345F")).toBe(false);
    });

    it("rejects short PAN", () => {
      expect(validatePanNumber("ABCDE123F")).toBe(false);
    });

    it("rejects non-alphanumeric", () => {
      expect(validatePanNumber("ABCDE-1234F")).toBe(false);
    });
  });

  describe("gstin", () => {
    it("accepts valid GSTIN", () => {
      expect(validateGstin("27AAPFU0939F1ZV")).toBe(true);
    });

    it("accepts null", () => {
      expect(validateGstin(null)).toBe(true);
    });

    it("rejects invalid check digit position", () => {
      expect(validateGstin("27AAPFU0939F1Z0")).toBe(false);
    });

    it("rejects lowercase", () => {
      expect(validateGstin("27aapfu0939f1zv")).toBe(false);
    });

    it("rejects 14 characters", () => {
      expect(validateGstin("27AAPFU0939F1Z")).toBe(false);
    });

    it("rejects wrong state code pattern", () => {
      expect(validateGstin("A7AAPFU0939F1ZV")).toBe(false);
    });
  });
});
