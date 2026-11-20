import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenorImage, resolveCommandImages } from '../modules/commands/tenor.js';
const page = 'https://tenor.com/view/twerking-aatrox-aatrox-gif-2074425090421168839';
const gif = 'https://media1.tenor.com/m/HMnWoQO2GscAAAAC/twerking-aatrox-aatrox.gif';
test('Tenor pages resolve the animated content URL, while direct files stay unchanged', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response(`<meta property="og:image" content="https://media1.tenor.com/preview.gif"><meta itemprop="contentUrl" content="${gif}">`); };
  const result = await resolveCommandImages({ commands: [{ image: page }, { image: page }, { image: gif }] }, fetcher);
  assert.deepEqual(result.commands.map(row => row.image), [gif, gif, gif]); assert.equal(calls, 1);
  for (const value of ['https://tenor.com.evil.test/view/a-123', 'https://example.com/a.gif', '']) assert.equal(await resolveTenorImage(value, fetcher), value);
  assert.equal(calls, 1);
});
test('Tenor errors and invalid extracted URLs do not silently save broken images', async () => {
  for (const html of ['', '<meta property="og:image" content="http://127.0.0.1/a.gif">', '<meta property="og:image" content="https://media1.tenor.com.evil.test/a.gif">']) await assert.rejects(resolveTenorImage(page, async () => new Response(html)), /No se encontró/);
  await assert.rejects(resolveTenorImage(page, async () => new Response('', { status: 404 })), /Tenor/);
});
