import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { StepId, VerificationState, StepResult, BorrowerType } from './types'
import StepIndicator from './components/StepIndicator'
import MobileProgress from './components/MobileProgress'
import Logo from './components/Logo'
import Welcome from './steps/Welcome'
import BorrowerTypeStep from './steps/BorrowerTypeStep'
import ConsentStep from './steps/ConsentStep'
import AadhaarStep from './steps/AadhaarStep'
import PANStep from './steps/PANStep'
import BusinessPANStep from './steps/BusinessPANStep'
import GSTStep from './steps/GSTStep'
import BankStatementStep from './steps/BankStatementStep'
import PLStep from './steps/PLStep'
import ITRStep from './steps/ITRStep'
import Form26ASStep from './steps/Form26ASStep'
import Summary from './steps/Summary'

const idle: StepResult = { status: 'idle' }

const initialState = (): VerificationState => ({
  caseId: '',
  borrowerType: null,
  aadhaar: idle,
  pan: idle,
  panLink: idle,
  businessPan: idle,
  gst: idle,
  gstReturns: idle,
  bank: idle,
  pl: idle,
  itr: idle,
  form26as: idle,
})

// Two flows. The only structural difference is whether the BusinessPAN step
// exists. Beyond that, sole props use their personal PAN for ITR/26AS while
// limited companies use their separate business PAN.
const buildStepOrder = (borrowerType: BorrowerType | null): StepId[] => {
  const includeBusinessPan = borrowerType === 'business'
  return [
    'welcome',
    'borrower_type',
    'consent',
    'aadhaar',
    'pan',
    ...(includeBusinessPan ? (['business_pan'] as StepId[]) : []),
    'gst',
    'bank',
    'pl',
    'itr',
    'form26as',
    'summary',
  ]
}

export default function App() {
  const [step, setStep]     = useState<StepId>('welcome')
  const [caseId, setCaseId] = useState('')
  const [mobile, setMobile] = useState('')
  const [state, setState]   = useState<VerificationState>(initialState)

  const STEP_ORDER = useMemo(() => buildStepOrder(state.borrowerType), [state.borrowerType])

  // Welcome + Borrower-type + Consent are intro steps; not counted in "Step X of Y"
  const contentSteps = STEP_ORDER.filter(s =>
    s !== 'welcome' && s !== 'borrower_type' && s !== 'consent' && s !== 'summary'
  )

  const update = (patch: Partial<VerificationState>) =>
    setState(prev => ({ ...prev, ...patch }))

  const next = () => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
  }

  const prev = () => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  const handleStart = () => {
    setStep('borrower_type')
  }

  const handleBorrowerTypeNext = () => {
    if (!state.borrowerType) return
    setStep('consent')
  }

  const handleConsentAccepted = (newCaseId: string, consentMobile: string) => {
    setCaseId(newCaseId)
    setMobile(consentMobile)
    update({ caseId: newCaseId })
    setStep('aadhaar')
  }

  const handleRestart = () => {
    setCaseId('')
    setMobile('')
    setState(initialState())
    setStep('welcome')
  }

  const currentStepNum = contentSteps.indexOf(step as typeof contentSteps[number]) + 1
  const totalSteps = contentSteps.length

  // Pre-fill values captured from earlier steps
  const enteredAadhaarNo  = (state.aadhaar.data?._aadhaarNo as string) ?? ''
  const enteredPersonalPan = (state.pan.data?._pan as string) ?? ''
  const enteredBusinessPan = (state.businessPan.data?._pan as string) ?? ''
  // ITR and Form 26AS run against the BUSINESS PAN for limited companies, but
  // against the PERSONAL PAN for sole proprietors (who don't have a separate
  // business PAN).
  const itrPrefillPan = state.borrowerType === 'individual'
    ? enteredPersonalPan
    : (enteredBusinessPan || enteredPersonalPan)
  const discoveredGstins  =
    (state.businessPan.data?.discoveredGstins as
      import('./api/verification').GstSearchHit[] | undefined) ?? []

  const showHeader = true
  const showProgress = step !== 'welcome' && step !== 'borrower_type' && step !== 'consent' && step !== 'summary'
  const showSidebar  = step !== 'welcome' && step !== 'borrower_type' && step !== 'consent' && step !== 'summary'

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">

      {/* ── Sticky top header ── */}
      {showHeader && (
        <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur-md border-b border-mist px-4 md:px-8 py-3 flex items-center justify-between">
          <Logo size={36} showName />
          {showProgress && (
            <div className="flex items-center gap-3">
              {/* Show Back from the second content step onward */}
              {STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(contentSteps[0]) && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 text-xs text-steel hover:text-graphite transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <span className="text-xs text-steel font-medium">
                Step {currentStepNum} of {totalSteps}
              </span>
            </div>
          )}
        </header>
      )}

      {/* ── Mobile horizontal step progress ── */}
      {showProgress && (
        <div className="lg:hidden no-print">
          <MobileProgress current={step} state={state} borrowerType={state.borrowerType} />
        </div>
      )}

      {/* ── Body: sidebar (desktop) + content ── */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        {showSidebar && (
          <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-mist px-4 py-8">
            <StepIndicator current={step} state={state} borrowerType={state.borrowerType} />
          </aside>
        )}

        {/* Main content — full width on mobile, centered on desktop */}
        <main className="flex-1 flex justify-center px-4 md:px-8 py-8">
          <div className="w-full max-w-xl">

            {step === 'welcome' && (
              <Welcome caseId={caseId} onChange={setCaseId} onStart={handleStart} />
            )}

            {step === 'borrower_type' && (
              <BorrowerTypeStep
                value={state.borrowerType}
                onSelect={t => update({ borrowerType: t })}
                onNext={handleBorrowerTypeNext}
              />
            )}

            {step === 'consent' && state.borrowerType && (
              <ConsentStep
                borrowerType={state.borrowerType}
                onAccepted={handleConsentAccepted}
              />
            )}

            {step === 'aadhaar' && (
              <AadhaarStep
                caseId={state.caseId}
                result={state.aadhaar}
                onResult={r => update({ aadhaar: r })}
                onNext={next}
                prefillMobile={mobile}
              />
            )}

            {step === 'pan' && (
              <PANStep
                caseId={state.caseId}
                panResult={state.pan}
                linkResult={state.panLink}
                onPanResult={r => update({ pan: r })}
                onLinkResult={r => update({ panLink: r })}
                onNext={next}
                prefillAadhaar={enteredAadhaarNo}
              />
            )}

            {step === 'business_pan' && (
              <BusinessPANStep
                caseId={state.caseId}
                result={state.businessPan}
                onResult={r => update({ businessPan: r })}
                onNext={next}
              />
            )}

            {step === 'gst' && (
              <GSTStep
                caseId={state.caseId}
                gstResult={state.gst}
                returnsResult={state.gstReturns}
                onGstResult={r => update({ gst: r })}
                onReturnsResult={r => update({ gstReturns: r })}
                onNext={next}
                discoveredGstins={discoveredGstins}
              />
            )}

            {step === 'bank' && (
              <BankStatementStep
                caseId={state.caseId}
                result={state.bank}
                onResult={r => update({ bank: r })}
                onNext={next}
              />
            )}

            {step === 'pl' && (
              <PLStep
                caseId={state.caseId}
                result={state.pl}
                onResult={r => update({ pl: r })}
                onNext={next}
              />
            )}

            {step === 'itr' && (
              <ITRStep
                caseId={state.caseId}
                result={state.itr}
                onResult={r => update({ itr: r })}
                onNext={next}
                prefillPan={itrPrefillPan}
              />
            )}

            {step === 'form26as' && (
              <Form26ASStep
                caseId={state.caseId}
                result={state.form26as}
                onResult={r => update({ form26as: r })}
                onNext={next}
                prefillPan={itrPrefillPan}
              />
            )}

            {step === 'summary' && (
              <Summary state={state} onRestart={handleRestart} />
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
