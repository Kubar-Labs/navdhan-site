import { z } from "zod";

export const legalPageMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

export const legalCompanySchema = z.object({
  name: z.string().min(1),
  legalName: z.string().min(1),
  cin: z.string().min(1),
  address: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  website: z.string().url(),
});

export const legalIntroSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
});

export const legalCrossLinkSchema = z.object({
  label: z.string().min(1),
  slug: z.string().min(1),
});

export const legalListItemSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
});

export const legalContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email(),
  address: z.string().min(1),
});

export const legalTableDataSchema = z.object({
  caption: z.string().optional(),
  headers: z.array(z.string().min(1)),
  rows: z.array(z.array(z.string())),
});

export const baseLegalSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const proseLegalSectionSchema = baseLegalSectionSchema.extend({
  content_type: z.literal("prose"),
  body: z.string().min(1),
  cross_link: legalCrossLinkSchema.optional(),
});

export const listLegalSectionSchema = baseLegalSectionSchema.extend({
  content_type: z.literal("list"),
  items: z.array(legalListItemSchema).min(1),
});

export const tableLegalSectionSchema = baseLegalSectionSchema.extend({
  content_type: z.literal("table"),
  table: legalTableDataSchema,
});

export const contactLegalSectionSchema = baseLegalSectionSchema.extend({
  content_type: z.literal("contact_card"),
  contact: legalContactSchema,
  cross_link: legalCrossLinkSchema.optional(),
});

export const legalSectionSchema = z.discriminatedUnion("content_type", [
  proseLegalSectionSchema,
  listLegalSectionSchema,
  tableLegalSectionSchema,
  contactLegalSectionSchema,
]);

export const legalPageSchema = z.object({
  meta: legalPageMetaSchema,
  lastUpdated: z.string().min(1),
  company: legalCompanySchema,
  intro: legalIntroSchema,
  sections: z.array(legalSectionSchema),
});

export type LegalPageSchema = z.infer<typeof legalPageSchema>;
export type LegalSectionSchema = z.infer<typeof legalSectionSchema>;
