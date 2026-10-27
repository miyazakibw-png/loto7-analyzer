const BASE = 'https://www.mizuhobank.co.jp';
const CSV_DIR = '/retail/takarakuji/loto/loto7/csv/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'ja,en;q=0.8',
  'Referer': BASE + '/takarakuji/check/loto/loto7/index.html',
};

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

async function getDraws(count) {
  const idx = toHalfWidth(await fetchSjis(BASE + CSV_DIR + 'loto7.csv?' + Date.now()));
  const nos = [...idx.matchAll(/第0*(\d+)回ロト7/g)].map((m) => +m[1]);
  if (!nos.length) throw new Error('回号の一覧が読めません');
  const latest = Math.max(...nos);
  const want = [];
  for (let n = latest; n > latest - count && n > 0; n--) want.push(n);
  const draws = [];
  for (let i = 0; i < want.length; i += 5) {
    draws.push(...(await Promise.all(want.slice(i, i + 5).map(async (no) => {
      const file = 'A103' + String(no).padStart(4, '0') + '.CSV';
      const draw = parseDrawCsv(await fetchSjis(BASE + CSV_DIR + file + '?' + Date.now()));
      if (!draw) throw new Error(`第${no}回のデータが読めません`);
      return draw;
    }))));
  }
  return draws;
}

module.exports = { getDraws, parseDrawCsv, warekiToIso, toHalfWidth };
