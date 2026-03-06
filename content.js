

const ABSTRACT_SELECTORS = [
  // Google Scholar
  '[data-field="abstract"]',
  // IEEE
  '.abstract-text',
  '.u-mb-1 p',
  // ACM
  '.abstractSection p',
  '#abstract p',
  '.acm-abstract p',
  // arXiv
  'blockquote.abstract',
  '.ltx_abstract p',
  // PubMed
  '#abstract-1',
  '.abstract-content p',
  // Springer / Nature / Elsevier
  '.c-article-section__content p',
  '.Abstract p',
  '.abstract__content p',
  '.article-item__abstract p',
  // Generic selectors (broad)
  '[class*="abstract"] p',
  '[id*="abstract"] p',
  '.abstract p',
  '#abstract',
  '.abstract',
  '[class*="abstract"]',
  '[id*="abstract"]',
  // Article body fallback
  '.article-body p',
  'article p',
  '.paper-content p',
  'main p'
];

function extractAbstract() {
  for (const selector of ABSTRACT_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const text = Array.from(elements)
        .map(el => el.innerText.trim())
        .filter(t => t.length > 50)
        .join(' ')
        .trim();

      if (text.length > 100) {
        return { text, source: selector };
      }
    }
  }

  // Fallback: try meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content && metaDesc.content.length > 100) {
    return { text: metaDesc.content.trim(), source: 'meta[name="description"]' };
  }

  // Last resort: look for any element with "abstract" in text content near top of page
  const allParagraphs = document.querySelectorAll('p');
  for (let i = 0; i < Math.min(allParagraphs.length, 30); i++) {
    const p = allParagraphs[i];
    const text = p.innerText.trim();
    if (text.length > 200) {
      return { text, source: 'first-long-paragraph' };
    }
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractAbstract') {
    const result = extractAbstract();
    if (result) {
      sendResponse({
        success: true,
        text: result.text,
        source: result.source,
        pageTitle: document.title,
        pageUrl: window.location.href
      });
    } else {
      sendResponse({
        success: false,
        error: 'No abstract found on this page.'
      });
    }
  }
  return true; 
});
