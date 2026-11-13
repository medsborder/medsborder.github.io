/** Countries that have at least one source (everything else is "no data"). */
export const coveredCountries = (sources) => new Set(sources.flatMap((s) => s.countries));

/** Popular destinations offered as quick picks even though we may have no data for them. */
export const POPULAR_COUNTRIES = Object.freeze(["TUR", "EGY", "ARE", "GBR", "USA", "ESP", "ITA", "GRC"]);
