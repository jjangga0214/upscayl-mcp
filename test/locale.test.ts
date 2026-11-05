import { expect, test } from "bun:test";
import { selectLocale } from "../src/locale";

test("English fallback and weighted, explicit Korean preferences", () => {
  for (const header of [
    null,
    "",
    "fr-FR",
    "*",
    "kok-IN",
    "ko;q=0",
    "ko;q=oops",
    "ko;q=0.1,*;q=0.8",
    "en-US,ko-KR",
    "ko;q=0.2,en;q=0.8",
  ])
    expect(selectLocale(header)).toBe("en");
  for (const header of [
    "ko",
    "KO-kr",
    "ko-KR,en-US",
    "fr,ko;q=0.8,en;q=0.1",
    "*;q=1,en;q=0,ko;q=0.3",
  ])
    expect(selectLocale(header)).toBe("ko");
});
