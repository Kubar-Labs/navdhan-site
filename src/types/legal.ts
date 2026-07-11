export interface LegalPageMeta {
  title: string;
  description: string;
}

export interface LegalCompany {
  name: string;
  legalName: string;
  cin: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export interface LegalIntro {
  heading: string;
  body: string;
}

export interface LegalCrossLink {
  label: string;
  slug: string;
}

export interface LegalListItem {
  heading: string;
  body: string;
}

export interface LegalContact {
  name: string;
  role: string;
  email: string;
  address: string;
}

export interface LegalTableData {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface BaseLegalSection {
  id: string;
  title: string;
}

export interface ProseLegalSection extends BaseLegalSection {
  content_type: "prose";
  body: string;
  cross_link?: LegalCrossLink;
}

export interface ListLegalSection extends BaseLegalSection {
  content_type: "list";
  items: LegalListItem[];
}

export interface TableLegalSection extends BaseLegalSection {
  content_type: "table";
  table: LegalTableData;
}

export interface ContactLegalSection extends BaseLegalSection {
  content_type: "contact_card";
  contact: LegalContact;
  cross_link?: LegalCrossLink;
}

/** Content type for each legal contract paragraph. */
export type ContentType = "prose" | "list" | "table" | "contact_card";

/** A single legal section. */
export type LegalSection =
  | ProseLegalSection
  | ListLegalSection
  | TableLegalSection
  | ContactLegalSection;

/** Parsed content of a legal page JSON file. */
export interface LegalPageContent {
  meta: LegalPageMeta;
  lastUpdated: string;
  company: LegalCompany;
  intro: LegalIntro;
  sections: LegalSection[];
}

/** A lightweight entry for the table of contents. */
export interface LegalTocEntry {
  id: string;
  title: string;
}
