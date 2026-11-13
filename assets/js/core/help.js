// Google searches that help with paperwork. Search only: we do not recommend or rank
// any clinic. The names go to Google when the user clicks, so the UI says so.
import { googleUrl } from "./links.js";

const Q = {
  en: {
    clinic: (names, home) => `doctor prescription or doctor’s letter for travelling with ${names} ${home}`,
    online: (names, home) => `online doctor consultation travel prescription ${names} ${home}`,
    translation: (home) => `certified translation of a medical prescription ${home}`,
    embassy: (country, home) => `${country} embassy in ${home} bringing medication into ${country}`,
    customs: (country) => `${country} customs rules for travellers bringing medication`,
  },
  uk: {
    clinic: (names, home) => `лікар рецепт або довідка для подорожі з ліками ${names} ${home}`,
    online: (names, home) => `онлайн консультація лікаря рецепт для подорожі ${names} ${home}`,
    translation: (home) => `сертифікований переклад медичного рецепта ${home}`,
    embassy: (country, home) => `посольство ${country} в країні ${home} ввезення ліків до ${country}`,
    customs: (country) => `митні правила ${country} ввезення ліків для мандрівників`,
  },
};
export const MAX_NAMES = 3;

/**
 * names: ingredient names (first MAX_NAMES are used); home: departure country name;
 * countries: [{ name }] to be visited.
 * -> { documents: [{ kind, url }], countries: [{ name, embassy, customs }] }
 */
export function buildHelpLinks({ lang, names, home, countries }) {
  const q = Q[lang] ?? Q.en;
  const list = names.slice(0, MAX_NAMES).join(", ");
  return {
    documents: [
      { kind: "clinic", url: googleUrl(q.clinic(list, home)) },
      { kind: "online", url: googleUrl(q.online(list, home)) },
      { kind: "translation", url: googleUrl(q.translation(home)) },
    ],
    countries: countries.map((c) => ({
      name: c.name,
      embassy: googleUrl(q.embassy(c.name, home)),
      customs: googleUrl(q.customs(c.name)),
    })),
  };
}
