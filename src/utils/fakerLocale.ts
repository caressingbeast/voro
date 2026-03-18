import { allFakers, type Faker } from "@faker-js/faker";

/**
 * Map user-facing locale (e.g. en-US, de, pt_BR) to a @faker-js/faker instance.
 * Defaults to en_US when missing or unknown.
 */
export function resolveFakerLocaleKey(locale: string): keyof typeof allFakers {
  const raw = locale.trim().replace(/-/g, "_");
  const parts = raw.split("_").filter(Boolean);
  if (parts.length === 0) return "en_US";

  const candidate =
    parts.length === 1
      ? parts[0].toLowerCase()
      : `${parts[0].toLowerCase()}_${parts.slice(1).map((p) => p.toUpperCase()).join("_")}`;

  if (candidate in allFakers) return candidate as keyof typeof allFakers;
  const short = parts[0].toLowerCase();
  if (short in allFakers) return short as keyof typeof allFakers;
  return "en_US";
}

export function getFakerForLocale(locale?: string): Faker {
  if (!locale?.trim()) return allFakers.en_US;
  return allFakers[resolveFakerLocaleKey(locale)] ?? allFakers.en_US;
}
