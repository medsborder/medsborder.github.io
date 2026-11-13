// Flags drawn as equal bands, only for countries that have data. A country without
// an entry here gets a plain code badge. tests/flags.test.js fails when a country that
// has a source has no flag, so a flag is added together with the data.
export const FLAGS = Object.freeze({
  UKR: { dir: "h", colors: ["#0057b7", "#ffd500"] },
  DEU: { dir: "h", colors: ["#000000", "#dd0000", "#ffce00"] },
  POL: { dir: "h", colors: ["#ffffff", "#dc143c"] },
  FRA: { dir: "v", colors: ["#0055a4", "#ffffff", "#ef4135"] },
});
