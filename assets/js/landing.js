// Language hint for the root page: no redirect, only a note when the browser prefers Ukrainian.
// Nothing is stored and nothing is sent anywhere.
const prefers = (navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]).map((l) => String(l).toLowerCase());
const hint = document.getElementById("lang-hint");
if (hint && prefers.some((l) => l === "uk" || l.startsWith("uk-"))) hint.hidden = false;
