(function () {
  const VERSION = '0.1.0';
  const CACHE_KEY = 'n4-draws';
  const LAW_KEY = 'n4-laws';
  const SAVED_KEY = 'n4-saved';
  const R = window.Num4Rules;
  const $ = (id) => document.getElementById(id);
  let draws = null;
  let lastResults = null;

  $('ver').textContent = VERSION;

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  }

  function readOpt() {
    return {
      useSum: $('lawSum').checked,
      useAvoid: $('lawAvoid').checked,
      patterns: {
        '4-0': $('pat40').checked, '3-1': $('pat31').checked,
        '2-2': $('pat22').checked, '1-3': $('pat13').checked,
        '0-4': $('pat04').checked,
      },
    };
  }

  function saveOpt() {
    try { localStorage.setItem(LAW_KEY, JSON.stringify(readOpt())); } catch (e) {}
  }

  function restoreOpt() {
    try {
      const o = JSON.parse(localStorage.getItem(LAW_KEY));
      if (!o) return;
      if ('useSum' in o) $('lawSum').checked = !!o.useSum;
      if ('useAvoid' in o) $('lawAvoid').checked = !!o.useAvoid;
      if (o.patterns) {
        $('pat40').checked = !!o.patterns['4-0'];
        $('pat31').checked = !!o.patterns['3-1'];
        $('pat22').checked = !!o.patterns['2-2'];
        $('pat13').checked = !!o.patterns['1-3'];
        $('pat04').checked = !!o.patterns['0-4'];
      }
    } catch (e) {}
  }

  ['lawSum', 'lawAvoid', 'pat40', 'pat31', 'pat22', 'pat13', 'pat04'].forEach((id) => {
    $(id).addEventListener('change', () => { saveOpt(); updateMatchCount(); });
  });

  let cand = null;
  function updateMatchCount() {
    if (!draws) return;
    cand = R.candidates(readOpt());
    $('matchCount').textContent = `条件に合う組み合わせ：${cand.length}通り`;
    const top = $('topList');
    top.innerHTML = cand.slice(0, 60).map((c) => `<span class="n4">${c.num}<i>★${c.score}</i></span>`).join('');
    $('btnMake').disabled = !cand.length;
  }

  function numRow(num, ds) {
    const row = document.createElement('span');
    row.className = 'n4set';
    ds.forEach((d, i) => {
      const c = document.createElement('span');
      c.className = 'n4d' + (R.HOT[i].includes(d) ? ' hot' : '');
      c.textContent = d;
      row.appendChild(c);
    });
    return row;
  }

  function render(data) {
    draws = data.draws;
    const last = draws[0];
    $('status').textContent = `第${last.no}回（${fmtDate(last.date)}）まで取り込み済み`;
    $('prevLabel').textContent = `第${last.no}回 ${fmtDate(last.date)}`;
    $('prevNum').textContent = last.num;

    const tb = $('histTable').querySelector('tbody');
    tb.innerHTML = '';
    draws.slice(0, 30).forEach((d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.no}</td><td>${d.date || ''}</td><td>${d.num}</td>`;
      tb.appendChild(tr);
    });

    ['secPrev', 'secLaws', 'secMake', 'secHist'].forEach((id) => ($(id).hidden = false));
    updateMatchCount();
    renderSaved();
  }

  function make() {
    if (!cand || !cand.length) return;
    const sets = +$('sets').value;
    const g = R.generate(readOpt(), sets);
    lastResults = g.list;
    const box = $('results');
    box.innerHTML = '';
    g.list.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'set';
      const head = document.createElement('div');
      head.className = 'head';
      head.innerHTML = `<span>${i + 1}通り目</span><span class="score">★${r.score}</span>`;
      wrap.appendChild(head);
      const row = numRow(r.num, r.ds);
      const why = document.createElement('span');
      why.className = 'muted hitLabel';
      why.textContent = `合計${r.sum}・偶数${r.evens}/奇数${4 - r.evens}`;
      wrap.appendChild(row);
      wrap.appendChild(why);
      box.appendChild(wrap);
    });
    $('nextNo').textContent = draws[0].no + 1;
    $('saveRow').hidden = false;
  }

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
      div.innerHTML = `<div class="head"><span>第${sv.drawNo}回の予想${draw ? ` → ${draw.num}（${draw.date || ''}）` : '（結果待ち）'}</span><button class="del" data-i="${idx}">消す</button></div>`;
      sv.sets.forEach((num) => {
        const ds = num.split('').map(Number);
        const row = document.createElement('div');
        row.className = 'balls';
        ds.forEach((d, i) => {
          const c = document.createElement('span');
          c.className = 'n4d';
          if (draw && d === +draw.num[i]) c.classList.add('hit');
          c.textContent = d;
          row.appendChild(c);
        });
        const r = document.createElement('span');
        r.className = 'muted hitLabel';
        r.textContent = draw ? ` ${num === draw.num ? '完全一致！' : ds.filter((d, i) => d === +draw.num[i]).length + '桁一致'}` : '';
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
    if (!lastResults || !draws) return;
    const l = savedList();
    l.unshift({
      drawNo: draws[0].no + 1,
      savedAt: new Date().toISOString().slice(0, 10),
      sets: lastResults.map((r) => r.num),
    });
    localStorage.setItem(SAVED_KEY, JSON.stringify(l));
    renderSaved();
  });

  async function fetchDraws() {
    const btn = $('btnFetch');
    btn.disabled = true;
    $('status').textContent = '取り込み中…';
    try {
      const res = await fetch('data/numbers4.json?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (!data.draws) throw new Error(res.status);
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

  restoreOpt();
  $('btnFetch').addEventListener('click', fetchDraws);
  $('btnMake').addEventListener('click', make);

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) render(JSON.parse(cached));
  fetchDraws();
})();
