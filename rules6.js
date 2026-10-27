// ロト7「6つの法則」の選出ロジック（ブラウザ・Node共通）
// ①軸数字 ②下一桁ペア ③引っ張り ④前後(±1) ⑤奇偶バランス ⑥位置ごとの範囲
(function (root) {
  const MAX = 37;
  const PICK = 7;
  const POS_RANGE = [
    [1, 15], [4, 20], [6, 24], [10, 28], [15, 29], [20, 34], [29, 37],
  ];
  const DEFAULTS = {
    useAxis: true,      // ①軸数字
    axisWindow: 50,     // 頻度を見る回数
    axisTop: 10,        // 上位何個を軸候補にするか
    axisMin: 1,         // 最低いくつ含めるか
    useDigit: true,     // ②下一桁ペア
    usePrev: true,      // ③引っ張り
    usePrev2: false,    // 前々回も対象にする
    prevMin: 1,
    useAdjacent: true,  // ④前後(±1)
    adjMin: 1,
    useOddEven: true,   // ⑤奇偶3:4か4:3
    usePos: true,       // ⑥位置ごとの範囲
    useConsec: true,    // ⑦連続数字を1組入れる
    useGold1: false,    // 黄金①直近24回で3〜4回の数字を3個
    useGold2: false,    // 黄金②前回数字を1〜2個
    useGold3: false,    // 黄金③前回数字の前後から連続1組だけ
    useGold4: false,    // 黄金④下一桁ペア
  };

  function analyze(draws, opt) {
    opt = Object.assign({}, DEFAULTS, opt || {});
    const win = draws.slice(0, opt.axisWindow);
    const counts = Array(MAX + 1).fill(0);
    for (const d of win) for (const n of d.main) counts[n]++;
    const axis = [...Array(MAX)].map((_, i) => i + 1)
      .sort((a, b) => counts[b] - counts[a] || a - b)
      .slice(0, opt.axisTop);
    const prevSet = new Set();
    if (draws[0]) draws[0].main.forEach((n) => prevSet.add(n));
    if (opt.usePrev2 && draws[1]) draws[1].main.forEach((n) => prevSet.add(n));
    const adjPool = new Set();
    if (draws[0]) for (const n of draws[0].main) {
      if (n - 1 >= 1) adjPool.add(n - 1);
      if (n + 1 <= MAX) adjPool.add(n + 1);
    }
    // 黄金法則用：直近24回で3〜4回の数字 / 前回数字の前後から作る連続の候補
    const hot24 = [];
    const c24 = Array(MAX + 1).fill(0);
    for (const d of draws.slice(0, 24)) for (const n of d.main) c24[n]++;
    for (let n = 1; n <= MAX; n++) if (c24[n] >= 3 && c24[n] <= 4) hot24.push(n);
    const pairKeys = new Set();
    if (draws[0]) for (const n of draws[0].main) {
      if (n - 1 >= 1) pairKeys.add(n - 1);
      if (n + 1 <= MAX) pairKeys.add(n);
    }
    return {
      opt, counts, axis,
      prevSet: [...prevSet],
      adjPool: [...adjPool],
      hot24,
      consecPairStarts: pairKeys,
      latest: draws[0] || null,
    };
  }

  function sameDigitGroups(nums) {
    const g = {};
    for (const n of nums) (g[n % 10] = g[n % 10] || []).push(n);
    return Object.values(g).filter((x) => x.length >= 2);
  }

  function check(nums, a) {
    const s = [...nums].sort((x, y) => x - y);
    const axisIn = s.filter((n) => a.axis.includes(n));
    const prevIn = s.filter((n) => a.prevSet.includes(n));
    const adjIn = s.filter((n) => a.adjPool.includes(n));
    const digit = sameDigitGroups(s);
    const consec = [];
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1] === s[i] + 1) consec.push([s[i], s[i + 1]]);
    const gold1In = s.filter((n) => a.hot24.includes(n));
    const odd = s.filter((n) => n % 2 === 1).length;
    const posOk = s.every((n, i) => n >= POS_RANGE[i][0] && n <= POS_RANGE[i][1]);
    const o = a.opt;
    const ok =
      (!o.useAxis || axisIn.length >= o.axisMin) &&
      (!o.useDigit || digit.length >= 1) &&
      (!o.usePrev || prevIn.length >= o.prevMin) &&
      (!o.useAdjacent || adjIn.length >= o.adjMin) &&
      (!o.useOddEven || (odd === 3 || odd === 4)) &&
      (!o.usePos || posOk) &&
      (!o.useConsec || consec.length >= 1) &&
      (!o.useGold1 || gold1In.length === Math.min(3, a.hot24.length)) &&
      (!o.useGold2 || (prevIn.length >= 1 && prevIn.length <= 2)) &&
      (!o.useGold3 || (consec.length === 1 && a.consecPairStarts.has(consec[0][0]))) &&
      (!o.useGold4 || digit.length >= 1);
    return { ok, axisIn, prevIn, adjIn, digit, odd, posOk, consec, gold1In };
  }

  function sample(arr, k, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  function makeOne(a, rng) {
    const o = a.opt;
    const s = new Set();
    if (o.useAxis && a.axis.length)
      sample(a.axis, Math.min(o.axisMin + 1, a.axis.length), rng).forEach((n) => s.add(n));
    if (o.usePrev && a.prevSet.length)
      sample(a.prevSet, rng() < 0.6 ? 1 : 2, rng).forEach((n) => s.add(n));
    if (o.useAdjacent && a.adjPool.length) {
      const rest = a.adjPool.filter((n) => !s.has(n));
      sample(rest, rng() < 0.6 ? 1 : 2, rng).forEach((n) => s.add(n));
    }
    if (o.useDigit) {
      const d = Math.floor(rng() * 10);
      const g = [];
      for (let n = d; n <= MAX; n += 10) if (n >= 1 && !s.has(n)) g.push(n);
      sample(g, 2, rng).forEach((n) => s.add(n));
    }
    if (s.size > PICK) return null;
    const pool = [];
    for (let n = 1; n <= MAX; n++) if (!s.has(n)) pool.push(n);
    sample(pool, PICK - s.size, rng).forEach((n) => s.add(n));
    if (s.size !== PICK) return null;
    return [...s].sort((x, y) => x - y);
  }

  function generate(drawsOrAnalysis, sets, opt, rng) {
    const a = drawsOrAnalysis.axis ? drawsOrAnalysis : analyze(drawsOrAnalysis, opt);
    rng = rng || Math.random;
    const out = [];
    const seen = new Set();
    for (let t = 0; t < 300000 && out.length < sets; t++) {
      const nums = makeOne(a, rng);
      if (!nums) continue;
      const key = nums.join(',');
      if (seen.has(key)) continue;
      const c = check(nums, a);
      if (!c.ok) continue;
      seen.add(key);
      out.push({ nums, ...c });
    }
    return out;
  }

  const api = { MAX, PICK, POS_RANGE, DEFAULTS, analyze, check, generate, makeOne, sameDigitGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Loto7Rules6 = api;
})(this);
