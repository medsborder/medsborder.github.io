// One prompt for the whole trip, to double-check the result in an AI assistant.
// Pure text building: no DOM, no network. The prompt contains the user's
// ingredients and countries, so the UI warns before it is sent anywhere.
export const PROMPT_LANGS = ["en", "uk"];

const TEXT = {
  en: {
    intro: "I am planning international travel with medication. Please help me check the rules, using official sources only (health ministries, customs authorities, embassies, national controlled-substance lists, INCB).",
    route: "My route, in order:",
    roles: { departure: "departure", transit: "layover", destination: "destination" },
    items: "Medicines and substances I plan to carry:",
    ask: "For each country and each substance, tell me:",
    points: [
      "Whether it is allowed, needs a prescription, needs a permit or certificate, or is banned. Answer separately for entering, for transit or a layover, and for leaving.",
      "Limits on quantity or duration, packaging requirements, and the documents I need (prescription, doctor’s letter, translation, customs declaration).",
      "Whether the rules depend on citizenship or on the purpose of the trip.",
      "The official source (a link) and the date of the information.",
    ],
    rules: "If you are not sure, say so instead of guessing. Do not invent sources, and mark anything you could not verify. Show the answer as a table for each country, then a short checklist. Remind me to confirm everything with the embassy or customs of each country before I travel.",
    findings: "For comparison, a separate tool reported the results below. It may be incomplete or out of date. Treat it as unverified and tell me where it is wrong:",
    today: "Today is {date}.",
    status: { allowed: "allowed", prescription: "prescription required", restricted: "restricted (permit, certificate or limit)", banned: "banned", unknown: "no data" },
    none: "no data",
  },
  uk: {
    intro: "Я планую міжнародну подорож з ліками. Допоможи перевірити правила, використовуючи лише офіційні джерела (міністерства охорони здоровʼя, митні органи, посольства, національні переліки контрольованих речовин, INCB).",
    route: "Мій маршрут за порядком:",
    roles: { departure: "відправлення", transit: "пересадка", destination: "призначення" },
    items: "Ліки та речовини, які я планую везти:",
    ask: "Для кожної країни й кожної речовини скажи:",
    points: [
      "Чи це дозволено, чи потрібен рецепт, чи потрібен дозвіл або сертифікат, чи заборонено. Відповідай окремо для ввезення, для транзиту чи пересадки і для вивезення.",
      "Обмеження за кількістю чи строком, вимоги до пакування та документи, які мені потрібні (рецепт, лист лікаря, переклад, митна декларація).",
      "Чи залежать правила від громадянства або мети поїздки.",
      "Офіційне джерело (посилання) і дату інформації.",
    ],
    rules: "Якщо ти не впевнений, скажи про це, а не вгадуй. Не вигадуй джерел і познач усе, що не вдалося перевірити. Покажи відповідь таблицею для кожної країни, а потім коротким чек-листом. Нагадай мені підтвердити все в посольстві або митниці кожної країни перед поїздкою.",
    findings: "Для порівняння: окремий інструмент показав такі результати. Вони можуть бути неповними або застарілими. Вважай їх неперевіреними й скажи, де вони хибні:",
    today: "Сьогодні {date}.",
    status: { allowed: "дозволено", prescription: "потрібен рецепт", restricted: "обмежено (дозвіл, сертифікат або ліміт)", banned: "заборонено", unknown: "немає даних" },
    none: "немає даних",
  },
};

/**
 * ingredients: [{ en, local? }]  (local: name in the user's language, if any)
 * route: [{ name, role }]        (role: departure | transit | destination; names in the prompt language)
 * findings: null | [{ country, substance, status }]  (opt-in: what the checker found)
 */
export function buildPrompt({ lang, ingredients, route, findings = null, today }) {
  const t = TEXT[lang] ?? TEXT.en;
  const name = (i) => (lang === "uk" && i.local && i.local !== i.en ? `${i.local} (${i.en})` : i.en);
  const lines = [
    t.intro, "",
    t.route,
    ...route.map((s, n) => `${n + 1}. ${s.name} (${t.roles[s.role]})`), "",
    t.items,
    ...ingredients.map((i) => `- ${name(i)}`), "",
    t.ask,
    ...t.points.map((p, n) => `${n + 1}. ${p}`), "",
    t.rules,
  ];
  if (findings?.length) {
    lines.push("", t.findings, ...findings.map((f) => `- ${f.country}, ${f.substance}: ${t.status[f.status] ?? t.none}`));
  }
  lines.push("", t.today.replace("{date}", today));
  return lines.join("\n");
}
