import { createLaporanBridgeHandler } from '../server/laporan-bridge.js';

const handle = createLaporanBridgeHandler();

export default async function handler(req, res) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {}))
    if (value !== undefined)
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);

  const url = `https://internal.invalid${req.url || '/api/laporan-bridge'}`;
  const init = { method: req.method, headers };

  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    init.body = Buffer.concat(chunks).toString();
  }

  const request = new Request(url, init);
  const response = await handle(request, process.env);

  res.statusCode = response.status;
  for (const [key, value] of response.headers) res.setHeader(key, value);
  res.end(await response.text());
}
