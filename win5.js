(function () {
  const $ = (id) => document.getElementById(id);
  const CACHE_KEY = 'win5-cache-v1';
  const PICKS_KEY = 'win5-picks-v2';
  let data = null;
  let picks = ['auto', 'auto', 'auto', 'auto', 'auto']; // 各レースの選び方
  const A = window.Win5Algo;

  function savedPicks() {
    try { const p = JSON.parse(localStorage.getItem(PICKS_KEY)); if (Array.isArray(p) && p.length === 5) picks = p; } catch (e) {}
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // 各レースの選出馬（auto→アルゴリズム、数値→上からN頭）
  function racePicks(r, i) {
    if (!r.horses || !r.horses.length) return { picks: [], why: '' };
    if (picks[i] === 'auto') return A.selectHorses(r);
    const n = +picks[i];
    return { picks: r.horses.slice(0, n), why: '' };
  }

  function render(d) {
    data = d;
    const dt = d.date ? d.date.replace(/-/g, '/') : '';
    $('dateLabel').textContent = `${dt} 締切${d.deadline || '—'}（取り込み：${(d.fetchedAt || '').slice(0, 16).replace('T', ' ')}）`;
    $('win5Info').innerHTML = d.races.map((r, i) => {
      const head = `<div class="raceHead">${r.no}レース目　<strong>${esc(r.venue)}${r.raceNo}R</strong>${r.name ? ` ${esc(r.name)}` : ''}${r.postTime ? ` <small>${esc(r.postTime)}</small>` : ''}</div>`;
      const meta = r.trackType ? `<div class="memo">${r.trackType}${r.distance || ''}m${r.raceClass ? ` ${esc(r.raceClass)}` : ''}</div>` : '';
      if (!r.horses || !r.horses.length) {
        return `<div class="race">${head}${meta}<p class="memo">まだオッズが出ていません</p></div>`;
      }
      const sel = racePicks(r, i);
      const chosen = new Set(sel.picks.map((h) => h.no));
      const rows = r.horses.slice(0, 8).map((h) =>
        `<tr class="${chosen.has(h.no) ? 'sel' : ''}"><td class="pop">${h.pop}</td><td class="uma">${h.no}</td><td>${esc(h.name)}</td><td class="od">${h.win.toFixed(1)}</td><td>${esc(h.jockey || '')}</td></tr>`).join('');
      const why = sel.why ? `<p class="memo">${esc(sel.why)}</p>` : '';
      return `<div class="race">${head}${meta}<table class="horses"><thead><tr><th>人気</th><th>馬番</th><th>馬名</th><th>単勝</th><th>騎手</th></tr></thead><tbody>${rows}</tbody></table>${why}</div>`;
    }).join('');

    $('pickArea').innerHTML = d.races.map((r, i) => {
      if (!r.horses || !r.horses.length) return '';
      const opts = `<option value="auto"${picks[i] === 'auto' ? ' selected' : ''}>自動（法則）</option>` +
        [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${picks[i] === n ? ' selected' : ''}>上から${n}頭</option>`).join('');
      return `<div class="pickRow"><span>${r.no}レース目（${esc(r.venue)}${r.raceNo}R）</span><select data-r="${i}">${opts}</select></div>`;
    }).join('') || '<p class="memo">オッズが出たら選べます</p>';

    $('pickArea').querySelectorAll('select').forEach((s) => {
      s.addEventListener('change', () => {
        picks[+s.dataset.r] = s.value === 'auto' ? 'auto' : +s.value;
        localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
        render(data);
      });
    });
    updatePoints();
  }

  function currentLists() {
    return data.races.map((r, i) => racePicks(r, i).picks);
  }

  function updatePoints() {
    if (!data) return;
    const lists = currentLists();
    const n = lists.reduce((x, l) => x * Math.max(l.length, 1), 1);
    const ok = lists.every((l) => l.length > 0);
    $('points').textContent = ok ? `${n}点（${(n * 100).toLocaleString()}円分）` : '';
    return ok ? lists : null;
  }

  function makeCombos() {
    const lists = updatePoints();
    if (!lists) return;
    const total = lists.reduce((x, l) => x * l.length, 1);
    let out = A.filterCombos(lists, true);
    let note = '（人気の和13〜21・1番人気1〜2個・1・2番人気2頭以上・6番人気以下1頭以上）';
    if (!out.length) {
      out = A.filterCombos(lists, false);
      note = '（条件に合う組がなかったので、6番人気以下の条件だけ外しています）';
    }
    const cap = 600;
    const shown = out.slice(0, cap);
    $('comboList').innerHTML =
      `<p class="memo">全部で${total}点 → 条件に合うもの ${out.length}点${note}${shown.length < out.length ? `（先頭${shown.length}点を表示）` : ''}</p>` +
      '<ol class="combos">' + shown.map((c) => `<li>${c.replace(/-/g, ' - ')}</li>`).join('') + '</ol>';
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
