const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/rules.js');
const { parseDrawCsv, warekiToIso } = require('../server.js');

function fakeDraws(seed) {
  let s = seed;
  const rng = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const draws = [];
  for (let i = 0; i < 30; i++) {
    const set = new Set();
    while (set.size < 7) set.add(1 + Math.floor(rng() * 37));
    draws.push({ no: 700 - i, date: '2026-10-23', main: [...set].sort((a, b) => a - b), bonus: [1, 2] });
  }
  return draws;
}

test('analyze counts only the last 24 draws', () => {
  const draws = fakeDraws(1);
  const a = R.analyze(draws);
  assert.strictEqual(a.counts.reduce((x, y) => x + y, 0), 24 * 7);
  assert.deepStrictEqual(a.prev, draws[0].main);
  for (const n of a.hot) assert.ok(a.counts[n] >= 3 && a.counts[n] <= 4);
});

test('consecutive candidates are neighbours of the previous numbers', () => {
  const a = R.analyze([{ no: 1, main: [1, 5, 6, 20, 30, 36, 37], bonus: [2, 3] }]);
  assert.deepStrictEqual(a.consecPairs.map((p) => p.join('-')), ['1-2', '4-5', '5-6', '6-7', '19-20', '20-21', '29-30', '30-31', '35-36', '36-37']);
});

test('every generated set satisfies all four rules', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const a = R.analyze(fakeDraws(seed));
    const list = R.generate(a, 10);
    assert.ok(list.length > 0, `seed ${seed}`);
    for (const r of list) {
      assert.strictEqual(r.nums.length, 7);
      assert.strictEqual(new Set(r.nums).size, 7);
      assert.strictEqual(r.hotIn.length, Math.min(3, a.hot.length));
      assert.ok(r.prevIn.length >= 1 && r.prevIn.length <= 2);
      assert.strictEqual(r.adj.length, 1);
      assert.ok(a.consecPairs.some((p) => p[0] === r.adj[0][0]));
      assert.ok(r.digit.length >= 1);
    }
  }
});

test('parses a Mizuho CSV', () => {
  const csv = 'A53\r\n第０７００回ロト７,数字選択式全国自治宝くじ,令和8年10月23日,東京 宝くじドリーム館\r\n支払期間,x\r\n本数字,02,03,08,12,21,25,26,ボーナス数字,13,34\r\n';
  assert.deepStrictEqual(parseDrawCsv(csv), { no: 700, date: '2026-10-23', main: [2, 3, 8, 12, 21, 25, 26], bonus: [13, 34] });
  assert.strictEqual(warekiToIso('令和元年5月1日'), '2019-05-01');
});
