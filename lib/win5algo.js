// WIN5予想アルゴリズム（仕様書に基づく実装）
// 取れるデータ：馬番・人気・単勝オッズ・騎手・調教師・馬体重・芝ダ・距離・頭数・クラス・開催場・レース順
// 取れないデータ（JRA出馬表に無い）：前走クラス・脚質・上がり順位・距離変動・乗り替わり・馬場状態
const GOOD_JOCKEY = ['川田', 'M.デムーロ', 'デムーロ', 'C.ルメール', 'ルメール', 'D.レーン', 'レーン', 'モレイラ'];
const BAD_JOCKEY = ['岩田望', '横山武', '松山', '戸崎', '坂井'];
const GOOD_TRAINER = ['中内田', '木村', '黒岩', '野中', '田中博', '奥村'];
const BAD_TRAINER = ['友道', '杉山'];
const LOCAL = ['札幌', '函館', '福島', '新潟', '小倉', '中京'];

function zoneOf(pop) {
  if (pop === 1) return 'A';
  if (pop === 2) return 'B';
  if (pop <= 4) return 'C';
  if (pop <= 8) return 'D';
  return 'X';
}

// 判定A：1番人気の銀行/消去スコア
function bankScore(race) {
  const h = race.horses.find((x) => x.pop === 1);
  if (!h) return { score: -99, why: '1番人気なし' };
  const why = [];
  let s = 0;
  if (h.win <= 1.4) return { score: 99, why: `絶対銀行（オッズ${h.win}）`, horse: h };
  if (race.trackCondition === '不良') return { score: -99, why: '不良馬場で消去', horse: h };
  if (h.win >= 1.5 && h.win <= 2.9) { s += 2; why.push(`オッズ${h.win}`); }
  if (h.win >= 3.0) { s -= 3; why.push(`オッズ${h.win}で減点`); }
  if (GOOD_JOCKEY.some((j) => h.jockey.includes(j))) { s += 2; why.push(`騎手${h.jockey}`); }
  if (BAD_JOCKEY.some((j) => h.jockey.includes(j))) { s -= 2; why.push(`騎手${h.jockey}で減点`); }
  if (GOOD_TRAINER.some((j) => h.trainer.includes(j))) { s += 2; why.push(`厩舎${h.trainer}`); }
  if (BAD_TRAINER.some((j) => h.trainer.includes(j))) { s -= 2; why.push(`厩舎${h.trainer}で減点`); }
  if (race.raceClass && /3勝/.test(race.raceClass)) { s += 1; why.push('3勝クラス'); }
  if (['G1', 'GⅠ', 'G3', 'GⅢ'].includes(race.raceClass)) { s += 2; why.push(race.raceClass); }
  if (['G2', 'GⅡ', 'リステッド'].includes(race.raceClass)) { s -= 2; why.push(`${race.raceClass}で減点`); }
  if (['東京', '阪神', '京都'].includes(race.venue)) { s += 1; why.push(race.venue); }
  if (['小倉', '福島', '中山'].includes(race.venue)) { s -= 2; why.push(`${race.venue}で減点`); }
  if (race.venue === '新潟' && race.trackType === '芝' && race.distance === 1000) { s += 3; why.push('新潟芝1000直'); }
  if (h.weight != null && h.weight >= 540) { s += 2; why.push(`馬体${h.weight}kg`); }
  else if (h.weight != null && h.weight >= 520) { s += 1; why.push(`馬体${h.weight}kg`); }
  return { score: s, why: why.join('・') || '条件なし', horse: h };
}

// フェーズ3：馬番スコア（ゾーンC/Dの絞り込み用）
function umaScore(h, headCount) {
  let s = 0;
  const even = h.no % 2 === 0;
  if ([2, 4, 6].includes(h.no) && h.pop <= 8) s += 3;      // 内〜中枠偶数
  if ([13, 15, 17].includes(h.no) && h.pop <= 3) s += 3;   // 外枠奇数の上位人気
  if (even) s += 1;
  if (h.no === headCount) s += 1;                          // 大外
  if (headCount >= 14 && !even) { s -= 2; if (h.no === 1) s -= 1; }
  return s;
}

// 判定B：レース条件別の目標頭数とゾーン
function targetPicks(race) {
  const R = race.raceNo ? race : race;
  const ord = race.no;                 // WIN何レース目か
  const tt = race.trackType;
  const d = race.distance;
  const wide = ord === 3 || LOCAL.includes(race.venue) || race.handicap || /G|リステッド/.test(race.raceClass || '');
  const cap = (tt === 'ダート') ? 7 : 8;   // 消去域：芝9人気以下、ダート8人気以下

  let n, upto;
  if (ord === 1) { n = 2; upto = 2; }
  else if (tt === 'ダート' && d >= 1900) { n = 2; upto = 2; }
  else if (tt === 'ダート' && d === 1600 && race.venue === '東京') { n = 2; upto = 2; }
  else if (tt === 'ダート' && (d === 1200 || d === 1400)) { n = 4; upto = 4; }
  else if (tt === '芝' && d >= 2200) { n = 3; upto = 3; }
  else if (tt === '芝' && d === 1800) { n = null; upto = null; } // 特別：1番人気＋5・6番人気
  else if (tt === '芝' && [1400, 1600, 2000].includes(d)) { n = wide ? 4 : 3; upto = wide ? cap : 4; }
  else if (tt === '芝' && d === 1200) { n = wide ? 5 : 4; upto = cap; }
  else { n = wide ? 5 : 3; upto = Math.min(cap, wide ? cap : 4); }

  if (ord === 3) n = Math.max(n, 5);        // WIN3は4〜5頭
  if (tt === '芝' && d === 1800 && !wide) {
    return { list: ['A', 'D5', 'D6'], n: 3 };  // 1番人気＋5,6番人気
  }
  return { n, upto };
}

// レースの選出馬を決める
function selectHorses(race) {
  if (!race.horses || !race.horses.length) return { picks: [], why: 'オッズなし' };
  const cap = race.trackType === 'ダート' ? 7 : 8;
  const bank = bankScore(race);
  const cut = race.trackType === 'ダート' ? 7 : 8;

  if (bank.score >= 90) return { picks: [bank.horse], why: bank.why, mode: 'bank' };
  if (bank.score <= -90) {
    const rest = race.horses.filter((h) => h.pop <= cut && h.pop !== 1);
    return { picks: rest.slice(0, 3), why: `1番人気消去（${bank.why}）`, mode: 'cut1' };
  }
  if (bank.score >= 4) return { picks: [bank.horse], why: `銀行判定（${bank.why}）`, mode: 'bank' };

  // 判定B
  const t = targetPicks(race);
  let picked;
  if (t.list) {
    const pops = t.list.map((z) => z === 'A' ? 1 : z === 'B' ? 2 : z === 'C' ? [3, 4] : +z.slice(1)).flat();
    picked = race.horses.filter((h) => pops.includes(h.pop));
  } else {
    // 上位 n 頭をゾーン内スコアで選ぶ（1・2番人気は基本必須、残りをスコア順）
    const must = race.horses.filter((h) => h.pop <= 2 && h.pop <= cut);
    const others = race.horses.filter((h) => h.pop > 2 && h.pop <= cut)
      .map((h) => ({ h, s: umaScore(h, race.headCount || race.horses.length) }))
      .sort((a, b) => b.s - a.s || a.h.win - b.h.win)
      .map((x) => x.h);
    picked = must.concat(others).slice(0, Math.max(t.n, must.length));
    picked.sort((a, b) => a.pop - b.pop);
  }
  const marks = picked.map((h) => `${h.pop}人気${h.no}番`);
  return { picks: picked, why: `${bank.why} / ${marks.join('・')}`, mode: 'auto', bankScore: bank.score };
}

// フェーズ4：組み合わせフィルタ
function filterCombos(lists, strict = true) {
  const out = [];
  const idx = [0, 0, 0, 0, 0];
  while (true) {
    const pop = idx.map((v, i) => lists[i][v].pop);
    const S = pop.reduce((a, b) => a + b, 0);
    const fav1 = pop.filter((p) => p === 1).length;
    const top2 = pop.filter((p) => p <= 2).length;
    const mid = pop.filter((p) => p >= 6).length;
    const ok = S >= 13 && S <= 21 && fav1 >= 1 && fav1 <= 2 && top2 >= 2 && (!strict || mid >= 1);
    if (ok) out.push(idx.map((v, i) => lists[i][v].no).join('-'));
    for (let i = 4; i >= 0; i--) {
      if (++idx[i] < lists[i].length) break;
      idx[i] = 0;
      if (i === 0) return out;
    }
  }
  return out;
}

const _exp = { bankScore, umaScore, targetPicks, selectHorses, filterCombos, zoneOf };
if (typeof module !== 'undefined' && module.exports) module.exports = _exp;
else if (typeof window !== 'undefined') window.Win5Algo = _exp;
