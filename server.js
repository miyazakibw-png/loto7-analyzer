const http = require('http');
const fs = require('fs');
const path = require('path');
const { getDraws } = require('./lib/draws');

const PORT = process.env.PORT || 8080;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ROOT = __dirname;

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/draws') {
    const count = Math.min(Math.max(+url.searchParams.get('count') || 30, 1), 60);
    try {
      const draws = await getDraws(count);
      send(res, 200, JSON.stringify({ source: 'みずほ銀行 当せん番号案内', fetchedAt: new Date().toISOString(), draws }), MIME['.json']);
    } catch (e) {
      send(res, 502, JSON.stringify({ error: String(e.message || e) }), MIME['.json']);
    }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
module.exports = {};
