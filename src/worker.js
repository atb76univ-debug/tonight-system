// /api/db: 全データの読み書き（回ごと・部分ごとに新しい方を採用してマージ）
// /api/flyer/<id>: フライヤー画像の保存と配信
function mergeBarTransactions(a = {}, b = {}) {
  const resetAt = Math.max(Number(a.resetAt || 0), Number(b.resetAt || 0));
  const voided = new Set([...(a.voidedSales || []), ...(b.voidedSales || [])]);
  const byId = new Map();
  [...(a.sales || []), ...(b.sales || [])].forEach(sale => {
    if (!sale?.id || Number(sale.timestamp || 0) <= resetAt || voided.has(sale.id)) return;
    if (!byId.has(sale.id)) byId.set(sale.id, sale);
  });
  return {
    sales: [...byId.values()].sort((x, y) => Number(y.timestamp || 0) - Number(x.timestamp || 0)),
    resetAt,
    voidedSales: [...voided]
  };
}

function mergeInto(t, s) {
  t.events = t.events || [];
  for (const e of (s.events || [])) {
    const o = t.events.find(x => x.id === e.id);
    if (!o) { t.events.push(e); continue; }
    o.u = o.u || {};
    const eu = e.u || {};
    if ((eu.meta || 0) > (o.u.meta || 0)) {
      for (const k of ['name', 'date', 'flyer', 'archived', 'deleted']) o[k] = e[k];
      o.u.meta = eu.meta;
    }
    if ((eu.rec || 0) > (o.u.rec || 0)) { o.state = e.state; o.u.rec = eu.rec; }
    const mergedBarTransactions = mergeBarTransactions(o.bar || {}, e.bar || {});
    if ((eu.bar || 0) > (o.u.bar || 0)) { o.bar = e.bar; o.u.bar = eu.bar; }
    o.bar = o.bar || {};
    o.bar.sales = mergedBarTransactions.sales;
    o.bar.resetAt = mergedBarTransactions.resetAt;
    o.bar.voidedSales = mergedBarTransactions.voidedSales;
    if ((eu.tt || 0) > (o.u.tt || 0)) { o.tt = e.tt; o.u.tt = eu.tt; }
  }
  return t;
}

export class Store {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === '/db') {
      const cur = (await this.state.storage.get('db')) || { events: [] };
      if (req.method === 'PUT') {
        let inc;
        try { inc = await req.json(); } catch { return new Response('bad', { status: 400 }); }
        if (!inc || !Array.isArray(inc.events)) return new Response('bad', { status: 400 });
        mergeInto(cur, inc);
        cur.updated = Date.now();
        await this.state.storage.put('db', cur);
      }
      return Response.json(cur);
    }
    const m = path.match(/^\/flyer\/([A-Za-z0-9]+)$/);
    if (m) {
      const key = 'fl:' + m[1];
      if (req.method === 'PUT') {
        const buf = await req.arrayBuffer();
        if (!buf.byteLength || buf.byteLength > 1500000) return new Response('too large', { status: 413 });
        await this.state.storage.put(key, buf);
        return Response.json({ ok: true });
      }
      const buf = await this.state.storage.get(key);
      if (!buf) return new Response('not found', { status: 404 });
      return new Response(buf, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    return new Response('not found', { status: 404 });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/db' || url.pathname.startsWith('/api/flyer/')) {
      const stub = env.STORE.get(env.STORE.idFromName('main'));
      const inner = new Request('https://do' + url.pathname.replace('/api', ''), req);
      const res = await stub.fetch(inner);
      if (url.pathname === '/api/db') {
        return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
      return res;
    }
    return env.ASSETS.fetch(req);
  },
};
