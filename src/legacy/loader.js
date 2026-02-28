export function extractLegacyParts(htmlText) {
  const source = String(htmlText || '');
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');

  const styleText = doc.querySelector('style')?.textContent || '';

  const bodyNode = doc.body;
  const inlineScripts = Array.from(bodyNode.querySelectorAll('script:not([src])'));
  const lastInlineScript = inlineScripts[inlineScripts.length - 1] || null;
  const scriptText = lastInlineScript?.textContent || '';

  const bodyClone = bodyNode.cloneNode(true);
  bodyClone.querySelectorAll('script').forEach((script) => script.remove());
  const bodyMarkup = bodyClone.innerHTML.trim();

  return {
    styleText,
    bodyMarkup,
    scriptText
  };
}

export async function mountLegacyApp({ hostElement, htmlText }) {
  if (!hostElement) {
    throw new Error('hostElement is required');
  }

  const { styleText, bodyMarkup, scriptText } = extractLegacyParts(htmlText);

  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-legacy-style', 'blackspace');
  styleTag.textContent = styleText;
  document.head.appendChild(styleTag);

  hostElement.innerHTML = bodyMarkup;

  if (scriptText.trim()) {
    // eslint-disable-next-line no-new-func
    const runner = new Function(scriptText);
    runner();
  }

  if (typeof window.onload === 'function') {
    await window.onload();
  }

  return function teardown() {
    if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
    hostElement.innerHTML = '';
  };
}
