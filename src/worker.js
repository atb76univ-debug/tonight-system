// /api/db: 全データの読み書き（回ごと・部分ごとに新しい方を採用してマージ）
// /api/flyer/<id>: フライヤー画像の保存と配信
const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function mergeBarTransactions(a = {}, b = {}) {
  const resetAt = Math.max(Number(a.resetAt || 0), Number(b.resetAt || 0));
  const voided = new Set([...(a.voidedSales || []), ...(b.voidedSales || [])]);
  const deletedMap = new Map();

  [...(a.deletedSales || []), ...(b.deletedSales || [])].forEach(item => {
    if (!item?.sale?.id || Number(item.deletedAt || 0) < Date.now() - DELETION_RETENTION_MS) return;
    const previous = deletedMap.get(item.sale.id);
    const itemVersion = Math.max(Number(item.deletedAt || 0), Number(item.restoredAt || 0));
    const previousVersion = previous ? Math.max(Number(previous.deletedAt || 0), Number(previous.restoredAt || 0)) : -1;
    if (itemVersion > previousVersion) deletedMap.set(item.sale.id, structuredClone(item));
  });

  for (const [id, item] of deletedMap) {
    if (Number(item.restoredAt || 0) > Number(item.deletedAt || 0)) voided.delete(id);
    else voided.add(id);
  }

  const byId = new Map();
  [...(a.sales || []), ...(b.sales || [])].forEach(sale => {
    if (!sale?.id || Number(sale.timestamp || 0) <= resetAt || voided.has(sale.id)) return;
    if (!byId.has(sale.id)) byId.set(sale.id, structuredClone(sale));
  });

  return {
    sales: [...byId.values()].sort((x, y) => Number(y.timestamp || 0) - Number(x.timestamp || 0)),
    resetAt,
    voidedSales: [...voided],
    deletedSales: [...deletedMap.values()].sort((x, y) => Number(y.deletedAt || 0) - Number(x.deletedAt || 0))
  };
}

function mergeInto(target, source) {
  target.events = Array.isArray(target.events) ? target.events : [];

  if (Number(source.membersUpdated || 0) > Number(target.membersUpdated || 0)) {
    target.members = structuredClone(Array.isArray(source.members) ? source.members : []);
    target.membersUpdated = Number(source.membersUpdated || 0);
  }
  if (Number(source.drinkLineupUpdated || 0) > Number(target.drinkLineupUpdated || 0)) {
    target.drinkLineup = structuredClone(Array.isArray(source.drinkLineup) ? source.drinkLineup : []);
    target.drinkLineupUpdated = Number(source.drinkLineupUpdated || 0);
  }

  for (const incoming of (Array.isArray(source.events) ? source.events : [])) {
    if (!incoming?.id) continue;
    const existing = target.events.find(event => event.id === incoming.id);
    if (!existing) {
      target.events.push(structuredClone(incoming));
      continue;
    }

    existing.u = existing.u || {};
    const versions = incoming.u || {};

    if (Number(versions.meta || 0) > Number(existing.u.meta || 0)) {
      for (const key of ['name', 'date', 'flyer', 'archived', 'deleted', 'participants']) {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) existing[key] = structuredClone(incoming[key]);
      }
      existing.u.meta = Number(versions.meta || 0);
    }
    if (Number(versions.rec || 0) > Number(existing.u.rec || 0)) {
      existing.state = structuredClone(incoming.state || {});
      existing.u.rec = Number(versions.rec || 0);
    }

    const mergedTransactions = mergeBarTransactions(existing.bar || {}, incoming.bar || {});
    if (Number(versions.bar || 0) > Number(existing.u.bar || 0)) {
      existing.bar = structuredClone(incoming.bar || {});
      existing.u.bar = Number(versions.bar || 0);
    }
    existing.bar = existing.bar || {};
    existing.bar.sales = mergedTransactions.sales;
    existing.bar.resetAt = mergedTransactions.resetAt;
    existing.bar.voidedSales = mergedTransactions.voidedSales;
    existing.bar.deletedSales = mergedTransactions.deletedSales;

    if (Number(versions.tt || 0) > Number(existing.u.tt || 0)) {
      existing.tt = structuredClone(incoming.tt || { acts: [], shifts: [], offsetMinutes: 0 });
      existing.u.tt = Number(versions.tt || 0);
    }
  }
  return target;
}

export class Store {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === '/db') {
      const current = (await this.state.storage.get('db')) || { events: [], members: [], membersUpdated: 0, drinkLineup: [], drinkLineupUpdated: 0 };
      if (req.method === 'PUT') {
        let incoming;
        try { incoming = await req.json(); }
        catch { return new Response('bad', { status: 400 }); }
        if (!incoming || !Array.isArray(incoming.events)) return new Response('bad', { status: 400 });
        mergeInto(current, incoming);
        current.updated = Date.now();
        await this.state.storage.put('db', current);
      }
      return Response.json(current);
    }

    const match = path.match(/^\/flyer\/([A-Za-z0-9]+)$/);
    if (match) {
      const key = 'fl:' + match[1];
      if (req.method === 'PUT') {
        const buffer = await req.arrayBuffer();
        if (!buffer.byteLength || buffer.byteLength > 1500000) return new Response('too large', { status: 413 });
        await this.state.storage.put(key, buffer);
        return Response.json({ ok: true });
      }
      const buffer = await this.state.storage.get(key);
      if (!buffer) return new Response('not found', { status: 404 });
      return new Response(buffer, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    return new Response('not found', { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/db' || url.pathname.startsWith('/api/flyer/')) {
      const stub = env.STORE.get(env.STORE.idFromName('main'));
      const inner = new Request('https://do' + url.pathname.replace('/api', ''), request);
      const response = await stub.fetch(inner);
      if (url.pathname === '/api/db') {
        return new Response(response.body, {
          status: response.status,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }
      return response;
    }
    return env.ASSETS.fetch(request);
  }
};
