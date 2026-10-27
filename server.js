const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const BASE = 'https://www.mizuhobank.co.jp';
const CSV_DIR = '/retail/takarakuji/loto/loto7/csv/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'ja,en;q=0.8',
  'Referer': BASE + '/takarakuji/check/loto/loto7/index.html',
};
const INDEX_TTL_MS = 10 * 60 * 1000;
const drawCache = new Map();
let indexCache = { at: 0, latest: 0 };

async function fetchSjis(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new TextDecoder('shift_jis').decode(await res.arrayBuffer());
}

function toHalfWidth(s) {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function warekiToIso(s) {
  const m = s.match(/(令和|平成)(\d+|元)年(\d+)月(\d+)日/);
  if (!m) return null;
  const y = (m[2] === '元' ? 1 : +m[2]) + (m[1] === '令和' ? 2018 : 1988);
  return `${y}-${String(m[3]).padStart(2, '0')}-${String(m[4]).padStart(2, '0')}`;
}

function parseDrawCsv(text) {
  const t = toHalfWidth(text);
  const head = t.match(/第0*(\d+)回ロト7,[^,]*,([^,\r\n]+)/);
  const nums = t.match(/本数字,([\d,]+?),ボーナス数字,(\d+),(\d+)/);
  if (!head || !nums) return null;
  const main = nums[1].split(',').map(Number);
  if (main.length !== 7) return null;
  return { no: +head[1], date: warekiToIso(head[2]), main, bonus: [+nums[2], +nums[3]] };
}

async function latestDrawNo() {
  if (Date.now() - indexCache.at < INDEX_TTL_MS && indexCache.latest) return indexCache.latest;
  const text = toHalfWidth(await fetchSjis(BASE + CSV_DIR + 'loto7.csv?' + Date.now()));
  const nos = [...text.matchAll(/第0*(\d+)回ロト7/g)].map((m) => +m[1]);
  if (!nos.length) throw new Error('回号の一覧が読めません');
  indexCache = { at: Date.now(), latest: Math.max(...nos) };
  return indexCache.latest;
}

async function getDraw(no) {
  if (drawCache.has(no)) return drawCache.get(no);
  const file = 'A103' + String(no).padStart(4, '0') + '.CSV';
  const draw = parseDrawCsv(await fetchSjis(BASE + CSV_DIR + file + '?' + Date.now()));
  if (!draw) throw new Error(`第${no}回のデータが読めません`);
  drawCache.set(no, draw);
  return draw;
}

async function getDraws(count) {
  const latest = await latestDrawNo();
  const nos = [];
  for (let n = latest; n > latest - count && n > 0; n--) nos.push(n);
  const draws = [];
  for (let i = 0; i < nos.length; i += 5) {
    draws.push(...(await Promise.all(nos.slice(i, i + 5).map(getDraw))));
  }
  return draws;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PUBLIC = path.join(__dirname, 'public');

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
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
module.exports = { parseDrawCsv, warekiToIso };
