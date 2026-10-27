const LOTOLIFE_CSV = 'https://loto-life.net/datasets/loto7.csv';
const MIZUHO_BASE = 'https://www.mizuhobank.co.jp';
const MIZUHO_CSV_DIR = '/retail/takarakuji/loto/loto7/csv/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'ja,en;q=0.8',
  'Referer': MIZUHO_BASE + '/takarakuji/check/loto/loto7/index.html',
};

async function fetchText(url, charset, headers) {
  const res = await fetch(url, { headers: headers || HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new TextDecoder(charset).decode(await res.arrayBuffer());
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

async function getDrawsLotoLife(count) {
  const text = await fetchText(LOTOLIFE_CSV + '?t=' + Date.now(), 'shift_jis', { 'User-Agent': HEADERS['User-Agent'] });
  const rows = text.trim().split(/\r?\n/).slice(1);
  const draws = rows.map((r) => {
    const c = r.split(',');
    return { no: +c[0], date: c[1], main: c.slice(2, 9).map(Number), bonus: [+c[9], +c[10]] };
  }).filter((d) => d.no > 0 && d.main.length === 7);
  if (!draws.length) throw new Error('loto-lifeのデータが読めません');
  return draws.slice(-count).reverse();
}

async function getDrawsMizuho(count) {
  const idx = toHalfWidth(await fetchText(MIZUHO_BASE + MIZUHO_CSV_DIR + 'loto7.csv?' + Date.now(), 'shift_jis'));
  const nos = [...idx.matchAll(/第0*(\d+)回ロト7/g)].map((m) => +m[1]);
  if (!nos.length) throw new Error('回号の一覧が読めません');
  const latest = Math.max(...nos);
  const want = [];
  for (let n = latest; n > latest - count && n > 0; n--) want.push(n);
  const draws = [];
  for (let i = 0; i < want.length; i += 5) {
    draws.push(...(await Promise.all(want.slice(i, i + 5).map(async (no) => {
      const file = 'A103' + String(no).padStart(4, '0') + '.CSV';
      const draw = parseDrawCsv(await fetchText(MIZUHO_BASE + MIZUHO_CSV_DIR + file + '?' + Date.now(), 'shift_jis'));
      if (!draw) throw new Error(`第${no}回のデータが読めません`);
      return draw;
    }))));
  }
  return draws;
}

async function getDraws(count) {
  try {
    return await getDrawsLotoLife(count);
  } catch (e) {
    console.warn('loto-life失敗、みずほに切替:', e.message);
    return getDrawsMizuho(count);
  }
}

module.exports = { getDraws, getDrawsLotoLife, getDrawsMizuho, parseDrawCsv, warekiToIso, toHalfWidth };
