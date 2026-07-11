import type {
  BadgeItem,
  PartnerItem,
  ProductCard,
  ReasonBlock,
  RecognitionItem,
  StoryCard,
  TeamMember,
  Advisor,
} from "@/src/types";

export const associationBadges: BadgeItem[] = [
  {
    name: "FinVision",
    logoAsset: "/assets/badges/finvision.png",
    altKey: "global.alt.finvision",
    href: "#",
  },
  {
    name: "FACE",
    logoAsset: "/assets/badges/face.png",
    altKey: "global.alt.face",
    href: "#",
  },
  {
    name: "Startup Mahakumbh",
    logoAsset: "/assets/badges/mahakumbh.png",
    altKey: "global.alt.partnerLogo",
    href: "#",
  },
  {
    name: "STPI FinGlobe",
    logoAsset: "/assets/badges/finglobe.png",
    altKey: "global.alt.stpiFinglobe",
    href: "#",
  },
];

export const techPartners: PartnerItem[] = [
  {
    name: "Amplitude",
    logoAsset: "/assets/partners/amplitude.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "ElevenLabs",
    logoAsset: "/assets/partners/eleven.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "Google",
    logoAsset: "/assets/partners/google.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "Intel",
    logoAsset: "/assets/partners/intel.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "Microsoft",
    logoAsset: "/assets/partners/microsoft.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "NVIDIA",
    logoAsset: "/assets/partners/nvidia.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "OpenAI",
    logoAsset: "/assets/partners/openai.png",
    altKey: "global.alt.partnerLogo",
  },
  {
    name: "Perplexity",
    logoAsset: "/assets/partners/perplexity.png",
    altKey: "global.alt.partnerLogo",
  },
];

export const loanProducts: ProductCard[] = [
  {
    id: "collateral-free",
    titleKey: "Term Loan up to ₹1 Crore",
    descriptionKey:
      "Unsecured funding based on your business cash flow. No property or asset needed.",
    iconName: "ShieldCheck",
    ctaKey: "global.cta.learnMore",
    href: "/apply",
  },
  {
    id: "working-capital",
    titleKey: "Working Capital Loan",
    descriptionKey:
      "Cover salaries, stock, supplier payments, or everyday gaps with flexible repayment.",
    iconName: "Briefcase",
    ctaKey: "global.cta.learnMore",
    href: "/apply",
  },
  {
    id: "asset-finance",
    titleKey: "Asset / Machinery Finance",
    descriptionKey: "Buy equipment, vehicles, or tools with EMIs that match your cash cycle.",
    iconName: "Truck",
    ctaKey: "global.cta.learnMore",
    href: "/apply",
  },
  {
    id: "growth-loan",
    titleKey: "Business Growth Loan",
    descriptionKey:
      "Larger-ticket capital to expand to a new city, add capacity, or take on bigger orders.",
    iconName: "TrendingUp",
    ctaKey: "global.cta.learnMore",
    href: "/apply",
  },
];

export const whyReasons: ReasonBlock[] = [
  {
    id: "matched-offers",
    titleKey: "One application, matched offers.",
    bodyKey: "Apply once and see loan options worked out for your business.",
  },
  {
    id: "loan-sizes",
    titleKey: "Loan sizes that fit.",
    bodyKey: "From ₹5 Lakhs to ₹1 Crore, borrow what your business actually needs.",
  },
  {
    id: "clear-rates",
    titleKey: "Clear interest rates.",
    bodyKey: "Rates from 12% to 24% p.a., with all costs explained upfront.",
  },
  {
    id: "fast-decisions",
    titleKey: "Fast, honest decisions.",
    bodyKey: "Approvals typically within 24 hours to 7 days, depending on documents.",
  },
  {
    id: "online-process",
    titleKey: "Fully online process.",
    bodyKey: "Submit documents and e-sign from your phone or laptop.",
  },
  {
    id: "zero-fee",
    titleKey: "Zero platform fee.",
    bodyKey: "You only pay what your loan agreement says. Nothing extra to NavDhan.",
  },
];

export const recognitionItems: RecognitionItem[] = [
  {
    id: "finvision-nibm",
    titleKey: "FinVision 2026, NIBM",
    descriptionKey: "Showcased borrower-first credit tools with the NIBM fintech community.",
    writeUp:
      "FinVision 2026 at the National Institute of Bank Management brought together banks, fintech builders and academics. We presented NavDhan’s approach to calm, transparent MSME credit and received feedback that shaped our loan experience.",
    imageAsset: "/assets/recognition/finvision-nibm/01.jpeg",
    galleryAssets: [
      "/assets/recognition/finvision-nibm/02.jpeg",
      "/assets/recognition/finvision-nibm/03.jpeg",
    ],
    date: "2026",
  },
  {
    id: "startup-mahakumbh",
    titleKey: "Startup Mahakumbh",
    descriptionKey:
      "Selected at India’s largest startup gathering for making business loans simpler.",
    writeUp:
      "Startup Mahakumbh is where India’s startup ecosystem shows up. NavDhan was chosen to present to a packed audience of founders, operators and investors, and the conversations reinforced how badly small businesses need a calm, transparent loan experience.",
    imageAsset: "/assets/recognition/startup-mahakumbh/01.jpeg",
    galleryAssets: [
      "/assets/recognition/startup-mahakumbh/02.jpeg",
      "/assets/recognition/startup-mahakumbh/03.jpeg",
    ],
    date: "2024",
  },
  {
    id: "bengaluru-tech-summit",
    titleKey: "Bengaluru Tech Summit",
    descriptionKey: "Presented NavDhan to Karnataka’s deep tech and startup ecosystem.",
    writeUp:
      "Bengaluru Tech Summit gave us a stage to share NavDhan with founders, policymakers and enterprise leaders from across the state. The feedback grounded our product in the real cash-flow rhythms of South Indian MSMEs.",
    imageAsset: "",
    galleryAssets: [],
    date: "2024",
  },
  {
    id: "stpi-imc",
    titleKey: "STPI IMC",
    descriptionKey: "Selected under STPI’s IoT / mobility cohort for applied innovation in credit.",
    writeUp:
      "STPI’s incubation and mentoring cohort connected us with deep-tech founders, government stakeholders and enterprise mentors. It sharpened how we think about trust, data privacy and scale in Indian fintech.",
    imageAsset: "",
    galleryAssets: [],
    date: "2024",
  },
  {
    id: "kotak-bizlabs",
    titleKey: "Kotak BizLabs Demo Day",
    descriptionKey: "Demoed NavDhan’s MSME experience to Kotak’s banking leadership.",
    writeUp:
      "Kotak BizLabs Demo Day put us in front of banking leaders who understand credit, compliance and customer scale. Their questions pushed us to make the application flow even clearer and the fee structure more transparent.",
    imageAsset: "",
    galleryAssets: [],
    date: "2024",
  },
  {
    id: "bharat-innovation-conclave",
    titleKey: "Bharat Innovation Conclave",
    descriptionKey: "Joined the Bharat Innovation Conclave to discuss inclusive credit policy.",
    writeUp:
      "The Bharat Innovation Conclave brought together entrepreneurs, policymakers and investors focused on building for Bharat. We shared how NavDhan is designing for trust, language and small-ticket working capital needs.",
    imageAsset: "",
    galleryAssets: [],
    date: "2024",
  },
  {
    id: "rubrix-thub",
    titleKey: "Rubrix, T-Hub",
    descriptionKey: "Presented at T-Hub’s Rubrix, refining the product with fintech mentors.",
    writeUp:
      "Rubrix at T-Hub surrounded us with fintech mentors, founders and enterprise partners. The sessions forced us to articulate exactly why a small business owner should trust NavDhan with their financial data.",
    imageAsset: "",
    galleryAssets: [],
    date: "2024",
  },
  {
    id: "ai-summit",
    titleKey: "AI Summit",
    descriptionKey:
      "Discussed inclusive finance for Indian MSMEs with policymakers, builders and investors.",
    writeUp:
      "At the AI Impact Summit Bharat 2026, we shared how NavDhan is using calm, responsible technology to bring working capital closer to small business owners. The room was full of founders, regulators and researchers working on welfare for all, and it reminded us why borrower-first design matters.",
    imageAsset: "/assets/recognition/ai-summit/01.jpeg",
    galleryAssets: [
      "/assets/recognition/ai-summit/02.jpeg",
      "/assets/recognition/ai-summit/03.jpeg",
    ],
    date: "2026",
  },
];

export const customerStories: StoryCard[] = [
  {
    id: "rajiv",
    name: "Rajiv K.",
    roleKey: "Garment Shop Owner",
    questionKey:
      "I wanted to stock up for the wedding season, but I did not have collateral. Could I still get a loan?",
    outcomeKey: "Rajiv qualified for a collateral-free ₹25 Lakh business loan.",
    imageAsset: "/assets/stories/rajiv-k.jpg",
  },
  {
    id: "sunita",
    name: "Sunita M.",
    roleKey: "Handicraft Artisan, Varanasi",
    questionKey:
      "Our loom needed upgrading, but cash flow was tight. Could we get a loan for equipment?",
    outcomeKey: "Sunita secured a ₹15 Lakh machinery loan at a competitive rate.",
    imageAsset: "/assets/stories/sunita-m.jpg",
  },
  {
    id: "amit",
    name: "Amit V.",
    roleKey: "E-commerce Logistics, Gurugram",
    questionKey:
      "We needed working capital to hire more staff and take on bigger orders. What was the simplest way?",
    outcomeKey: "Amit received an ₹18 Lakh working capital loan in days.",
    imageAsset: "/assets/stories/amit-v.jpg",
  },
];

export const emiDefaults = {
  minAmount: 500_000,
  maxAmount: 10_00_00_000,
  defaultAmount: 25_00_000,
  minRate: 12,
  maxRate: 24,
  defaultRate: 18,
  minTenure: 3,
  maxTenure: 12,
  defaultTenure: 9,
};

export const trustBadges = ["RBI Aligned", "FACE Registered", "Powered by Kubar"];

export const teamMembers: TeamMember[] = [
  {
    id: "founder-1",
    name: "Vaibhav Sharma",
    roleKey: "Founder & Head of Product",
    bioKey:
      "Building NavDhan to make MSME credit calm, clear, and accessible for every business owner in India.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
    linkedIn: "https://www.linkedin.com",
  },
  {
    id: "cto-1",
    name: "Engineering Lead",
    roleKey: "Chief Technology Officer",
    bioKey:
      "Architecting the secure, scalable technology that makes business loans simple and fair.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
    linkedIn: "https://www.linkedin.com",
  },
  {
    id: "credit-1",
    name: "Credit Lead",
    roleKey: "Head of Credit",
    bioKey: "Designing underwriting standards that treat borrowers fairly while managing risk.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
  },
  {
    id: "ops-1",
    name: "Operations Lead",
    roleKey: "Head of Operations",
    bioKey: "Ensuring every application gets the responsive, human support it deserves.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
  },
];

export const advisors: Advisor[] = [
  {
    id: "advisor-1",
    name: "Fintech Advisor",
    domainKey: "Digital Lending & Compliance",
    contributionKey:
      "Advises on regulatory alignment, transparent product design, and trust-building practices.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
    linkedIn: "https://www.linkedin.com",
  },
  {
    id: "advisor-2",
    name: "MSME Advisor",
    domainKey: "Small Business Banking",
    contributionKey: "Helps shape the borrower experience around real MSME cash-flow needs.",
    imageAsset: "/assets/team/placeholder-avatar.jpg",
  },
];
