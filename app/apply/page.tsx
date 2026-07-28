import { redirect } from "next/navigation";
import { getTranslator } from "@/src/lib/i18n/translations";
import { defaultLocale } from "@/src/lib/i18n/config";

export default async function ApplyRootPage() {
  await getTranslator(defaultLocale, "apply");
  redirect(`/${defaultLocale}/apply`);
}
