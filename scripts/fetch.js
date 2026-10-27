const fs = require('fs');
const path = require('path');
const { getDraws } = require('../lib/draws');

(async () => {
  const draws = await getDraws(40);
  const out = { source: 'ロト7当選番号データ（loto-life）', fetchedAt: new Date().toISOString(), draws };
  const file = path.join(__dirname, '..', 'data', 'draws.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`data/draws.json: 第${draws[0].no}回まで ${draws.length}回分`);
})().catch((e) => { console.error(e); process.exit(1); });
