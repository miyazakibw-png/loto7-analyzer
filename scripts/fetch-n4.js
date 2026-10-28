const fs = require('fs');
const { getDraws } = require('../lib/n4');
(async () => {
  const draws = await getDraws(120);
  const data = { source: 'loto-life.net（ナンバーズ4当選番号）', fetchedAt: new Date().toISOString(), draws };
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/numbers4.json', JSON.stringify(data));
  console.log(`numbers4.json: 第${draws[0].no}回まで ${draws.length}回分`);
})();
