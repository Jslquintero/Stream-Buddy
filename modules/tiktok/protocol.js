import { gunzipSync } from 'node:zlib';

// Minimal wire reader: only the public Webcast fields needed by this app.
// Unknown fields are skipped; identifiers stay BigInt/string (never rounded).
export function fields(bytes = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 8 * 1024 * 1024) throw new Error('Trama inválida');
  let offset = 0;
  const result = new Map();
  const uint = () => {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (offset >= bytes.length) throw new Error('Trama incompleta');
      const byte = bytes[offset++]; value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) return value;
    }
    throw new Error('Varint inválido');
  };
  while (offset < bytes.length) {
    const tag = Number(uint()), key = tag >>> 3, wire = tag & 7;
    if (!key) throw new Error('Campo inválido');
    let value;
    if (wire === 0) value = uint();
    else if ([1, 2, 5].includes(wire)) {
      const length = wire === 2 ? Number(uint()) : wire === 1 ? 8 : 4;
      if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length) throw new Error('Longitud inválida');
      value = bytes.subarray(offset, offset + length); offset += length;
    } else throw new Error('Tipo de campo no compatible');
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(value);
  }
  return result;
}
const raw = (map, key) => map.get(key)?.[0];
const text = (map, key) => Buffer.isBuffer(raw(map, key)) ? raw(map, key).toString('utf8') : '';
const number = (map, key) => typeof raw(map, key) === 'bigint' ? Number(raw(map, key)) : 0;
const id = (map, key) => typeof raw(map, key) === 'bigint' ? String(raw(map, key)) : '';
const nested = (map, key) => fields(Buffer.isBuffer(raw(map, key)) ? raw(map, key) : undefined);
function user(map) {
  return { userId: id(map, 1), user: (text(map, 38) || text(map, 3) || id(map, 1) || 'usuario').slice(0, 80), avatar: text(nested(map, 9), 1) };
}
export function decodeEvent(method, bytes, messageId = '') {
  const data = fields(bytes), common = nested(data, 1);
  const base = { messageId: messageId || id(common, 2), createdAt: number(common, 4) * 1000 };
  if (method === 'WebcastChatMessage') {
    const content = text(data, 3);
    return content ? { ...base, kind: 'comment', ...user(nested(data, 2)), text: content.slice(0, 2000) } : null;
  }
  if (method === 'WebcastLikeMessage') {
    const count = number(data, 2), sender = user(nested(data, 5));
    return count > 0 && sender.userId ? { ...base, kind: 'like', ...sender, count } : null;
  }
  if (method === 'WebcastSocialMessage') {
    const action = number(data, 4);
    const kind = action === 1 ? 'follow' : action === 3 ? 'share' : null;
    return kind ? { ...base, kind, ...user(nested(data, 2)) } : null;
  }
  if (method === 'WebcastGiftMessage') {
    const gift = nested(data, 15);
    if (number(gift, 11) === 1 && number(data, 9) !== 1) return null;
    const count = Math.max(1, number(data, 5));
    return { ...base, kind: 'gift', ...user(nested(data, 7)), gift: (text(gift, 16) || 'Regalo').slice(0, 80), count, diamonds: Math.max(0, number(gift, 12)) * count };
  }
  if (method === 'WebcastBarrageMessage') {
    const content = nested(data, 5), fallback = nested(data, 24);
    const key = [text(content, 1), text(fallback, 1), text(nested(common, 8), 1)].join(' ');
    if (!/ttlive_superfan/i.test(key) || key.includes('ttlive_superfan_commentnotif_superfanjoined')) return null;
    let sender = nested(data, 50);
    if (!sender.size) {
      const pieces = content.get(4) || fallback.get(4) || [];
      for (const piece of pieces) { const candidate = nested(nested(fields(piece), 21), 1); if (candidate.size) { sender = candidate; break; } }
    }
    return sender.size ? { ...base, kind: 'superfan', ...user(sender) } : null;
  }
  if (method === 'WebcastControlMessage' && [3, 4].includes(number(data, 2))) return { ...base, kind: 'ended' };
  return null;
}
export function decodeFrame(bytes) {
  const frame = fields(bytes);
  const payload = raw(frame, 8);
  if (!Buffer.isBuffer(payload) || !['msg', ''].includes(text(frame, 7))) return [];
  const body = payload[0] === 31 && payload[1] === 139 ? gunzipSync(payload, { maxOutputLength: 8 * 1024 * 1024 }) : payload;
  const response = fields(body), events = [];
  for (const entry of response.get(1) || []) {
    const envelope = fields(entry);
    if (number(envelope, 6)) continue; // History must not trigger commands or alerts.
    const method = text(envelope, 1), content = raw(envelope, 2);
    if (!Buffer.isBuffer(content)) continue;
    try { const event = decodeEvent(method, content, id(envelope, 3)); if (event) events.push(event); } catch { /* A malformed event must not discard the remaining batch. */ }
  }
  return events;
}
