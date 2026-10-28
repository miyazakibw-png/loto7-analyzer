// ナンバーズ4 選出ルール（ブラウザ・Node共通）
// ①合計10〜26 ②奇偶バランス ③各桁のよく出る数字スコア ④桁別の避ける数字
(function (root) {
  const HOT = [
    [6, 2, 8, 3, 0],   // 千の位
    [9, 3, 5, 1, 7],   // 百の位
    [9, 0, 8, 7, 5],   // 十の位
    [9, 1, 5, 2, 8],   // 一の位
  ];
  const AVOID = [[6], [0], [6], [7]]; // 千・百・十・一
  const DEFAULTS = {
    useSum: true,       // ①合計10〜26
    patterns: { '2-2': true, '1-3': true, '3-1': false, '4-0': false, '0-4': false }, // 偶-奇
    useAvoid: true,     // ④避ける数字を外す
  };

  function digits(num) { return num.split('').map(Number); }
  function sum(ds) { return ds.reduce((a, b) => a + b, 0); }
  function evens(ds) { return ds.filter((d) => d % 2 === 0).length; }
  function score(ds) {
    let s = 0;
    ds.forEach((d, i) => { if (HOT[i].includes(d)) s++; });
    return s;
  }
  function hasAvoid(ds) { return ds.some((d, i) => AVOID[i].includes(d)); }

  function check(num, opt) {
    const ds = digits(num);
    const S = sum(ds);
    const ev = evens(ds);
    const odd = 4 - ev;
    const patOk = !!opt.patterns[`${ev}-${odd}`];
    const avoid = hasAvoid(ds);
    const ok =
      (!opt.useSum || (S >= 10 && S <= 26)) &&
      patOk &&
      (!opt.useAvoid || !avoid);
    return { ok, ds, sum: S, evens: ev, score: score(ds), avoided: avoid };
  }

  // 条件に合う全組み合わせ（スコア順）
  function candidates(opt) {
    const out = [];
    for (let n = 0; n <= 9999; n++) {
      const num = String(n).padStart(4, '0');
      const c = check(num, opt);
      if (c.ok) out.push({ num, ...c });
    }
    out.sort((a, b) => b.score - a.score || a.num.localeCompare(b.num));
    return out;
  }

  function generate(opt, sets, rng) {
    rng = rng || Math.random;
    const list = candidates(opt);
    const out = [];
    const seen = new Set();
    for (let t = 0; t < 100000 && out.length < sets && list.length; t++) {
      const c = list[Math.floor(rng() * list.length)];
      if (seen.has(c.num)) continue;
      seen.add(c.num);
      out.push(c);
    }
    out.sort((a, b) => b.score - a.score);
    return { list: out, total: list.length };
  }

  const api = { HOT, AVOID, DEFAULTS, digits, sum, score, check, candidates, generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Num4Rules = api;
})(this);
