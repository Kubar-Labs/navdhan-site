/**
 * English — the source of truth for the message shape. Every other locale is
 * typed as `Messages` (= typeof en), so missing/extra keys are compile errors.
 *
 * Convention: finance acronyms (EMI, NBFC, GST, RBI, MSME, FACE, AA, BRE) and
 * brand names (Navdhan, NavDhan, Kubar Labs) stay in English across all locales.
 */
export const en = {
  announcement: {
    text: "Embedded credit is now live for 20+ NBFCs and Cooperative Banks.",
    cta: "Check your EMI →",
  },
  nav: {
    // labels align by index with NAV_HREFS in the header content
    links: ["Loan Products", "Why Navdhan", "EMI Calculator", "Stories"],
    apply: "Apply Loan",
  },
  hero: {
    badge: "Smart credit infrastructure for Bharat",
    titleLead: "Embedded lending for India's",
    titleAccent: "MSMEs.",
    body: "NavDhan by Kubar Labs powers embedded lending for the next generation of MSME finance. We connect lenders, marketplaces, and platforms so credit flows where business happens.",
    apply: "Apply Loan",
    demo: "Book a Demo",
    stats: [
      { label: "Lender partners", value: "20+" },
      { label: "Data integrations", value: "GST & AA" },
      { label: "Decisioning", value: "Real-time" },
    ],
    card: {
      title: "How NavDhan works",
      subtitle: "An embedded credit hub connecting platforms and lenders.",
      live: "Live",
      steps: [
        {
          title: "Embedded Integration",
          body: "NavDhan embeds directly into B2B marketplaces and platforms. Borrowers apply seamlessly within their daily workflows.",
        },
        {
          title: "Smart Matching · < 5 mins",
          body: "Aggregates consent-backed GST and Account Aggregator data to qualify leads inside our BRE in under 5 minutes.",
        },
        {
          title: "Lender Routing & Disbursal",
          body: "BRE-qualified leads match with 20+ partner banks and NBFCs, a 40-45% approval rate vs. 15-20% standard.",
        },
      ],
      feeLabel: "Fee",
      feeValue: "1.25% on disbursals",
      platformLabel: "Platform cost",
      platformValue: "100% free",
    },
  },
  products: {
    eyebrow: "Loan products",
    heading: "Tailored products for your specific business needs.",
    intro:
      "Whether you're buying equipment, funding payroll, or expanding to a new city, we route your application to the right lender, the first time.",
    items: [
      {
        title: "Collateral-Free Term Loans",
        description: "Unsecured funding up to ₹50 Lakhs based on business cash flow.",
      },
      {
        title: "Working Capital Loans",
        description: "Bridge cash-flow gaps with flexible drawdown and repayment.",
      },
      {
        title: "Asset Financing",
        description: "Fund machinery, equipment and vehicles with tailored EMIs.",
      },
      {
        title: "MSME Growth Capital",
        description: "Scale-stage capital aligned with priority sector norms.",
      },
    ],
  },
  why: {
    eyebrow: "Why Navdhan",
    heading: "Built for founders who don't have time to chase paperwork.",
    apply: "Apply Loan",
    reasons: [
      {
        title: "Wide Lender Network",
        description: "Access offers from 20+ verified NBFC partners and Cooperative Banks.",
      },
      {
        title: "Flexible Ticket Sizes",
        description: "Loans available from ₹5 Lakhs to ₹1 Crore+.",
      },
      {
        title: "Multiple Offers, One Application",
        description: "Compare and choose the best interest rates without multiple entries.",
      },
      {
        title: "Fast Processing",
        description: "Get loan approvals in as little as 24 hours to 7 days.",
      },
      {
        title: "Simple Online Process",
        description: "A fully digital, hassle-free application.",
      },
      {
        title: "Zero Platform Fee",
        description: "Pay no additional fee to us, only what the lender charges you.",
      },
    ],
    badges: ["RBI Aligned", "20+ Lenders", "FACE Registered"],
  },
  emi: {
    eyebrow: "EMI calculator",
    heading: "Calculate your EMI.",
    intro:
      "Move the sliders to estimate your monthly outflow. Final rates depend on the lender, your business profile and tenure.",
    amount: "Loan amount",
    rate: "Interest rate",
    rateSuffix: "% p.a.",
    tenure: "Tenure",
    months: "months",
    monthly: "Monthly EMI",
    principal: "Principal",
    totalInterest: "Total interest",
    totalPayable: "Total payable",
    mo: "mo",
    cta: "Check Eligibility",
  },
  stories: {
    eyebrow: "Customer stories",
    heading: "Real business problems, real solutions.",
    items: [
      {
        name: "Rajiv K.",
        role: "Garment Shop Owner",
        question:
          "I needed to scale but didn't know where to start. How can I get a loan without collateral?",
        outcome: "Rajiv qualified for a collateral-free term loan, securing ₹25 Lakhs.",
        cta: "Check Eligibility",
      },
      {
        name: "Sunita M.",
        role: "Handicraft Artisan, Varanasi",
        question:
          "We needed to upgrade our loom but cash flow was tight. Can I get a loan for equipment?",
        outcome: "Sunita secured a machinery loan for ₹15 Lakhs at competitive rates.",
        cta: "Get Your Offers",
      },
      {
        name: "Amit V.",
        role: "E-commerce Logistics, Gurugram",
        question: "What is the best way to fund my operational expansion and hire more staff?",
        outcome: "Amit received a working capital loan of ₹18 Lakhs to optimize operations.",
        cta: "Apply Now",
      },
    ],
  },
  recognition: {
    eyebrow: "Recognition",
    heading: "Featured by FACE & recognized by leading fintech publications.",
    points: [
      "FACE Registered Member",
      "RBI Aligned Practices",
      "20+ Lender Partners",
      "Zero Platform Fee",
    ],
  },
  cta: {
    headingLead: "Get the right loan with",
    headingAccent: "Navdhan.",
    subtext: "Zero platform fee · High approval rates · Multiple offers, one application.",
    apply: "Apply Online",
    talk: "Talk to Us",
  },
  footer: {
    tagline: "A loan marketplace for India's MSMEs, built by Kubar Labs.",
    company: "Kubar Labs Pvt. Ltd.",
    office: "Registered Office, Bengaluru, India",
    // column titles + item labels align by index with FOOTER_HREFS
    columns: [
      { title: "Contact Us", items: ["Loan Enquiry", "Partnership Enquiry"] },
      { title: "Company", items: ["About Navdhan", "Loan Products", "EMI Calculator"] },
      { title: "Legal", items: ["Terms of Service", "Privacy Policy", "Fair Practices Code"] },
    ],
    rights: "All rights reserved.",
    badges: "RBI Aligned · FACE Registered · 20+ Lender Partners",
  },
  switcher: {
    label: "Language",
  },
};

export type Messages = typeof en;
