(function () {
  const VERSION = '0.1.0';
  const CACHE_KEY = 'loto7-draws';
  const R = window.Loto7Rules;
  const $ = (id) => document.getElementById(id);
  let analysis = null;

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

  function render(data) {
    const draws = data.draws;
    analysis = R.analyze(draws);
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
  }

  function make() {
    if (!analysis) return;
    const sets = +$('sets').value;
    const list = R.generate(analysis, sets);
    const box = $('results');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="err">条件に合う組み合わせが見つかりませんでした。</p>';
      return;
    }
    list.forEach((r, i) => {
      const consec = new Set(r.adj.flat());
      const digit = new Set(r.digit.flat());
      const wrap = document.createElement('div');
      wrap.className = 'set';
      wrap.innerHTML = `<div class="head"><span>${i + 1}通り目</span></div>`;
      const balls = document.createElement('div');
      balls.className = 'balls';
      r.nums.forEach((n) => {
        const b = ball(n);
        const marks = document.createElement('span');
        marks.className = 'marks';
        if (r.hotIn.includes(n)) marks.innerHTML += '<i class="tag hot"></i>';
        if (r.prevIn.includes(n)) marks.innerHTML += '<i class="tag prev"></i>';
        if (consec.has(n)) marks.innerHTML += '<i class="tag consec"></i>';
        if (digit.has(n)) marks.innerHTML += '<i class="tag digit"></i>';
        b.appendChild(marks);
        balls.appendChild(b);
      });
      wrap.appendChild(balls);
      const why = document.createElement('div');
      why.className = 'why';
      why.innerHTML = [
        `①3〜4回：${r.hotIn.map((n) => `${n}（${analysis.counts[n]}回）`).join('・')}`,
        `②引っ張り：${r.prevIn.join('・')}`,
        `③連続：${r.adj.map((p) => p.join('-')).join('・')}`,
        `④下一桁ペア：${r.digit.map((g) => g.join('と')).join('・')}`,
      ].join('<br>');
      wrap.appendChild(why);
      box.appendChild(wrap);
    });
  }

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

  $('btnFetch').addEventListener('click', fetchDraws);
  $('btnMake').addEventListener('click', make);

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) render(JSON.parse(cached));
  fetchDraws();
})();
