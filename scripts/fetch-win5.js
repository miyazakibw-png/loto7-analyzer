const fs = require('fs');
const path = require('path');
const { getWin5, getNextWin5 } = require('../lib/win5');

(async () => {
  // 試験用：環境変数で日付と対象レースを固定できる
  const forced = process.env.WIN5_DATE;
  const [y, m, d] = forced ? forced.split('-') : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).split('-');
  const today = `${y}-${m}-${d}`;

  let entry;
  if (forced && process.env.WIN5_RACES) {
    entry = { dateISO: today, deadline: '—', races: JSON.parse(process.env.WIN5_RACES) };
  } else {
    entry = await getNextWin5(today);
  }
  if (!entry) { console.log('次回のWIN5が見つかりません'); return; }

  const data = await getWin5(entry.dateISO.replace(/-/g, ''), entry.races);
  const out = {
    source: 'JRAホームページ（WIN5対象レース・オッズ）',
    fetchedAt: new Date().toISOString(),
    date: entry.dateISO,
    deadline: entry.deadline,
    oddsReady: data.oddsReady,
    races: data.races,
  };
  const file = path.join(__dirname, '..', 'data', 'win5.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`win5.json: ${entry.dateISO} ${data.oddsReady ? 'オッズあり' : 'オッズ未発売'} / ${data.races.map((r) => r.venue + r.raceNo + 'R').join('・')}`);
})().catch((e) => { console.error(e); process.exit(1); });
