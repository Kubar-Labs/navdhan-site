import { useState } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import FormField from '../components/FormField'
import { startCase } from '../api/verification'
import type { BorrowerType } from '../types'

export const CONSENT_VERSION = 'v1.2'

export const CONSENT_TEXT =
  'I, the undersigned authorized signatory, give consent on behalf of the ' +
  'business entity named below to verify its PAN (Income Tax Department), ' +
  'GSTIN (GST Network), Bank Statement, ITR, and Form 26AS (TRACES / IT ' +
  'e-Filing Portal), and to verify my own Aadhaar (UIDAI) and PAN as the ' +
  'authorised signatory, as part of the entity\'s loan application. I ' +
  'confirm I am authorized to provide this consent for the entity and that ' +
  'the information provided is true and accurate. This consent is given ' +
  'freely as per the Digital Personal Data Protection Act, 2023, and ' +
  'applicable RBI / UIDAI / GST / IT Department guidelines. By typing my ' +
  'full legal name below, I digitally sign and accept this consent.'

interface Props {
  borrowerType: BorrowerType
  onAccepted: (caseId: string, mobile: string) => void
}

export default function ConsentStep({ borrowerType, onAccepted }: Props) {
  const isIndividual = borrowerType === 'individual'
  const [entityName, setEntityName] = useState('')
  const [name, setName]       = useState('')
  const [mobile, setMobile]   = useState('')
  const [agreed, setAgreed]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [busy,  setBusy]      = useState(false)

  const submit = async () => {
    setError(null)
    if (!isIndividual && entityName.trim().length < 2) {
      setError('Please enter the entity legal name'); return
    }
    if (name.trim().length < 2)       { setError('Please type your full name'); return }
    if (!/^\d{10}$/.test(mobile))     { setError('Please enter a 10-digit mobile number'); return }
    if (!agreed)                      { setError('Please tick the consent box'); return }
    setBusy(true)
    try {
      const res = await startCase({
        borrower_name:     name.trim(),
        mobile,
        consent_text:      CONSENT_TEXT,
        consent_version:   CONSENT_VERSION,
        borrower_type:     borrowerType,
        // For sole proprietors the "entity" and the person are the same;
        // fall back to the signatory's full name as the entity name so the
        // backend's required-field validation still passes.
        entity_legal_name: isIndividual
          ? (entityName.trim() || name.trim())
          : entityName.trim(),
      })
      onAccepted(res.case_id, mobile)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? 'Could not start case'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Consent &amp; Authorization</h1>
            <p className="text-xs text-graphite">Required before we begin verification</p>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-xs font-semibold text-ember uppercase tracking-widest">
          Consent statement (v{CONSENT_VERSION})
        </p>

        <div className="bg-fog/60 border border-mist rounded-xl px-4 py-4 max-h-64 overflow-y-auto">
          <p className="text-sm text-graphite leading-relaxed">{CONSENT_TEXT}</p>
        </div>

        <FormField
          label={isIndividual ? 'Trade Name (optional)' : 'Entity Legal Name'}
          required={!isIndividual}
          hint={isIndividual
            ? 'If you operate under a trade name (e.g. "Reddy Rice Traders"). Leave blank to use your own name.'
            : 'Legal name of the business as on PAN / Certificate of Incorporation.'}>
          <input className="input-field"
            placeholder={isIndividual ? 'e.g. Reddy Rice Traders (optional)' : 'e.g. Acme Logistics Pvt Ltd'}
            value={entityName} onChange={e => setEntityName(e.target.value)}
            disabled={busy} autoComplete="organization" />
        </FormField>

        <FormField label="Authorized Signatory Full Name (digital signature)" required
          hint="Full legal name of the person signing on behalf of the entity.">
          <input className="input-field" placeholder="e.g. Rahul Kumar Sharma"
            value={name} onChange={e => setName(e.target.value)}
            disabled={busy} autoComplete="off" />
        </FormField>

        <FormField label="Mobile Number" required
          hint="10-digit mobile number of the authorized signatory (linked to your Aadhaar).">
          <input className="input-field" placeholder="10-digit mobile number"
            maxLength={10} value={mobile}
            onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
            disabled={busy} inputMode="numeric" autoComplete="tel" />
        </FormField>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input type="checkbox" className="mt-1 w-4 h-4 accent-ember"
            checked={agreed} onChange={e => setAgreed(e.target.checked)}
            disabled={busy} />
          <span className="text-sm text-graphite">
            I have read the statement above and consent to the verification of
            the entity's documents as described.
          </span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button className="btn-primary" onClick={submit}
          disabled={
            busy
            || (!isIndividual && !entityName.trim())
            || !name.trim()
            || mobile.length !== 10
            || !agreed
          }>
          {busy ? 'Recording consent…' : 'Agree & Continue'}
          {!busy && <ArrowRight size={18} />}
        </button>

        <p className="text-xs text-steel leading-relaxed">
          Your name, the time of acceptance, and the device you're using are
          recorded as proof of consent. The consent text is stored verbatim
          for audit. You can withdraw consent at any time before we begin
          verification.
        </p>
      </div>
    </div>
  )
}
