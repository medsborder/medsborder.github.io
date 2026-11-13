// Renders the "Coverage and sources" page from the data files. The page is static HTML
// that is committed; tests/sourcespage.test.js fails when it no longer matches the data,
// so run `just sources-page` after changing anything in data/. The terms page of the same
// language is used as the template for the head, header and footer, so they never drift.
import { buildCells } from "../../assets/js/core/buildMap.js";
import { coveredCountries } from "../../assets/js/core/coverage.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TEXT = {
  en: {
    title: "Coverage and sources · MedsBorder",
    description: "Which countries and substances MedsBorder covers, where the data comes from, how statuses are decided and how current each source is.",
    h1: "Coverage and sources",
    updated: "Data last verified: {date}.",
    intro: "MedsBorder only answers where it has an official source. This page lists every country and source we use, what each status means and what we do not cover. It is generated from the project data.",
    statusesH: "What the statuses mean",
    statuses: [
      ["allowed", "Allowed", "The ingredient is not on the control list we checked. This is not a guarantee for your luggage."],
      ["prescription", "Prescription required", "Dispensed or carried only with a prescription."],
      ["restricted", "Restricted", "Needs a permit, a certificate or is limited, for example by quantity."],
      ["banned", "Banned", "Prohibited."],
      ["unknown", "No data", "We have no source. It never means “allowed”: check the rules yourself."],
    ],
    rulesH: "How we decide",
    rules: [
      "Every entry comes from an official text (a law, a regulation or a national list) and links to it. Each source shows the date we last checked it.",
      "A source older than a year is flagged as out of date in the results.",
      "If several sources apply, a country-level source overrides a group source, and when two country-level sources disagree the stricter status is shown.",
      "For a layover we use transit rules where we have them; otherwise the general rules are shown and flagged.",
      "An ingredient you type that is not in our list is never judged: you only get search links.",
    ],
    countriesH: "Countries and sources",
    scope: { country: "country", group: "group", transit: "transit" },
    scopeLabel: "Scope", verified: "Verified", license: "Licence", substances: "Substances",
    matrixH: "Substances by country",
    matrixIntro: "The status each country shows for each substance, as on the results page. “No data” means we have no source.",
    colSubstance: "Substance",
    matrixLabel: "Substances by country, scrollable table",
    notH: "What we do not cover yet",
    not: [
      "Countries without a source. They show “no data” and links to check the rules yourself.",
      "Export rules of the departure country: it is shown for context only.",
      "Quantity or dosage limits, forms, a doctor’s letter, translated prescriptions, customs declarations and citizenship.",
    ],
    reportH: "Found a mistake?",
    report: "Open an issue with the country, the ingredient and an official source. Do not include personal or health details; issues on GitHub are public.",
    reportLink: "Report incorrect data",
    privacy: "Privacy and cookies", terms: "Terms and disclaimer", cookie: "Cookie settings",
  },
  uk: {
    title: "Покриття й джерела · MedsBorder",
    description: "Які країни й речовини покриває MedsBorder, звідки дані, як визначаються статуси і наскільки свіже кожне джерело.",
    h1: "Покриття й джерела",
    updated: "Дані востаннє перевірено: {date}.",
    intro: "MedsBorder відповідає лише там, де має офіційне джерело. Тут перелічено кожну країну й джерело, що ми використовуємо, що означає кожен статус і що ми не покриваємо. Сторінка генерується з даних проєкту.",
    statusesH: "Що означають статуси",
    statuses: [
      ["allowed", "Дозволено", "Речовини немає в переліку контрольованих, який ми перевірили. Це не гарантія для вашого багажу."],
      ["prescription", "Потрібен рецепт", "Відпускається або провозиться лише за рецептом."],
      ["restricted", "Обмежено", "Потрібен дозвіл чи сертифікат або діє обмеження, наприклад за кількістю."],
      ["banned", "Заборонено", "Заборонено."],
      ["unknown", "Немає даних", "Джерела немає. Це ніколи не означає «дозволено»: перевірте правила самостійно."],
    ],
    rulesH: "Як ми визначаємо",
    rules: [
      "Кожен запис походить з офіційного тексту (закон, постанова чи національний перелік) і має посилання на нього. Кожне джерело показує дату, коли ми його востаннє перевіряли.",
      "Джерело, старше за рік, у результатах позначається як застаріле.",
      "Якщо діє кілька джерел, джерело країни перекриває груповe, а коли два джерела країни суперечать одне одному, показується суворіший статус.",
      "Для пересадки ми використовуємо правила транзиту, якщо вони є; інакше показуються загальні правила з позначкою.",
      "Речовина, яку ви ввели й якої немає в нашому списку, ніколи не оцінюється: ви отримуєте лише пошукові посилання.",
    ],
    countriesH: "Країни й джерела",
    scope: { country: "країна", group: "група", transit: "транзит" },
    scopeLabel: "Охоплення", verified: "Перевірено", license: "Ліцензія", substances: "Речовини",
    matrixH: "Речовини за країнами",
    matrixIntro: "Статус, який кожна країна показує для кожної речовини, як на сторінці результатів. «Немає даних» означає, що джерела немає.",
    colSubstance: "Речовина",
    matrixLabel: "Речовини за країнами, таблиця з прокруткою",
    notH: "Чого ми ще не покриваємо",
    not: [
      "Країни без джерела. Вони показують «немає даних» і посилання, щоб перевірити правила самостійно.",
      "Правила вивезення з країни відправлення: вона показується лише для контексту.",
      "Обмеження за кількістю чи дозуванням, форми, лист лікаря, перекладені рецепти, митні декларації та громадянство.",
    ],
    reportH: "Знайшли помилку?",
    report: "Створіть звернення з країною, речовиною й офіційним джерелом. Не вказуйте особисті чи медичні дані: звернення на GitHub публічні.",
    reportLink: "Повідомити про помилку в даних",
    privacy: "Конфіденційність і cookie", terms: "Умови й застереження", cookie: "Налаштування cookie",
  },
};

const REPO = "https://github.com/medsborder/medsborder.github.io";

/** Statuses as the site resolves them for a country (same function as the results page). */
function statusMap(countryCodes, substanceIds, sources, now) {
  return buildCells(countryCodes.map((alpha3) => ({ alpha3, roles: ["destination"] })), substanceIds, sources, now);
}

export function pageContent(lang, { countries, substances, sources }, now = new Date("2026-11-14")) {
  const t = TEXT[lang];
  const name = (c) => c.name[lang];
  const covered = coveredCountries(sources);
  const list = countries.filter((c) => covered.has(c.alpha3)).sort((a, b) => name(a).localeCompare(name(b), lang));
  const sub = (s) => (lang === "uk" ? `${s.names.en[0]} (${s.names.uk[0]})` : s.names.en[0]);
  const newest = sources.map((s) => s.verifiedAt).sort().at(-1);
  const cells = statusMap(list.map((c) => c.alpha3), substances.map((s) => s.id), sources, now);
  const badge = (s) => `<span class="status status-${s}">${esc(t.statuses.find((x) => x[0] === s)[1])}</span>`;

  const countryBlocks = list.map((c) => {
    const own = sources.filter((s) => s.countries.includes(c.alpha3));
    return `    <section class="country-sources" aria-labelledby="cs-${c.alpha3}">
      <h3 id="cs-${c.alpha3}">${esc(name(c))}</h3>
      <ul>
${own.map((s) => `        <li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br><span class="muted">${t.scopeLabel}: ${esc(t.scope[s.scope] ?? s.scope)} · ${t.verified}: ${esc(s.verifiedAt)} · ${t.substances}: ${new Set(s.entries.map((e) => e.substance)).size} · ${t.license}: ${esc(s.license)}</span></li>`).join("\n")}
      </ul>
    </section>`;
  }).join("\n");

  const header = `<tr><th scope="col">${t.colSubstance}</th>${list.map((c) => `<th scope="col">${esc(name(c))}</th>`).join("")}</tr>`;
  const rows = substances.map((s) => `<tr><th scope="row">${esc(sub(s))}</th>${list.map((c) => `<td>${badge(cells[c.alpha3][s.id].status)}</td>`).join("")}</tr>`).join("\n          ");

  return `
    <h1>${t.h1}</h1>
    <p class="muted">${t.updated.replace("{date}", newest)}</p>
    <p>${t.intro}</p>
    <h2>${t.statusesH}</h2>
    <dl class="status-legend">
${t.statuses.map(([k, label, text]) => `      <dt>${badge(k)}</dt><dd>${text}</dd>`).join("\n")}
    </dl>
    <h2>${t.rulesH}</h2>
    <ul>
${t.rules.map((r) => `      <li>${r}</li>`).join("\n")}
    </ul>
    <h2>${t.countriesH}</h2>
${countryBlocks}
    <h2>${t.matrixH}</h2>
    <p>${t.matrixIntro}</p>
    <div class="table-wrap" role="region" aria-label="${t.matrixLabel}" tabindex="0">
      <table class="coverage-table">
        <thead>${header}</thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <h2>${t.notH}</h2>
    <ul>
${t.not.map((r) => `      <li>${r}</li>`).join("\n")}
    </ul>
    <h2>${t.reportH}</h2>
    <p>${t.report} <a href="${REPO}/issues/new?labels=incorrect-data" target="_blank" rel="noopener noreferrer">${t.reportLink}</a></p>
  `;
}

/** Builds the page from the terms page of the same language (head, header, footer). */
export function renderSourcesPage(lang, data, termsHtml, now) {
  const t = TEXT[lang];
  const termsTitle = termsHtml.match(/<title>(.*?)<\/title>/)[1];
  const termsDesc = termsHtml.match(/<meta name="description" content="([^"]*)"/)[1];
  let html = termsHtml
    .split(termsTitle).join(esc(t.title))
    .split(termsDesc).join(esc(t.description))
    .split("/terms/").join("/sources/");
  html = html.replace(/<main class="static">[\s\S]*<\/main>/, `<main class="static">${pageContent(lang, data, now)}</main>`);
  // footer: keep privacy, link terms, add the cookie button (as on the terms page of this language)
  html = html.replace(/<footer class="site-footer">[\s\S]*<\/footer>/, `<footer class="site-footer"><p><a href="../privacy/">${t.privacy}</a> · <a href="../terms/">${t.terms}</a> · <button type="button" class="linklike" data-cookie-settings>${t.cookie}</button></p></footer>`);
  return html;
}

export { TEXT as SOURCES_TEXT };
