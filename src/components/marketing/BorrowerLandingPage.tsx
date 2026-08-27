import {
  ButtonLink,
  CheckList,
  CtaBanner,
  Eyebrow,
  FaqItem,
  FeatureCard,
  MarketingContainer,
  MarketingSection,
  ProcessCard,
  SectionHeading,
  StatCard,
  type FeatureCardContent,
  type ProcessStepContent,
} from "@/src/components/marketing/MarketingUI";
import type { Locale } from "@/src/lib/i18n/config";

const useCases: FeatureCardContent[] = [
  {
    eyebrow: "Inventory",
    title: "Restock without slowing sales",
    description:
      "Apply for working capital to bridge the gap between buying inventory and receiving customer payments.",
    linkLabel: "Check eligibility",
  },
  {
    eyebrow: "Order fulfilment",
    title: "Take on larger customer orders",
    description:
      "Seek financing for materials, production, or fulfilment when a valuable order stretches available cash.",
    linkLabel: "Start application",
  },
  {
    eyebrow: "Business growth",
    title: "Invest in your next stage",
    description:
      "Submit a business-loan application for equipment, expansion, or other eligible operating needs.",
    linkLabel: "Explore options",
  },
];

const processSteps: ProcessStepContent[] = [
  {
    step: "01",
    title: "Tell us about your business",
    description:
      "Share your financing need, business profile, and contact information in a guided flow.",
  },
  {
    step: "02",
    title: "Provide the required details",
    description:
      "Upload or consent to the information needed for the selected lender and application stage.",
  },
  {
    step: "03",
    title: "Review any available terms",
    description:
      "Compare lender-provided pricing, fees, tenure, and repayment terms before accepting.",
  },
];

const faqItems = [
  {
    question: "Who decides whether my loan is approved?",
    answer:
      "The regulated lender reviews your application and determines eligibility, approval, pricing, tenure, fees, and repayment terms.",
  },
  {
    question: "What will I see before accepting an offer?",
    answer:
      "Where an offer is available, you can review the lender, amount, rate, fees, tenure, repayment schedule, and relevant conditions before acceptance.",
  },
  {
    question: "How is my business data used?",
    answer:
      "Information is requested for stated application purposes and shared or retrieved based on the applicable consent and lender workflow.",
  },
];

function OfferCard({ applyHref }: { applyHref: string }) {
  return (
    <article className="w-full max-w-[420px] rounded-3xl border border-nt-slate-200 bg-nt-cream p-6 shadow-[var(--shadow-floating)]">
      <Eyebrow>Illustrative offer</Eyebrow>
      <p className="mt-6 text-[2rem] font-bold leading-10 tracking-[-0.5px] text-nt-slate-900">
        ₹5,00,000
      </p>
      <p className="mt-4 text-base leading-6 text-nt-slate-600">
        An illustrative working-capital option based on the information shared in your application.
      </p>
      <div className="mt-6 rounded-2xl border border-nt-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4 text-sm leading-5">
          <span className="text-nt-slate-600">Estimated monthly payment</span>
          <strong className="shrink-0 font-semibold text-nt-slate-900">₹45,840</strong>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-nt-slate-50" aria-hidden="true">
          <div className="h-full w-[72%] rounded-full bg-nt-orange-700" />
        </div>
      </div>
      <ButtonLink href={applyHref} size="large" className="mt-6 w-full">
        Continue application
      </ButtonLink>
    </article>
  );
}

function EligibilityStarter({ applyHref }: { applyHref: string }) {
  return (
    <form
      action={applyHref}
      method="get"
      className="w-full rounded-3xl border border-nt-slate-200 bg-nt-cream p-4 shadow-[var(--shadow-floating)] sm:p-8"
    >
      <h3 className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-nt-slate-900">
        Check your application path
      </h3>
      <p className="mt-2 text-sm leading-5 text-nt-slate-600">
        This preview does not perform a credit check.
      </p>

      <label className="mt-6 block text-sm font-semibold text-nt-slate-900">
        How much financing do you need?
        <input
          name="amount"
          inputMode="numeric"
          placeholder="Enter an amount"
          className="mt-2 min-h-14 w-full rounded-xl border border-nt-slate-200 bg-white px-4 py-3 text-base font-normal text-nt-slate-900 outline-none placeholder:text-nt-slate-500 focus:border-nt-orange-700 focus:ring-2 focus:ring-nt-orange-100"
        />
      </label>

      <label className="mt-6 block text-sm font-semibold text-nt-slate-900">
        What is the primary use?
        <select
          name="purpose"
          defaultValue=""
          className="mt-2 min-h-14 w-full rounded-xl border border-nt-slate-200 bg-white px-4 py-3 text-base font-normal text-nt-slate-700 outline-none focus:border-nt-orange-700 focus:ring-2 focus:ring-nt-orange-100"
        >
          <option value="" disabled>
            Select a purpose
          </option>
          <option value="inventory">Inventory</option>
          <option value="order-fulfilment">Order fulfilment</option>
          <option value="business-growth">Business growth</option>
          <option value="other">Other business need</option>
        </select>
      </label>

      <button
        type="submit"
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-nt-orange-600 bg-nt-orange-700 px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-nt-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
      >
        Continue securely <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

export function BorrowerLandingPage({ locale }: { locale: Locale }) {
  const applyHref = `/${locale}/apply`;

  return (
    <>
      <section id="top" className="bg-white">
        <MarketingContainer className="grid items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start">
            <Eyebrow>Business credit, built around your trade</Eyebrow>
            <h1 className="font-display mt-6 max-w-[680px] text-5xl leading-[1.08] tracking-[-0.5px] text-nt-slate-900 lg:text-[4rem] lg:leading-[4.25rem] lg:tracking-[-1px]">
              Working capital that keeps your business moving.
            </h1>
            <p className="mt-6 max-w-[620px] text-lg leading-7 text-nt-slate-600">
              Tell us what you need once. NavDhan structures your application and connects it to
              eligible lender partners—with final approval, pricing, and terms set by the lender.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={applyHref} size="large" className="w-full sm:w-auto">
                Check eligibility
              </ButtonLink>
              <ButtonLink
                href="#products"
                variant="secondary"
                size="large"
                arrow={false}
                className="w-full sm:w-auto"
              >
                Explore loan options
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-[610px] text-sm leading-5 text-nt-slate-500">
              No approval is guaranteed. Available products and final terms depend on lender
              assessment.
            </p>
          </div>

          <div className="-mx-5 flex min-h-[520px] items-center justify-center bg-nt-orange-50 px-[5px] py-8 sm:mx-0 sm:rounded-3xl sm:px-8 lg:min-h-[540px]">
            <OfferCard applyHref={applyHref} />
          </div>
        </MarketingContainer>
      </section>

      <MarketingSection tone="subtle" compact>
        <SectionHeading
          title="A clearer path from need to lender review"
          description="NavDhan helps organise the application journey while keeping the regulated lender’s decision and final terms explicit."
        />
        <div className="mt-8 hidden grid-cols-2 gap-6 md:grid lg:grid-cols-4">
          <StatCard value="One" label="structured application" />
          <StatCard value="Lender-set" label="approval, pricing, and terms" />
          <StatCard value="Before" label="you accept any available offer" />
          <StatCard value="Consent-led" label="data access and retrieval" />
        </div>
        <div className="mt-6 space-y-3 md:hidden">
          {[
            "One structured application",
            "Consent-led information use",
            "Lender terms shown before acceptance",
          ].map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-xl border border-nt-slate-200 bg-white p-4 text-base leading-6 text-nt-slate-900"
            >
              <span className="font-semibold text-nt-green-700" aria-hidden="true">
                ✓
              </span>
              {item}
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="products">
        <SectionHeading
          title="Finance the next move your business needs to make"
          description="Use NavDhan to submit a structured application for common working-capital and business-growth needs."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((card) => (
            <FeatureCard key={card.title} {...card} href={applyHref} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="how-it-works" tone="muted">
        <SectionHeading
          title="A simple application. Clear next steps."
          description="NavDhan organises the journey from your financing need to lender review without obscuring who makes the final decision."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {processSteps.map((step) => (
            <ProcessCard key={step.step} {...step} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <div>
            <SectionHeading
              title="Start where your business is today"
              description="A few initial details help us shape the application path. You can review what is requested before submitting information for lender assessment."
            />
            <CheckList
              className="mt-6 hidden sm:block"
              items={[
                "Purpose-specific consent and data use",
                "Required documents shown by application stage",
                "Lender terms displayed before acceptance",
              ]}
            />
            <p className="mt-6 max-w-[560px] text-sm leading-5 text-nt-slate-500">
              NavDhan is not a lender. Credit decisions, pricing, and final terms are determined by
              regulated lending partners.
            </p>
          </div>
          <EligibilityStarter applyHref={applyHref} />
        </div>
      </MarketingSection>

      <MarketingSection tone="subtle">
        <SectionHeading
          align="center"
          title="Questions before you apply"
          description="The application is organised by NavDhan; the regulated lender remains responsible for the credit decision and final offer."
        />
        <div className="mx-auto mt-12 max-w-[760px] space-y-3">
          {faqItems.map((item, index) => (
            <FaqItem key={item.question} {...item} defaultOpen={index === 0} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection compact>
        <CtaBanner
          tone="accent"
          title="Ready to start your business application?"
          description="Begin with a few details. Any available product, approval, pricing, and final terms remain subject to lender assessment."
          href={applyHref}
        />
      </MarketingSection>
    </>
  );
}
