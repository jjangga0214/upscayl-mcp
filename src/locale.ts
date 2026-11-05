export type Locale = "en" | "ko";

// Browser preference order breaks ties between equally weighted supported languages.
export function selectLocale(preferences: string | null | undefined): Locale {
  let selected: Locale = "en",
    weight = 0;
  let wildcard = 0,
    explicitEnglish = false;
  for (const item of (preferences ?? "").split(",")) {
    const match =
      /^\s*((?:en|ko)(?:-[a-z0-9]{1,8})*|\*)\s*(?:;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(
        item,
      );
    if (!match) continue;
    const q = match[2] === undefined ? 1 : Number(match[2]);
    const tag = match[1].toLowerCase().split("-")[0];
    if (tag === "*") {
      wildcard = Math.max(wildcard, q);
      continue;
    }
    if (tag === "en") explicitEnglish = true;
    if (q > weight) {
      weight = q;
      selected = tag === "ko" ? "ko" : "en";
    }
  }
  return !explicitEnglish && wildcard > weight ? "en" : selected;
}

export const localized = (locale: Locale) => (en: string, ko: string) =>
  locale === "ko" ? ko : en;
