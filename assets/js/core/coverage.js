/** Countries that have at least one source (everything else is "no data"). */
export const coveredCountries = (sources) => new Set(sources.flatMap((s) => s.countries));
