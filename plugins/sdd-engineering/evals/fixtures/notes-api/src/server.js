import { createServer } from 'node:http';
import { createNote, getNote, listNotes, ValidationError } from './notes.js';

const send = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const readJson = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/notes') return send(res, 200, listNotes());
    if (req.method === 'POST' && url.pathname === '/notes') return send(res, 201, createNote(await readJson(req)));
    const match = /^\/notes\/(\d+)$/.exec(url.pathname);
    if (req.method === 'GET' && match) {
      const note = getNote(Number(match[1]));
      return note ? send(res, 200, note) : send(res, 404, { error: 'note not found' });
    }
    send(res, 404, { error: 'route not found' });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof SyntaxError) return send(res, 400, { error: err.message });
    send(res, 500, { error: 'internal error' });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) server.listen(3000);
