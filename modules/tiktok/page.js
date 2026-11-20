// Runs in the TikTok page; returns only readiness, never cookies or tokens.
export function chatInputState(focus = false) {
  const visible = node => node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
  const selectors = [
    '[data-e2e="room-chat-input-field"][contenteditable="plaintext-only"]',
    '[data-e2e="room-chat-input-field"][contenteditable="true"]',
    '[data-e2e="room-chat-input-field"] [contenteditable="true"]',
    '[data-e2e="chat-input"] [contenteditable="true"]',
    '[data-e2e="chat-input-container"] [contenteditable="true"]',
    '[data-e2e="comment-input"] [contenteditable="true"]',
    '[data-e2e="chat-input"][contenteditable="true"]',
    '[data-e2e="comment-input"][contenteditable="true"]',
    '.public-DraftEditor-content[contenteditable="true"]',
    'textarea[data-e2e="chat-input"]',
    'textarea[data-e2e="comment-input"]',
    '[role="textbox"][contenteditable="true"]',
  ];
  const input = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(node => visible(node) && !node.disabled && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true');
  if (!input) return { available: false, draft: false };
  const draft = !!(input.value ?? input.innerText ?? input.textContent ?? '').trim();
  if (focus && !draft) input.focus();
  return { available: true, draft, focused: document.activeElement === input };
}

export function isLivePage(value, username) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.tiktok.com', 'tiktok.com'].includes(url.hostname) && url.pathname.replace(/\/$/, '').toLowerCase() === '/@' + username.toLowerCase() + '/live'; } catch { return false; }
}
export function isWebcastURL(value) {
  try { const url = new URL(value); return ['https:', 'wss:'].includes(url.protocol) && /(^|\.)(tiktok\.com|tiktokv\.com|tiktokv\.us)$/.test(url.hostname) && url.pathname.startsWith('/webcast/'); } catch { return false; }
}
