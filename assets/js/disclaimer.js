import { DISCLAIMER_KEY, encodeAck, storedAck } from "./core/disclaimer.js";

const TERMS = { en: "/en/terms/", uk: "/uk/terms/" };

const STRINGS = {
  en: {
    title: "Before you continue",
    lead: "MedsBorder helps you prepare for a trip, but it cannot guarantee that your medicines will be allowed.",
    points: [
      "This is not legal or medical advice.",
      "The data may be incomplete, out of date or wrong. Rules change without notice.",
      "“No data” or “unknown” never means “allowed”.",
      "Border officers decide on the spot. Check the official rules of every country on your route, layovers included, and ask your doctor before you travel.",
      "You use the results at your own risk.",
    ],
    terms: "Terms and disclaimer",
    check: "I have read and understood this, and I will verify the information with official sources before I travel.",
    go: "Continue to the checker",
  },
  uk: {
    title: "Перш ніж продовжити",
    lead: "MedsBorder допомагає підготуватися до поїздки, але не може гарантувати, що ваші ліки дозволять провезти.",
    points: [
      "Це не юридична й не медична порада.",
      "Дані можуть бути неповними, застарілими або помилковими. Правила змінюються без попередження.",
      "«Немає даних» або «невідомо» ніколи не означає «дозволено».",
      "Рішення на кордоні ухвалює офіцер на місці. Перевірте офіційні правила кожної країни маршруту, включно з пересадками, і порадьтеся з лікарем до поїздки.",
      "Ви користуєтеся результатами на власний ризик.",
    ],
    terms: "Умови й застереження",
    check: "Я прочитав(ла) і розумію це, та перевірю інформацію в офіційних джерелах перед поїздкою.",
    go: "Перейти до перевірки",
  },
};

let ready = null;

/**
 * Resolves once the visitor has ticked the box and continued. Resolves at once on pages
 * without the checker (privacy, terms, ...) and when a valid acknowledgement is stored.
 * The dialog cannot be dismissed with Escape, so there is no way past it except the checkbox.
 */
export function disclaimerGate(lang) {
  if (ready) return ready;
  if (!document.getElementById("app") || storedAck()) return (ready = Promise.resolve());
  const t = STRINGS[lang] ?? STRINGS.en;
  ready = new Promise((resolve) => {
    const open = () => {
      const dlg = document.createElement("dialog");
      dlg.className = "gate";
      dlg.setAttribute("aria-labelledby", "gate-title");
      dlg.setAttribute("aria-describedby", "gate-lead");
      let done = false;
      dlg.addEventListener("cancel", (e) => e.preventDefault());
      // Browsers may close a modal dialog on a repeated Escape even when "cancel" is prevented,
      // so reopen it until the checkbox has been used.
      dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") e.preventDefault(); });
      dlg.addEventListener("close", () => { if (!done) dlg.showModal(); });

      const h = Object.assign(document.createElement("h2"), { id: "gate-title", textContent: t.title });
      const lead = Object.assign(document.createElement("p"), { id: "gate-lead", textContent: t.lead });
      const ul = document.createElement("ul");
      for (const p of t.points) ul.append(Object.assign(document.createElement("li"), { textContent: p }));
      const terms = document.createElement("p");
      terms.append(Object.assign(document.createElement("a"), { href: TERMS[lang] ?? TERMS.en, target: "_blank", rel: "noopener noreferrer", textContent: t.terms }));

      const box = Object.assign(document.createElement("input"), { type: "checkbox", id: "gate-check" });
      const label = Object.assign(document.createElement("label"), { className: "gate-check", htmlFor: "gate-check" });
      label.append(box, Object.assign(document.createElement("span"), { textContent: t.check }));

      const go = Object.assign(document.createElement("button"), { type: "button", className: "btn primary", textContent: t.go, disabled: true });
      box.addEventListener("change", () => { go.disabled = !box.checked; });
      go.addEventListener("click", () => {
        if (!box.checked) return;
        try { localStorage.setItem(DISCLAIMER_KEY, encodeAck()); } catch { /* storage blocked: asked again next visit */ }
        done = true;
        dlg.close();
        dlg.remove();
        document.documentElement.classList.remove("gate-open");
        resolve();
      });

      dlg.append(h, lead, ul, terms, label, go);
      document.body.append(dlg);
      document.documentElement.classList.add("gate-open");
      dlg.showModal();
      box.focus();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open);
    else open();
  });
  return ready;
}
