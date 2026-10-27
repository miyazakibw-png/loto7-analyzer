(function () {
  const $ = (id) => document.getElementById(id);
  const CACHE_KEY = 'win5-cache-v1';
  const PICKS_KEY = 'win5-picks-v1';
  let data = null;
  let picks = [1, 1, 1, 1, 1]; // 各レースで使う頭数

  function savedPicks() {
    try { const p = JSON.parse(localStorage.getItem(PICKS_KEY)); if (Array.isArray(p) && p.length === 5) picks = p; } catch (e) {}
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function render(d) {
    data = d;
    const dt = d.date ? d.date.replace(/-/g, '/') : '';
    $('dateLabel').textContent = `${dt} 締切${d.deadline || '—'}（取り込み：${(d.fetchedAt || '').slice(0, 16).replace('T', ' ')}）`;
    $('win5Info').innerHTML = d.races.map((r) => {
      const head = `<div class="raceHead">${r.no}レース目　<strong>${esc(r.venue)}${r.raceNo}R</strong>${r.name ? ` ${esc(r.name)}` : ''}${r.postTime ? ` <small>${esc(r.postTime)}</small>` : ''}</div>`;
      if (!r.horses || !r.horses.length) {
        return `<div class="race">${head}<p class="memo">まだオッズが出ていません</p></div>`;
      }
      const rows = r.horses.slice(0, 8).map((h) =>
        `<tr class="${h.pop <= picks[r.no - 1] ? 'sel' : ''}"><td class="pop">${h.pop}</td><td class="uma">${h.no}</td><td>${esc(h.name)}</td><td class="od">${h.win.toFixed(1)}</td></tr>`).join('');
      return `<div class="race">${head}<table class="horses"><thead><tr><th>人気</th><th>馬番</th><th>馬名</th><th>単勝</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join('');

    $('pickArea').innerHTML = d.races.map((r) => {
      if (!r.horses || !r.horses.length) return '';
      const opts = [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${picks[r.no - 1] === n ? ' selected' : ''}>上から${n}頭</option>`).join('');
      return `<div class="pickRow"><span>${r.no}レース目（${esc(r.venue)}${r.raceNo}R）</span><select data-r="${r.no - 1}">${opts}</select></div>`;
    }).join('') || '<p class="memo">オッズが出たら選べます</p>';

    $('pickArea').querySelectorAll('select').forEach((s) => {
      s.addEventListener('change', () => {
        picks[+s.dataset.r] = +s.value;
        localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
        render(data);
      });
    });
    updatePoints();
  }

  function topPicks() {
    return data.races.map((r) => (r.horses || []).slice(0, picks[r.no - 1]).map((h) => h.no));
  }

  function updatePoints() {
    if (!data) return;
    const lists = topPicks();
    const n = lists.reduce((x, l) => x * Math.max(l.length, 1), 1);
    const ok = lists.every((l) => l.length > 0);
    $('points').textContent = ok ? `${n}点（${(n * 100).toLocaleString()}円分）` : '';
    return ok ? lists : null;
  }

  function makeCombos() {
    const lists = updatePoints();
    if (!lists) return;
    const total = lists.reduce((x, l) => x * l.length, 1);
    const cap = 600;
    const out = [];
    const idx = [0, 0, 0, 0, 0];
    outer:
    while (out.length < cap) {
      out.push(idx.map((v, i) => lists[i][v]).join(' - '));
      for (let i = 4; i >= 0; i--) {
        if (++idx[i] < lists[i].length) break;
        idx[i] = 0;
        if (i === 0) break outer;
      }
    }
    const selDesc = data.races.map((r, i) => `${r.no}レース${picks[i]}頭`).join('・');
    $('comboList').innerHTML =
      `<p class="memo">${selDesc}で${total}点${out.length < total ? `（先頭${out.length}点を表示）` : ''}</p>` +
      '<ol class="combos">' + out.map((c) => `<li>${c}</li>`).join('') + '</ol>';
  }

  async function fetchWin5() {
    const btn = $('btnFetch');
    btn.disabled = true;
    $('status').textContent = '読み込み中…';
    try {
      let res = await fetch('data/win5.json?t=' + Date.now(), { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok || !d.races) throw new Error(res.status);
      localStorage.setItem(CACHE_KEY, JSON.stringify(d));
      render(d);
      $('status').textContent = d.oddsReady
        ? `${d.date} の単勝オッズを表示しています`
        : `次回は ${d.date} です。オッズはまだ出ていません`;
    } catch (e) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) render(JSON.parse(cached));
      $('status').innerHTML = `<span class="err">読み込めませんでした。</span>` + (cached ? '前回の分で表示しています。' : '');
    } finally {
      btn.disabled = false;
    }
  }

  savedPicks();
  $('btnFetch').addEventListener('click', fetchWin5);
  $('btnMake').addEventListener('click', makeCombos);
  fetchWin5();
})();
