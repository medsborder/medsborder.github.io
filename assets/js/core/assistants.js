// Links that open an AI assistant, with the prompt filled in where that is possible.
// Verified 2026-11 (see README): Claude documents ?q= (the text is only filled in,
// the user presses send; long text is cut at about 14,000 characters). ChatGPT and
// Perplexity accept ?q= but do not document it. Gemini has no documented parameter,
// so it is opened empty. The UI copies the prompt to the clipboard on every click
// as a fallback. URLs over MAX_PREFILL_URL are not filled in (Cyrillic costs 6 characters
// per letter once encoded: a Ukrainian prompt for 3 ingredients is about 6,100).
export const MAX_PREFILL_URL = 8000;

export const ASSISTANTS = Object.freeze([
  { id: "chatgpt", name: "ChatGPT", home: "https://chatgpt.com/", prefill: "https://chatgpt.com/?q=" },
  { id: "claude", name: "Claude", home: "https://claude.ai/new", prefill: "https://claude.ai/new?q=" },
  { id: "perplexity", name: "Perplexity", home: "https://www.perplexity.ai/", prefill: "https://www.perplexity.ai/search?q=" },
  { id: "gemini", name: "Gemini", home: "https://gemini.google.com/app", prefill: null },
]);

/** [{ id, name, url, prefilled }] for a prompt text. */
export function assistantLinks(prompt) {
  return ASSISTANTS.map((a) => {
    const filled = a.prefill ? `${a.prefill}${encodeURIComponent(prompt)}` : null;
    const prefilled = Boolean(filled) && filled.length <= MAX_PREFILL_URL;
    return { id: a.id, name: a.name, url: prefilled ? filled : a.home, prefilled };
  });
}
