import { selectLocale } from "./locale";

export function terminalLocale() {
  const tag =
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANG ||
    Intl.DateTimeFormat().resolvedOptions().locale;
  return selectLocale(tag.split(/[.@]/)[0].replaceAll("_", "-"));
}
