(function () {
  const VERSION = '0.3.0';
  const CACHE_KEY = 'loto7-draws';
  const LAW_KEY = 'loto7-laws';
  const SAVED_KEY = 'loto7-saved';
  const R = window.Loto7Rules;
  const R6 = window.Loto7Rules6;
  const $ = (id) => document.getElementById(id);
  let analysis = null;
  let analysis6 = null;
  let draws = null;
  let lastResults = null;

  $('ver').textContent = VERSION;

  function ball(n, cls) {
    const el = document.createElement('span');
    el.className = 'ball' + (cls ? ' ' + cls : '');
    el.textContent = String(n).padStart(2, '0');
    return el;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  }

  // --- 6法則の設定 ---
  function readLawOpt() {
    return {
      useAxis: $('lawAxis').checked,
      axisWindow: +$('axisWindow').value,
      axisTop: +$('axisTop').value,
      axisMin: +$('axisMin').value,
      useDigit: $('lawDigit').checked,
      usePrev: $('lawPrev').checked,
      prevMin: +$('prevMin').value,
      usePrev2: $('lawPrev2').checked,
      useAdjacent: $('lawAdj').checked,
      adjMin: +$('adjMin').value,
      useOddEven: $('lawOddEven').checked,
      usePos: $('lawPos').checked,
      useConsec: $('lawConsec').checked,
      useGold1: $('lawGold1').checked,
      useGold2: $('lawGold2').checked,
      useGold3: $('lawGold3').checked,
      useGold4: $('lawGold4').checked,
    };
  }

  function saveLawOpt() {
    try { localStorage.setItem(LAW_KEY, JSON.stringify(readLawOpt())); } catch (e) {}
  }

  function restoreLawOpt() {
    try {
      const o = JSON.parse(localStorage.getItem(LAW_KEY));
      if (!o) return;
      const map = {
        lawAxis: 'useAxis', lawDigit: 'useDigit', lawPrev: 'usePrev',
        lawPrev2: 'usePrev2', lawAdj: 'useAdjacent', lawOddEven: 'useOddEven', lawPos: 'usePos', lawConsec: 'useConsec', lawGold1: 'useGold1', lawGold2: 'useGold2', lawGold3: 'useGold3', lawGold4: 'useGold4',
      };
      for (const [id, k] of Object.entries(map)) if (k in o) $(id).checked = !!o[k];
      for (const [id, k] of Object.entries({ axisWindow: 'axisWindow', axisTop: 'axisTop', axisMin: 'axisMin', prevMin: 'prevMin', adjMin: 'adjMin' }))
        if (k in o) $(id).value = String(o[k]);
    } catch (e) {}
  }

  ['lawAxis', 'lawDigit', 'lawPrev', 'lawPrev2', 'lawAdj', 'lawOddEven', 'lawPos',
    'axisWindow', 'axisTop', 'axisMin', 'prevMin', 'adjMin', 'lawConsec', 'lawGold1', 'lawGold2', 'lawGold3', 'lawGold4'].forEach((id) => {
    $(id).addEventListener('change', () => {
      saveLawOpt();
      if (draws) analysis6 = R6.analyze(draws, readLawOpt());
      updateLegend();
    });
  });

  function updateLegend() {
    $('legend').innerHTML =
      '<span><i class="tag hot"></i>軸・黄金①</span>' +
      '<span><i class="tag digit"></i>下一桁ペア</span>' +
      '<span><i class="tag prev"></i>引っ張り</span>' +
      '<span><i class="tag consec"></i>前後±1・連続</span>' +
      '<span>奇偶・位置は全体の条件</span>';
    $('secLaws').hidden = !analysis;
  }

  // --- 表示 ---
  function render(data) {
    draws = data.draws;
    analysis = R.analyze(draws);
    analysis6 = R6.analyze(draws, readLawOpt());
    const a = analysis;
    const last = a.latest;
    $('status').textContent = `第${last.no}回（${fmtDate(last.date)}）まで取り込み済み`;

    $('prevLabel').textContent = `第${last.no}回 ${fmtDate(last.date)}`;
    const pb = $('prevBalls');
    pb.innerHTML = '';
    last.main.forEach((n) => pb.appendChild(ball(n)));
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = 'ボーナス';
    pb.appendChild(sep);
    last.bonus.forEach((n) => pb.appendChild(ball(n, 'bonus')));

    $('rangeLabel').textContent = `第${draws[Math.min(R.RECENT, draws.length) - 1].no}〜${last.no}回`;
    $('hotList').textContent = a.hot.length ? a.hot.join('・') : 'なし';
    const g = $('countGrid');
    g.innerHTML = '';
    for (let n = 1; n <= R.MAX; n++) {
      const c = document.createElement('div');
      c.className = 'cell' + (a.hot.includes(n) ? ' hot' : '');
      c.innerHTML = `<b>${n}</b>${a.counts[n]}回`;
      g.appendChild(c);
    }

    const cl = $('consecList');
    cl.innerHTML = '';
    a.consecPairs.forEach((p) => {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = `${p[0]}-${p[1]}`;
      cl.appendChild(s);
    });

    const tb = $('histTable').querySelector('tbody');
    tb.innerHTML = '';
    draws.slice(0, R.RECENT).forEach((d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.no}</td><td>${d.date || ''}</td><td>${d.main.join(' ')}</td><td>${d.bonus.join(' ')}</td>`;
      tb.appendChild(tr);
    });

    ['secPrev', 'secMake', 'secRule1', 'secRule3', 'secHist'].forEach((id) => ($(id).hidden = false));
    updateLegend();
    renderSaved();
  }

  function addMarks(b, r, n) {
    const marks = document.createElement('span');
    marks.className = 'marks';
    if (r.axisIn.includes(n) || r.gold1In.includes(n)) marks.innerHTML += '<i class="tag hot"></i>';
    if (r.prevIn.includes(n)) marks.innerHTML += '<i class="tag prev"></i>';
    if (r.adjIn.includes(n) || new Set(r.consec.flat()).has(n)) marks.innerHTML += '<i class="tag consec"></i>';
    if (new Set(r.digit.flat()).has(n)) marks.innerHTML += '<i class="tag digit"></i>';
    b.appendChild(marks);
  }

  function make() {
    if (!analysis) return;
    const sets = +$('sets').value;
    const list = R6.generate(analysis6, sets);
    lastResults = { list };
    const box = $('results');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="err">条件に合う組み合わせが見つかりませんでした。法則の設定をゆるめてみてください。</p>';
      $('saveRow').hidden = true;
      return;
    }
    list.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'set';
      wrap.innerHTML = `<div class="head"><span>${i + 1}通り目</span></div>`;
      const balls = document.createElement('div');
      balls.className = 'balls';
      r.nums.forEach((n) => {
        const b = ball(n);
        addMarks(b, r, n);
        balls.appendChild(b);
      });
      wrap.appendChild(balls);
      const why = document.createElement('div');
      why.className = 'why';
      const even = r.nums.length - r.odd;
      why.innerHTML = [
        `①軸：${r.axisIn.map((n) => `${n}（${analysis6.counts[n]}回）`).join('・') || 'なし'}`,
        `②下一桁ペア：${r.digit.map((g) => g.join('と')).join('・') || 'なし'}`,
        `③引っ張り：${r.prevIn.join('・') || 'なし'}`,
        `④前後±1：${r.adjIn.join('・') || 'なし'}`,
        `⑤奇偶：奇数${r.odd}・偶数${even}　⑥位置の範囲：${r.posOk ? '範囲内' : '範囲外'}　⑦連続：${r.consec.map((p) => p.join('-')).join('・') || 'なし'}`,
        `黄金①3〜4回：${r.gold1In.join('・') || 'なし'}`,
      ].join('<br>');
      wrap.appendChild(why);
      box.appendChild(wrap);
    });
    $('nextNo').textContent = analysis.latest.no + 1;
    $('saveRow').hidden = false;
  }

  // --- 保存した予想と答え合わせ ---
  function savedList() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { return []; }
  }

  function renderSaved() {
    const list = savedList();
    $('secSaved').hidden = !list.length;
    const box = $('savedList');
    box.innerHTML = '';
    list.forEach((sv, idx) => {
      const div = document.createElement('div');
      div.className = 'set';
      const draw = draws && draws.find((d) => d.no === sv.drawNo);
      const headTxt = draw
        ? `第${sv.drawNo}回の予想 → ${draw.main.join(' ')}（${draw.date || ''}）`
        : `第${sv.drawNo}回の予想（結果待ち）`;
      div.innerHTML = `<div class="head"><span>${headTxt}</span><button class="del" data-i="${idx}">消す</button></div>`;
      sv.sets.forEach((nums, i) => {
        const row = document.createElement('div');
        row.className = 'balls';
        const hit = draw ? nums.filter((n) => draw.main.includes(n)) : [];
        const bhit = draw ? nums.filter((n) => draw.bonus.includes(n)) : [];
        nums.forEach((n) => {
          const b = ball(n);
          if (hit.includes(n)) b.classList.add('hit');
          if (bhit.includes(n)) b.classList.add('bhit');
          row.appendChild(b);
        });
        const r = document.createElement('span');
        r.className = 'muted hitLabel';
        r.textContent = draw ? ` ${hit.length}個一致${bhit.length ? `＋ボーナス${bhit.length}` : ''}` : '';
        row.appendChild(r);
        div.appendChild(row);
      });
      box.appendChild(div);
    });
    box.querySelectorAll('button.del').forEach((b) => {
      b.addEventListener('click', () => {
        const l = savedList();
        l.splice(+b.dataset.i, 1);
        localStorage.setItem(SAVED_KEY, JSON.stringify(l));
        renderSaved();
      });
    });
  }

  $('btnSave').addEventListener('click', () => {
    if (!lastResults || !analysis) return;
    const l = savedList();
    l.unshift({
      drawNo: analysis.latest.no + 1,
      savedAt: new Date().toISOString().slice(0, 10),
      sets: lastResults.list.map((r) => r.nums),
    });
    localStorage.setItem(SAVED_KEY, JSON.stringify(l));
    renderSaved();
  });

  async function fetchDraws() {
    const btn = $('btnFetch');
    btn.disabled = true;
    $('status').textContent = '取り込み中…';
    try {
      let res = await fetch('data/draws.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) res = await fetch('api/draws?count=30', { cache: 'no-store' });
      const data = await res.json();
      if (!data.draws) throw new Error(data.error || res.status);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      render(data);
    } catch (e) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) render(JSON.parse(cached));
      $('status').innerHTML = `<span class="err">取り込めませんでした（${e.message}）。</span>` + (cached ? '前回取り込んだ分で表示しています。' : '');
    } finally {
      btn.disabled = false;
    }
  }

  restoreLawOpt();
  $('btnFetch').addEventListener('click', fetchDraws);
  $('btnMake').addEventListener('click', make);

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) render(JSON.parse(cached));
  fetchDraws();
})();
