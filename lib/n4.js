// ナンバーズ4の当選番号をloto-life.netのCSVから取る
const URL = 'https://loto-life.net/datasets/numbers4.csv';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0' };

async function getDraws(count) {
  const res = await fetch(URL + '?t=' + Date.now(), { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${URL}`);
  const text = new TextDecoder('shift_jis').decode(await res.arrayBuffer());
  const rows = text.trim().split(/\r?\n/).slice(1);
  const draws = rows.map((r) => {
    const c = r.split(',');
    return { no: +c[0], date: c[1], num: String(c[2] || '').trim().padStart(4, '0') };
  }).filter((d) => d.no > 0 && /^\d{4}$/.test(d.num));
  if (!draws.length) throw new Error('numbers4のCSVが読めません');
  return draws.slice(-count).reverse();
}
module.exports = { getDraws };
