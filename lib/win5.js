// JRA WIN5：対象レース一覧と単勝オッズの取り込み
const JRA = 'https://www.jra.go.jp';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'ja,en;q=0.8',
  'Referer': JRA + '/keiba/odds/',
};
const JYO_CODE = { '札幌': '01', '函館': '02', '福島': '03', '新潟': '04', '東京': '05', '中山': '06', '中京': '07', '京都': '08', '阪神': '09', '小倉': '10' };

async function fetchSjis(url, body) {
  const opt = { headers: HEADERS, signal: AbortSignal.timeout(15000) };
  if (body) {
    opt.method = 'POST';
    opt.headers = { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' };
    opt.body = body;
  }
  const res = await fetch(url, opt);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new TextDecoder('shift_jis').decode(await res.arrayBuffer());
}

function stripTags(s) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

// WIN5対象レース一覧 → [{date, dateJp, deadline, races:[{venue, raceNo}]}]
function parseWin5List(html) {
  const t = stripTags(html);
  const re = /(\d{1,2})月(\d{1,2})日\s*（([^）]*)）\s*(\d+)時(\d+)分\s*((?:[^\s　]+?\d+R\s*){5})/g;
  const out = [];
  let m;
  while ((m = re.exec(t))) {
    const rText = m[6];
    const races = [...rText.matchAll(/(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)(\d+)R/g)]
      .map((r, i) => ({ no: i + 1, venue: r[1], raceNo: +r[2] }));
    if (races.length !== 5) continue;
    out.push({
      month: +m[1], day: +m[2], dayOfWeek: m[3],
      deadline: `${m[4]}時${m[5]}分`,
      races,
    });
  }
  return out;
}

// オッズ開催選択ページ → 開催日ごとのレース一覧CNAME
// {date:'20261024', venues:{'05':'pw15orl10...'}}
function parseOddsIndex(html) {
  const out = {};
  for (const m of html.matchAll(/pw15orl10(\d{2})(\d{4})\d{4}(\d{8})\/[0-9A-F]{2}/g)) {
    const [, jyo, , date] = m;
    (out[date] = out[date] || {})[jyo] = m[0];
  }
  return out;
}

// 開催日ページ → レース番号ごとの単勝オッズCNAME
function parseDayPage(html) {
  const out = {};
  for (const m of html.matchAll(/pw151ou10\d{2}\d{4}\d{4}(\d{2})\d{8}Z\/[0-9A-F]{2}/g)) {
    out[+m[1]] = m[0];
  }
  return out;
}

// 単勝オッズページ → レース情報と馬リスト
function parseOddsPage(html) {
  const t = stripTags(html);
  const name = (t.match(/発走時刻：\s*\d+時\d+分\s*第?\d*回?\s*(.+?)\s+(?:\d歳|馬齢|２歳|コース)/) || [])[1];
  const postTime = (t.match(/発走時刻：\s*(\d+時\d+分)/) || [])[1];
  const horses = [];
  // 馬番・馬名・単勝・複勝・性齢・馬体重… の行
  for (const m of html.matchAll(/<tr[^>]*>\s*<td[^>]*>[\s\S]*?<\/tr>/g)) {
    const cells = [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripTags(c[1]).trim());
    if (cells.length < 4) continue;
    const umaban = +cells[0];
    const win = parseFloat(cells[2]);
    if (!umaban || umaban > 28 || !cells[1] || isNaN(win)) continue;
    horses.push({ no: umaban, name: cells[1].replace(/\s+/g, ''), win });
  }
  horses.sort((a, b) => a.win - b.win || a.no - b.no);
  horses.forEach((h, i) => (h.pop = i + 1));
  return { name: (name || '').trim(), postTime, horses };
}

async function postCname(cname) {
  return fetchSjis(JRA + '/JRADB/accessO.html', 'cname=' + encodeURIComponent(cname));
}

// 指定日のWIN5 5レースをオッズ付きで取る
async function getWin5(dateYYYYMMDD, win5Races) {
  const indexHtml = await postCname('pw15oli00/6D');
  const index = parseOddsIndex(indexHtml);
  const days = index[dateYYYYMMDD];
  if (!days) return { oddsReady: false, races: win5Races };

  const races = [];
  const dayCache = {};
  for (const r of win5Races) {
    const jyo = JYO_CODE[r.venue];
    if (!jyo || !days[jyo]) { races.push({ ...r, horses: [] }); continue; }
    if (!dayCache[jyo]) dayCache[jyo] = parseDayPage(await postCname(days[jyo]));
    const cname = dayCache[jyo][r.raceNo];
    if (!cname) { races.push({ ...r, horses: [] }); continue; }
    const info = parseOddsPage(await postCname(cname));
    races.push({ ...r, name: info.name, postTime: info.postTime, horses: info.horses });
  }
  return { oddsReady: races.some((r) => (r.horses || []).length > 0), races };
}

// 次回のWIN5開催を対象一覧から決める（発売締切が未来の最も近い日、なければ次の日）
async function getNextWin5(todayISO) {
  const html = await fetchSjis(JRA + '/kouza/win5/info/racelist.html');
  const list = parseWin5List(html);
  const [y, mo, d] = todayISO.split('-').map(Number);
  const entries = list.map((e) => ({
    ...e,
    dateISO: `${y}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
  })).filter((e) => e.dateISO >= todayISO);
  return entries[0] || null;
}

module.exports = { parseWin5List, parseOddsIndex, parseDayPage, parseOddsPage, getWin5, getNextWin5, JYO_CODE };
