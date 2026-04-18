// Pure i18n translator factory. No I/O, no side-effects.
// Client-side: copy the createTranslator function verbatim into public/index.html.
// Bundles are plain objects keyed by lang code. Fallback chain: currentLang → en → key.
// {word} placeholder interpolation; unknown vars resolve to empty string.

export function createTranslator(bundles, initialLang = 'en') {
  let currentLang = initialLang;

  function t(key, vars) {
    const s = (bundles[currentLang] && bundles[currentLang][key])
           ?? (bundles.en && bundles.en[key])
           ?? key;
    if (!vars) return s;
    // {word} placeholders only — keys with hyphen/dot are not interpolation targets
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  }

  return {
    t,
    setLang(lang) { if (lang != null) currentLang = lang; },
    getLang() { return currentLang; },
  };
}
