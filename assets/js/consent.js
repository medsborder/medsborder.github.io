import { STORAGE_KEY, encodeChoice, storedChoice, GA_COOKIE, cookieDomains } from "./core/consent.js";

export const GTM_ID = "GTM-WJMLCVGW";
const POLICY = { en: "/en/privacy/", uk: "/uk/privacy/" };

const STRINGS = {
  en: {
    title: "Analytics cookies",
    text: "With your permission we use Google Tag Manager and Google Analytics to count visits. This sets cookies and sends data to Google. The ingredients and countries you enter are never sent. Using the site works the same either way, and you can change your mind at any time.",
    accept: "Accept analytics",
    reject: "Reject analytics",
    policy: "Privacy and cookie policy",
    settings: "Cookie settings",
    current: { granted: "Current setting: analytics on.", denied: "Current setting: analytics off.", none: "No choice made yet." },
    saved: { granted: "Analytics turned on.", denied: "Analytics turned off." },
  },
  uk: {
    title: "Аналітичні cookie",
    text: "За вашою згодою ми використовуємо Google Tag Manager і Google Analytics, щоб рахувати відвідування. Це встановлює cookie й надсилає дані до Google. Інгредієнти й країни, які ви вводите, ніколи не надсилаються. Сайт працює однаково в обох випадках, а передумати можна будь-коли.",
    accept: "Прийняти аналітику",
    reject: "Відхилити аналітику",
    policy: "Політика конфіденційності й cookie",
    settings: "Налаштування cookie",
    current: { granted: "Поточне налаштування: аналітика ввімкнена.", denied: "Поточне налаштування: аналітика вимкнена.", none: "Вибір ще не зроблено." },
    saved: { granted: "Аналітику ввімкнено.", denied: "Аналітику вимкнено." },
  },
};

function pageLang() {
  const path = location.pathname;
  if (path.includes("/uk/")) return "uk";
  if (path.includes("/en/")) return "en";
  return (navigator.language || "").toLowerCase().startsWith("uk") ? "uk" : "en";
}
const lang = pageLang();
const t = STRINGS[lang];

// ---------- Google Tag Manager (loaded only after consent) ----------
let gtmLoaded = false;

function gtag() { window.dataLayer.push(arguments); }

function loadGtm() {
  if (gtmLoaded) return;
  gtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  // Consent Mode v2: everything denied by default; only analytics is granted.
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
  });
  gtag("consent", "update", { analytics_storage: "granted" });
  // Standard Google Tag Manager loader (no <noscript><iframe>: it would load without consent).
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
}

function clearGoogleCookies() {
  const names = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => GA_COOKIE.test(n));
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const d of cookieDomains(location.hostname)) document.cookie = `${name}=; Max-Age=0; path=/; domain=${d}`;
  }
}

function apply(choice) {
  if (choice === "granted") {
    loadGtm();
  } else {
    if (gtmLoaded) gtag("consent", "update", { analytics_storage: "denied" });
    clearGoogleCookies();
  }
}

// ---------- banner ----------
let banner;
let status;
let opener;

function build() {
  const btn = (choice, label) =>
    Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: label, onclick: () => choose(choice) });
  banner = document.createElement("div");
  banner.className = "consent";
  banner.id = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "consent-title");
  banner.hidden = true;
  const title = Object.assign(document.createElement("h2"), { id: "consent-title", textContent: t.title, tabIndex: -1 });
  const text = Object.assign(document.createElement("p"), { textContent: t.text });
  const current = Object.assign(document.createElement("p"), { id: "consent-current", className: "hint" });
  const link = Object.assign(document.createElement("a"), { href: POLICY[lang], textContent: t.policy });
  const actions = document.createElement("div");
  actions.className = "consent-actions";
  // Same element type, class and size: accepting and rejecting are equally prominent.
  actions.append(btn("granted", t.accept), btn("denied", t.reject));
  status = Object.assign(document.createElement("p"), { className: "sr-only" });
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const linkP = document.createElement("p");
  linkP.append(link);
  banner.append(title, text, current, linkP, actions, status);
  document.body.prepend(banner);
}

function reserveSpace() {
  const h = banner.hidden ? 0 : banner.offsetHeight;
  document.documentElement.style.setProperty("--consent-h", `${h}px`);
}

function show(fromUser) {
  const now = storedChoice();
  banner.querySelector("#consent-current").textContent = t.current[now ?? "none"];
  banner.hidden = false;
  reserveSpace();
  if (fromUser) banner.querySelector("#consent-title").focus();
}

function hide() {
  banner.hidden = true;
  reserveSpace();
}

function choose(choice) {
  try { localStorage.setItem(STORAGE_KEY, encodeChoice(choice === "granted")); } catch { /* storage blocked: choice lasts for this page only */ }
  apply(choice);
  status.textContent = t.saved[choice];
  hide();
  opener?.focus();
}

function init() {
  build();
  window.addEventListener("resize", reserveSpace);
  opener = document.querySelector("[data-cookie-settings]");
  for (const b of document.querySelectorAll("[data-cookie-settings]")) {
    b.textContent = t.settings;
    b.addEventListener("click", () => { opener = b; show(true); });
  }
  const choice = storedChoice();
  if (choice) apply(choice);
  else show(false);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
