(() => {
  const KEY = 'tonight_language_v1', CACHE = 'tonight_translation_en_v1';
  let language = localStorage.getItem(KEY) || 'ja', busy = false, observer;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch {}
  const ignored = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','OPTION','CODE','PRE','SVG']);
  const eligible = node => {
    const p = node.parentElement;
    if (!p || ignored.has(p.tagName) || p.closest('[data-no-translate],script,style,textarea,input,select,option,[contenteditable="true"],.notranslate')) return false;
    const text = node.nodeValue.trim();
    return text.length > 1 && /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
  };
  const collect = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (eligible(walker.currentNode)) nodes.push(walker.currentNode);
    return nodes;
  };
  async function translate() {
    if (busy || language !== 'en') return;
    busy = true;
    try {
      const nodes = collect(), pending = new Map();
      for (const node of nodes) {
        const original = node.nodeValue;
        if (node.__tonightOriginal === undefined) node.__tonightOriginal = original;
        const key = node.__tonightOriginal.trim();
        if (!key || cache[key]) { if (cache[key]) node.nodeValue = original.replace(key, cache[key]); continue; }
        if (!pending.has(key)) pending.set(key, []);
        pending.get(key).push(node);
      }
      const entries = [...pending.entries()];
      for (let i = 0; i < entries.length; i += 40) {
        const batch = entries.slice(i, i + 40);
        const response = await fetch('/api/translate/en', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({texts:batch.map(x=>x[0])}) });
        if (!response.ok) throw new Error('translation unavailable');
        const data = await response.json();
        batch.forEach(([source, refs], index) => {
          const translated = data.translations?.[index];
          if (!translated) return;
          cache[source] = translated;
          refs.forEach(node => { if (node.isConnected) node.nodeValue = node.__tonightOriginal.replace(source, translated); });
        });
      }
      try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch {}
    } catch (error) {
      console.warn('English translation could not be completed:', error);
      if (!document.querySelector('.language-setup-hint')) {
        const hint = document.createElement('div'); hint.className = 'language-setup-hint';
        hint.textContent = 'English translation is not configured yet.';
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 5000);
      }
    } finally { busy = false; }
  }
  function restore() {
    if (observer) observer.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.__tonightOriginal !== undefined) n.nodeValue = n.__tonightOriginal;
    }
    if (observer) observer.observe(document.body,{childList:true,subtree:true});
  }
  function setLanguage(next) {
    language = next; localStorage.setItem(KEY, next);
    document.documentElement.lang = next === 'en' ? 'en' : 'ja';
    window.dispatchEvent(new CustomEvent('tonight:languagechange', { detail: { language: next } }));
    const button = document.getElementById('tonightLanguageToggle');
    if (button) button.textContent = next === 'en' ? '日本語' : 'English';
    if (next === 'ja') restore(); else translate();
  }
  function mount() {
    const header = document.querySelector('.topbar');
    if (!header || document.getElementById('tonightLanguageToggle')) return;
    // Place the language control alongside the visitor header actions,
    // rather than as a separate flex item at the far edge of the topbar.
    const actionArea = header.querySelector('.top-actions') || header;
    const button = document.createElement('button');
    button.id = 'tonightLanguageToggle'; button.type='button'; button.className='language-toggle';
    button.setAttribute('aria-label','Switch language');
    button.setAttribute('title','Switch language');
    button.onclick = () => setLanguage(language === 'ja' ? 'en' : 'ja');
    actionArea.appendChild(button); setLanguage(language);
    observer = new MutationObserver(() => { if (language === 'en') translate(); });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
