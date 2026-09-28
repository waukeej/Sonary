                                                                                               
(() => {
  const flatten = (object, prefix = "", result = {}) => {
    Object.entries(object).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") result[path] = value;
      else flatten(value, path, result);
    });
    return result;
  };
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const originals = new WeakMap();
  const attributes = new WeakMap();
  let ru = {},
    en = {},
    reverse = new Map(),
    observer;
  const excluded =
    "script,style,textarea,[contenteditable],[data-no-i18n],[data-agreement-name],.profile-username,.track-title,.track-artist";
  function translate(value) {
    if (document.documentElement.lang !== "en") return value;
    const key = reverse.get(normalize(value));
    if (!key || !en[key]) {
      const numbered = value.match(/^(\s*\d+\.\s+)(.+)$/);
      if (numbered) return numbered[1] + translate(numbered[2]);
      const title = value.match(/^(.+?)(\s+—\s+Sonary)$/);
      if (title) return translate(title[1]) + title[2];
      const labelledNumber = value.match(/^(.+?)(\s+\d+)$/);
      if (labelledNumber)
        return translate(labelledNumber[1]) + labelledNumber[2];
      return value;
    }
    return value.replace(value.trim(), en[key]);
  }
  function visit(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest(excluded)) return;
      const old = originals.get(root);
      const source =
        old && root.nodeValue === old.rendered ? old.source : root.nodeValue;
      const rendered = translate(source);
      originals.set(root, { source, rendered });
      if (root.nodeValue !== rendered) root.nodeValue = rendered;
      return;
    }
    if (
      root.nodeType !== Node.ELEMENT_NODE ||
      root.matches("script,style,[contenteditable],[data-no-i18n]")
    )
      return;
    if (root.tagName === "OPTION" && !root.hasAttribute("value"))
      root.setAttribute("value", root.value || root.textContent);
    const saved = attributes.get(root) || {};
    ["placeholder", "title", "aria-label", "alt"].forEach((name) => {
      if (!root.hasAttribute(name)) return;
      const current = root.getAttribute(name),
        old = saved[name];
      const source = old && current === old.rendered ? old.source : current;
      const rendered = translate(source);
      saved[name] = { source, rendered };
      if (current !== rendered) root.setAttribute(name, rendered);
    });
    attributes.set(root, saved);
    if (root.tagName === "TEXTAREA") return;
    [...root.childNodes].forEach(visit);
  }
  function refresh() {
    observer?.disconnect();
    visit(document.documentElement);
    observer?.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["title", "aria-label", "placeholder", "alt"],
    });
  }
  window.SonaryI18n = {
    t: (key) =>
      (document.documentElement.lang === "en" ? en[key] : ru[key]) ||
      ru[key] ||
      key,
    translate,
    originalText: (element) => {
      const walk = (node) =>
        node.nodeType === Node.TEXT_NODE
          ? originals.get(node)?.source || node.nodeValue
          : [...node.childNodes].map(walk).join("");
      return walk(element);
    },
  };
  Promise.all(
    ["ru", "en"].map((language) =>
      fetch(
        document.querySelector(
          `link[rel="localization"][hreflang="${language}"]`,
        )?.href || `/static/localaise-${language}.json`,
        { cache: "no-cache" },
      ).then((response) => {
        if (!response.ok) throw new Error("Localization unavailable");
        return response.json();
      }),
    ),
  )
    .then(([russian, english]) => {
      ru = flatten(russian);
      en = flatten(english);
      Object.entries(flatten(english.translation_overrides || {})).forEach(
        ([key, value]) => {
          en[key.replace(/^translation_overrides\./, "")] = value;
        },
      );
      reverse = new Map(
        Object.entries(ru).map(([key, value]) => [normalize(value), key]),
      );
      observer = new MutationObserver(refresh);
      refresh();
      document.addEventListener("sonary:language", refresh);
    })
    .catch((error) => console.warn(error.message));
})();
