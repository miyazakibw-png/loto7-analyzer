(function (root) {
  const MAX = 37;
  const PICK = 7;
  const RECENT = 24;

  function analyze(draws) {
    const recent = draws.slice(0, RECENT);
    const counts = Array(MAX + 1).fill(0);
    for (const d of recent) for (const n of d.main) counts[n]++;
    const hot = [];
    for (let n = 1; n <= MAX; n++) if (counts[n] >= 3 && counts[n] <= 4) hot.push(n);
    const prev = draws[0] ? draws[0].main.slice() : [];
    const pairKeys = new Set();
    for (const n of prev) {
      if (n - 1 >= 1) pairKeys.add(n - 1);
      if (n + 1 <= MAX) pairKeys.add(n);
    }
    const consecPairs = [...pairKeys].sort((a, b) => a - b).map((a) => [a, a + 1]);
    return { recentCount: recent.length, counts, hot, prev, consecPairs, latest: draws[0] || null };
  }

  function adjacentPairs(nums) {
    const s = new Set(nums);
    const pairs = [];
    for (const n of nums) if (s.has(n + 1)) pairs.push([n, n + 1]);
    return pairs;
  }

  function sameDigitPairs(nums) {
    const groups = {};
    for (const n of nums) (groups[n % 10] = groups[n % 10] || []).push(n);
    return Object.values(groups).filter((g) => g.length >= 2);
  }

  function check(nums, a) {
    const hotSet = new Set(a.hot);
    const prevSet = new Set(a.prev);
    const hotIn = nums.filter((n) => hotSet.has(n));
    const prevIn = nums.filter((n) => prevSet.has(n));
    const adj = adjacentPairs(nums);
    const digit = sameDigitPairs(nums);
    const consecOk = adj.length === 1 && a.consecPairs.some((p) => p[0] === adj[0][0]);
    return {
      ok: hotIn.length === Math.min(3, a.hot.length) && prevIn.length >= 1 && prevIn.length <= 2 && consecOk && digit.length >= 1,
      hotIn, prevIn, adj, digit,
    };
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
    const s = new Set();
    sample(a.hot, 3, rng).forEach((n) => s.add(n));
    sample(a.prev, rng() < 0.5 ? 1 : 2, rng).forEach((n) => s.add(n));
    if (a.consecPairs.length) sample(a.consecPairs, 1, rng)[0].forEach((n) => s.add(n));
    if (s.size > PICK) return null;
    const hotSet = new Set(a.hot);
    const prevSet = new Set(a.prev);
    const pool = [];
    for (let n = 1; n <= MAX; n++) if (!s.has(n) && !hotSet.has(n) && !prevSet.has(n)) pool.push(n);
    sample(pool, PICK - s.size, rng).forEach((n) => s.add(n));
    if (s.size !== PICK) return null;
    return [...s].sort((x, y) => x - y);
  }

  function generate(a, sets, rng) {
    rng = rng || Math.random;
    const out = [];
    const seen = new Set();
    for (let tries = 0; tries < 200000 && out.length < sets; tries++) {
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

  const api = { MAX, PICK, RECENT, analyze, check, generate, adjacentPairs, sameDigitPairs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Loto7Rules = api;
})(this);
