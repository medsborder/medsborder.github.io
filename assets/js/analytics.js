import { storedChoice } from "./core/consent.js";

// Allowed events carry no ingredient or country data: only counts and the
// kind of link. Nothing is sent unless the user has granted consent.
export function track(name, params = {}) {
  if (storedChoice() !== "granted") return;
  (window.dataLayer = window.dataLayer || []).push({ event: name, ...params });
}
