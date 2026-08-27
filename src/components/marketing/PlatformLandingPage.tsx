import {
  ButtonLink,
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
import type { Locale } from "@/src/lib/i18n/config";

const integrationHref = "mailto:partnerships@kubar.tech?subject=NavDhan%20platform%20integration";

const valueCards: FeatureCardContent[] = [
  {
    eyebrow: "Order conversion",
    title: "Support higher-value transactions",
    description:
      "Give eligible businesses a financing path when working-capital gaps might delay or reduce an order.",
    linkLabel: "See borrower journey",
  },
  {
    eyebrow: "Retention",
    title: "Keep financing inside your workflow",
    description:
      "Offer contextual credit without sending customers into a disconnected search across multiple channels.",
    href: "#how-it-works",
    linkLabel: "Explore experience",
  },
  {
    eyebrow: "Operations",
    title: "Avoid lender-by-lender integration debt",
    description:
      "Use one origination layer for structured applications, configured routing, and lender-system handoff.",
    href: "#integration-architecture",
    linkLabel: "View integration",
  },
];

const integrationSteps: ProcessStepContent[] = [
  {
    step: "01",
    title: "Place the credit trigger",
    description:
      "Surface a relevant financing entry point at checkout, after an order, or inside an account workflow.",
  },
  {
    step: "02",
    title: "Capture intent and context",
    description:
      "Collect consented platform signals and the borrower information required for the application path.",
  },
  {
    step: "03",
    title: "Route a lender-ready file",
    description:
      "Pre-qualify against configured criteria and hand off the structured application to eligible lender systems.",
  },
];

const responsibilityCards: FeatureCardContent[] = [
  {
    eyebrow: "Platform",
    title: "Own the customer context",
    description:
      "Choose the relevant transaction moments, placement, and customer communication within your workflow.",
  },
  {
    eyebrow: "NavDhan",
    title: "Coordinate origination",
    description:
      "Capture intent, structure permissioned information, pre-qualify against configured criteria, and route.",
  },
  {
    eyebrow: "Lender",
    title: "Own the credit decision",
    description:
      "Retain underwriting, pricing, approval, documentation, disbursal, servicing, and applicable obligations.",
  },
];

function PlatformWorkflowPreview() {
  const items = [
    {
      number: "01",
      title: "Order received",
      value: "₹10,00,000",
      description: "Purchase order captured with business context",
    },
    {
      number: "02",
      title: "Capital need identified",
      value: "₹4,00,000",
      description: "Working-capital intent captured in workflow",
    },
    {
      number: "03",
      title: "Application structured",
      value: "Lender-ready",
      description: "Permissioned data mapped to lender requirements",
    },
  ];

  return (
    <div className="-mx-5 flex min-h-[520px] items-center justify-center bg-nt-orange-50 px-5 py-10 sm:mx-0 sm:rounded-3xl sm:px-8 lg:min-h-[540px]">
      <article className="w-full max-w-[430px] rounded-3xl border border-nt-slate-200 bg-white p-6 shadow-[var(--shadow-floating)]">
        <Eyebrow>Embedded origination</Eyebrow>
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.number} className="flex gap-4 rounded-2xl bg-nt-slate-50 p-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nt-slate-900 text-xs font-semibold text-white">
                {item.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 text-sm font-semibold sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <span className="text-nt-slate-900">{item.title}</span>
                  <span className="shrink-0 text-nt-orange-700">{item.value}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-nt-slate-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export function PlatformLandingPage({ locale }: { locale: Locale }) {
  return (
    <>
      <section id="top" className="bg-white">
        <MarketingContainer className="grid items-center gap-12 py-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start">
            <Eyebrow>For B2B platforms</Eyebrow>
            <h1 className="mt-6 max-w-[700px] text-5xl font-semibold leading-[1.08] tracking-[-1px] text-nt-slate-900 lg:text-[3.5rem] lg:leading-[3.75rem]">
              Embed business credit where orders already happen.
            </h1>
            <p className="mt-6 max-w-[650px] text-lg leading-7 text-nt-slate-600">
              Capture financing intent inside your marketplace, procurement, ERP, or trade
              workflow—without building and maintaining separate lender integrations.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={integrationHref} size="large" className="w-full sm:w-auto">
                Explore integration
              </ButtonLink>
              <ButtonLink
                href="#how-it-works"
                variant="secondary"
                size="large"
                arrow={false}
                className="w-full sm:w-auto"
              >
                View workflow
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-[650px] text-sm leading-5 text-nt-slate-500">
              NavDhan handles the origination workflow; regulated lenders retain underwriting,
              pricing, approval, and servicing.
            </p>
          </div>
          <PlatformWorkflowPreview />
        </MarketingContainer>
      </section>

      <MarketingSection tone="subtle" compact>
        <SectionHeading title="Origination infrastructure without rebuilding your product" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <StatCard value="₹0" label="upfront platform integration fee" />
          <StatCard value="Embedded" label="inside existing business workflows" />
          <StatCard value="Multi-lender" label="routing across eligible products" />
          <StatCard value="Success-led" label="commercial model for eligible partners" />
        </div>
      </MarketingSection>

      <MarketingSection>
        <SectionHeading
          title="One origination layer. More value from your workflow."
          description="Keep businesses inside the environment they already trust while NavDhan coordinates application capture and lender connectivity."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {valueCards.map((card) => (
            <FeatureCard key={card.title} {...card} href={card.href ?? `/${locale}#how-it-works`} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="how-it-works" tone="muted">
        <SectionHeading
          title="Integrate once. Configure by workflow."
          description="NavDhan adapts the origination journey to the moment, data, and lender requirements relevant to your platform."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {integrationSteps.map((step) => (
            <ProcessCard key={step.step} {...step} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="integration-architecture">
        <SectionHeading
          title="Fits between the systems you already operate"
          description="Origination starts in your workflow and ends in lender systems without asking your team to become a credit-operations function."
        />
        <div className="mt-12">
          <SystemFlow
            cards={[
              {
                eyebrow: "Origination surfaces",
                title: "Marketplaces · Procurement · ERP · Trade workflows",
                description: "Where transaction context and financing intent already exist.",
              },
              {
                eyebrow: "NavDhan",
                title: "Capture intent. Structure data. Pre-qualify. Route.",
                description:
                  "Configured workflows keep the platform experience distinct from the lender’s regulated decision process.",
              },
              {
                eyebrow: "Lender systems",
                title: "LOS · LMS · CRM · Internal portals",
                description:
                  "Underwriting, pricing, approval, documentation, and servicing stay with the lender.",
              },
            ]}
          />
        </div>
      </MarketingSection>

      <MarketingSection tone="subtle">
        <SectionHeading
          title="Designed for a clear separation of roles"
          description="Platform experience, NavDhan origination, and regulated lender decisioning remain distinct—with configurable controls around consent, data use, and handoff."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {responsibilityCards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection compact>
        <CtaBanner
          title="Explore how NavDhan can fit your platform workflow."
          description="Map the right origination trigger, permissioned signals, and lender-system handoff with our team."
          href={integrationHref}
        />
      </MarketingSection>
    </>
  );
}
