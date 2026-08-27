import {
  ButtonLink,
  CheckList,
  CtaBanner,
  Eyebrow,
  FeatureCard,
  MarketingContainer,
  MarketingSection,
  ProcessCard,
  SectionHeading,
  StatCard,
  SystemFlow,
  type FeatureCardContent,
  type ProcessStepContent,
} from "@/src/components/marketing/MarketingUI";

const briefingHref = "mailto:partnerships@kubar.tech?subject=NavDhan%20lender%20briefing";

const valueCards: FeatureCardContent[] = [
  {
    eyebrow: "Embedded origination",
    title: "Reach demand at the point of need",
    description:
      "Access financing intent inside fragmented B2B marketplaces, procurement systems, ERPs, and trade workflows.",
    href: briefingHref,
    linkLabel: "Explore capability",
  },
  {
    eyebrow: "Application quality",
    title: "Receive lender-ready files",
    description:
      "Collect structured borrower information and relevant permissioned context before handoff to your review process.",
    href: "#permissioned-signals",
    linkLabel: "Explore capability",
  },
  {
    eyebrow: "System fit",
    title: "Route into existing operations",
    description:
      "Integrate with LOS, LMS, CRM, internal portals, document, and compliance workflows configured by your team.",
    href: "#data-flow",
    linkLabel: "Explore capability",
  },
];

const workflowSteps: ProcessStepContent[] = [
  {
    step: "01",
    title: "Configure products and criteria",
    description:
      "Map required fields, documents, product rules, and routing logic to your lending workflow.",
  },
  {
    step: "02",
    title: "Receive structured applications",
    description:
      "Get lender-ready files with the available permissioned context and pre-qualification outputs.",
  },
  {
    step: "03",
    title: "Underwrite and decide",
    description:
      "Apply your own policy, pricing, approval, documentation, disbursal, and servicing processes.",
  },
];

const signalCards = [
  {
    title: "Platform & transaction",
    description:
      "Order history, transaction patterns, inventory cycles, payment behaviour, and sector-specific operating context.",
  },
  {
    title: "Business verification",
    description: "GST, Udyam, MCA, identity, document, and other configured verification sources.",
  },
  {
    title: "Financial context",
    description:
      "Banking, Account Aggregator, bureau, statement, and cash-flow information where available and authorised.",
  },
  {
    title: "Lender criteria",
    description:
      "Product, sector, ticket size, geography, policy, and routing rules configured by the lender.",
  },
];

function LenderApplicationPreview() {
  const signals = [
    ["Order history", "Available"],
    ["Cash-flow pattern", "Available"],
    ["Consent package", "Attached"],
    ["Routing fit", "Configured review"],
  ];

  return (
    <div className="-mx-5 flex min-h-[520px] items-center justify-center bg-nt-orange-50 px-5 py-10 sm:mx-0 sm:rounded-3xl sm:px-8 lg:min-h-[540px]">
      <article className="w-full max-w-[430px] rounded-3xl border border-nt-slate-200 bg-white p-6 shadow-[var(--shadow-floating)]">
        <Eyebrow>Illustrative application</Eyebrow>
        <div className="mt-6 flex items-end justify-between gap-6 border-b border-nt-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-nt-slate-500">
              Requested
            </p>
            <p className="mt-2 text-[2rem] font-bold leading-10 tracking-[-0.5px] text-nt-slate-900">
              ₹8.5 lakh
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-nt-slate-500">
              Status
            </p>
            <p className="mt-2 text-sm font-semibold text-nt-green-700">Lender-ready</p>
          </div>
        </div>
        <dl className="divide-y divide-nt-slate-100">
          {signals.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-4 text-sm">
              <dt className="text-nt-slate-600">{label}</dt>
              <dd className="font-semibold text-nt-green-700">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-4 text-nt-slate-500">
          Illustrative signals only · Not a credit decision
        </p>
      </article>
    </div>
  );
}

export function LenderLandingPage() {
  return (
    <>
      <section id="top" className="bg-white">
        <MarketingContainer className="grid items-center gap-12 py-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start">
            <Eyebrow>For financial institutions</Eyebrow>
            <h1 className="mt-6 max-w-[720px] text-5xl font-semibold leading-[1.08] tracking-[-1px] text-nt-slate-900 lg:text-[3.5rem] lg:leading-[3.75rem]">
              Originate lender-ready business credit across fragmented B2B ecosystems.
            </h1>
            <p className="mt-6 max-w-[670px] text-lg leading-7 text-nt-slate-600">
              Reach high-intent businesses inside the platforms they already use and receive
              structured applications enriched with permissioned operating context.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={briefingHref} size="large" className="w-full sm:w-auto">
                Request lender briefing
              </ButtonLink>
              <ButtonLink
                href="#data-flow"
                variant="secondary"
                size="large"
                arrow={false}
                className="w-full sm:w-auto"
              >
                View data flow
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-[680px] text-sm leading-5 text-nt-slate-500">
              NavDhan supports origination and pre-qualification. Your institution retains
              underwriting, pricing, approval, documentation, disbursal, and servicing.
            </p>
          </div>
          <LenderApplicationPreview />
        </MarketingContainer>
      </section>

      <MarketingSection tone="subtle" compact>
        <SectionHeading title="Expand origination without fragmenting operations" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <StatCard value="High-intent" label="demand captured inside business workflows" />
          <StatCard value="Structured" label="applications mapped to required fields" />
          <StatCard value="Configurable" label="pre-qualification against lender criteria" />
          <StatCard value="System-ready" label="handoff into existing lender operations" />
        </div>
      </MarketingSection>

      <MarketingSection>
        <SectionHeading
          title="A stronger origination layer for existing credit systems"
          description="NavDhan improves how applications are sourced and structured without replacing your underwriting policy or system of record."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {valueCards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="permissioned-signals" tone="muted">
        <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <SectionHeading
              title="Operating context—not just another lead form"
              description="Where available, integrated, and permissioned, NavDhan can structure platform, financial, and verification information for lender-configured review."
            />
            <CheckList
              className="mt-6"
              items={[
                "Purpose-specific borrower consent",
                "Source and availability kept explicit",
                "Lender policy remains authoritative",
              ]}
            />
            <p className="mt-6 max-w-[500px] text-sm leading-5 text-nt-slate-500">
              Signals support origination and pre-qualification; they do not replace underwriting or
              create an approval.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {signalCards.map((signal) => (
              <article
                key={signal.title}
                className="rounded-2xl border border-nt-slate-200 bg-white p-6"
              >
                <h3 className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-nt-orange-700">
                  {signal.title}
                </h3>
                <p className="mt-3 text-base leading-6 text-nt-slate-600">{signal.description}</p>
              </article>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="how-it-works">
        <SectionHeading
          title="Your credit policy remains in control"
          description="NavDhan handles the origination layer around the decision process your institution already operates."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {workflowSteps.map((step) => (
            <ProcessCard key={step.step} {...step} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="data-flow" tone="subtle">
        <SectionHeading
          title="Designed to extend—not replace—your lender stack"
          description="NavDhan connects fragmented origination surfaces to the systems and controls your institution already relies on."
        />
        <div className="mt-12">
          <SystemFlow
            cards={[
              {
                eyebrow: "Origination channels",
                title: "B2B marketplaces · ERPs · Procurement · Trade platforms",
                description:
                  "High-intent demand and operating context originate inside third-party workflows.",
              },
              {
                eyebrow: "NavDhan origination layer",
                title: "Capture · Structure · Pre-qualify · Route",
                description:
                  "Application orchestration and configured routing prepare the file for your institution.",
              },
              {
                eyebrow: "Your lender stack",
                title: "LOS · LMS · CRM · Portals · Core systems",
                description:
                  "Your policy, underwriting, decision, documentation, disbursal, and servicing remain authoritative.",
              },
            ]}
          />
        </div>
      </MarketingSection>

      <MarketingSection compact>
        <CtaBanner
          title="Review the NavDhan origination and data-flow brief."
          description="See how permissioned signals, lender-configured pre-qualification, and system handoff can fit your institution."
          href={briefingHref}
        />
      </MarketingSection>
    </>
  );
}
