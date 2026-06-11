"""
KYB (Know-Your-Business) routes — business-borrower verifications that don't
apply to individuals.

  routes/kyb/pan.py    — /kyb/pan/verify, /kyb/pan/cin-llpin, /kyb/pan/gst-by-pan
"""

from routes.kyb.pan import router

__all__ = ["router"]
