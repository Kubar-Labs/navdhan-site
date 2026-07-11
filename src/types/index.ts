export interface NavLink {
  labelKey: string;
  href: string;
}

export interface Cta {
  labelKey: string;
  href: string;
  variant?: "primary" | "secondary" | "outline";
}

export interface LocaleOption {
  value: string;
  label: string;
  script: string;
}

export interface ProductCard {
  id: string;
  titleKey: string;
  descriptionKey: string;
  iconName: string;
  href?: string;
  ctaKey: string;
}

export interface ReasonBlock {
  id: string;
  titleKey: string;
  bodyKey: string;
}

export interface RecognitionItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  writeUp: string;
  imageAsset: string;
  galleryAssets: string[];
  date?: string;
}

export interface StoryCard {
  id: string;
  name: string;
  roleKey: string;
  questionKey: string;
  outcomeKey: string;
  imageAsset?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  roleKey: string;
  bioKey: string;
  imageAsset?: string;
  linkedIn?: string;
}

export interface Advisor {
  id: string;
  name: string;
  domainKey: string;
  contributionKey: string;
  imageAsset?: string;
  linkedIn?: string;
}

export interface BadgeItem {
  name: string;
  logoAsset: string;
  href?: string;
  altKey: string;
}

export interface PartnerItem {
  name: string;
  logoAsset: string;
  href?: string;
  altKey: string;
}

export interface EmiDefaults {
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  minRate: number;
  maxRate: number;
  defaultRate: number;
  minTenure: number;
  maxTenure: number;
  defaultTenure: number;
  ctaKey?: string;
  ctaHref?: string;
}
