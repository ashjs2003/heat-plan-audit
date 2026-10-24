// Two pages, one hash route. #map[/view]: every county of the analysed states, coloured by the residents' gap (the best mix
// the same total plan budget could buy, minus every plan in force as written: state + county + city), from /api/map.
// #{fips}/{view}/{scope}: the Strategy Studio, one chart of every strategy at every threshold (each alone), the best mix of
// the strategies you switch on, the jurisdiction's own plans (★) and its earlier plans (☆ by year), on top of the plans it
// inherits. Reads /studio (precomputed) and /optimize (recomputed for your settings).
// Every number opens its sources (plan quote on its page, evidence row, assumption, or how it was computed).
const FAMILIES = ["Information & outreach", "Cool/warm spaces & water", "Energy & utilities", "Worker & activity rules",
  "Health system", "Housing & built environment", "Unhoused services", "System, governance & other"];
const VIEW_SHORT = { evidence: "Proven only", agnostic: "If untested work", optimistic: "Best case" };
const SCOPE_TEXT = { plan: "Plan's strategies", menu: "+ Other options", standing: "+ Long-term" };
const SCOPE_RANK = { plan: 0, menu: 1, standing: 2 };
const GROUP_TEXT = { Keep: "Keep · plan strategy, same threshold", Retime: "Retime · plan strategy, new threshold", Add: "Add · not in the plan", Drop: "Drop · plan strategy left out" };
const EPS = 0.05;                     // deaths averted / yr below this count as "no effect" (rug, grey stub)
const S = { j: null, view: null, scope: "menu", budget: 100, set: {}, open: new Set(), closed: new Set(), M: null, F: null, sel: null,
  st: {}, analyse: null, seq: 0, stack: [], allDots: false, hl: null, briefMore: new Set(), line: [], vint: [] };
const $ = (id) => document.getElementById(id);
const api = async (p, body) => {
  const r = await fetch(p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json();
};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const famColor = (f) => css(`--series-${FAMILIES.indexOf(f) + 1 || 8}`);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (y) => (y == null || isNaN(y) ? "–" : Math.abs(y) >= 10 ? Math.round(y).toLocaleString() : (Math.round(y * 10) / 10).toString());
const pct = (x) => (x == null ? "–" : x < 1 ? `${(Math.round(x * 10) / 10).toString()}%` : `${Math.round(x).toLocaleString()}%`);
const sign = (y) => (y > EPS ? "+" : y < -EPS ? "−" : "±") + fmt(Math.abs(y));

// ---------- source chips + drawer
function chip(cites, text) {
  const ids = [...new Set(cites || [])];
  if (!ids.length) return "";
  const asm = ids.filter((i) => i.startsWith("asm:")).length, calc = ids.filter((i) => i.startsWith("calc:")).length;
  const cls = asm ? "assumed" : calc === ids.length ? "calc" : "cited";
  const icon = cls === "assumed" ? "⚠" : cls === "calc" ? "ƒ" : "✓";
  const label = text ?? (cls === "calc" ? "how computed" : `${ids.length} source${ids.length === 1 ? "" : "s"}`);
  return `<button class="chip ${cls}" data-cites='${esc(JSON.stringify(ids))}' title="Open sources">${icon}${label ? " " + esc(label) : ""}</button>`;
}
const yours = () => `<span class="chip yours" title="You changed this strategy's threshold or coverage">✎ your setting</span>`;
document.addEventListener("click", (e) => {
  const c = e.target.closest(".chip[data-cites]");
  if (c) { e.stopPropagation(); openDrawer(JSON.parse(c.dataset.cites)); }
});
async function openDrawer(ids, push = true) {
  if (push) S.stack.push(ids);
  $("drawer").hidden = false; $("drawer-back").hidden = S.stack.length < 2;
  const body = $("drawer-body"); body.innerHTML = '<p class="muted">Loading sources…</p>';
  const recs = await Promise.all(ids.slice(0, 60).map((id) => api(`/api/source/${S.j}/${encodeURIComponent(id)}`).catch(() => ({ id, type: "missing" }))));
  const order = { calc: 0, plan: 1, evidence: 2, data: 3, assumption: 4, missing: 5 };
  recs.sort((a, b) => order[a.type] - order[b.type]);
  $("drawer-title").textContent = ids.length === 1 ? "Source" : `${ids.length} sources`;
  body.innerHTML = recs.map(renderSource).join("") + (ids.length > 60 ? `<p class="muted">Showing 60 of ${ids.length}.</p>` : "");
}
$("drawer-close").onclick = () => { $("drawer").hidden = true; S.stack = []; };
$("drawer-back").onclick = () => { S.stack.pop(); openDrawer(S.stack[S.stack.length - 1], false); };
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("drawer").hidden) $("drawer-close").click(); else if (!$("analyse").hidden) $("analyse-close").click();
});
function pageSnippet(r) {
  const t = r.page_text || ""; if (!r.match) return esc(t.slice(0, 900));
  const [a, b] = r.match, s = Math.max(0, a - 450), e = Math.min(t.length, b + 450);
  return (s > 0 ? "… " : "") + esc(t.slice(s, a)) + "<mark>" + esc(t.slice(a, b)) + "</mark>" + esc(t.slice(b, e)) + (e < t.length ? " …" : "");
}
function renderSource(r) {
  if (r.type === "plan") {
    const v = r.verified === true ? '<span class="badge">✓ verbatim on page</span>' : r.verified === false ? '<span class="badge">not verified</span>' : "";
    const what = r.question ? `<p><b>${esc(r.question)}</b><br>Answer: ${esc(JSON.stringify(r.value))}</p>` : `<p class="muted">${esc(r.record_id)} · supports: ${esc(r.supports)}</p>`;
    return `<div class="src"><div class="type">Plan text · ${esc(r.doc_id)} · p.${r.page} ${v}</div>${what}
      ${r.quote ? `<blockquote>“${esc(r.quote)}”</blockquote>` : '<p class="muted">The plan is silent on this (absence value, no quote).</p>'}
      ${r.page_text ? `<details><summary>Show page ${r.page} text</summary><div class="pagetext">${pageSnippet(r)}</div></details>` : ""}
      ${r.pdf_url ? `<p><a href="${r.pdf_url}" target="_blank" rel="noopener">Open PDF at p.${r.page} ↗</a> · <a href="#${S.j}/${S.view}/src=${encodeURIComponent(r.id)}">link to this source</a></p>` : ""}</div>`;
  }
  if (r.type === "evidence") return `<div class="src"><div class="type">Causal evidence · ${esc(r.evidence_id)} · ${esc(r.action_class)} (${esc(r.hazard)})</div>
      <p><span class="badge">${esc(r.grade)}</span></p><blockquote>${esc(r.finding)}</blockquote>
      <p class="muted">${esc(r.source)}${r.paper_refs ? `, refs ${esc(r.paper_refs)}` : ""}</p>
      <div class="basis">⚠ Effect band used in the model: ${r.band[0]} to ${r.band[1]} (${esc(r.band_basis)})</div></div>`;
  if (r.type === "data") return `<div class="src"><div class="type">Dataset · ${esc(r.dataset_id)}</div>${r.rows.map((x) =>
      `<p><b>${esc(x.dataset)}</b><br><span class="muted">${esc(x.source)}</span>${x.citation ? `<br><span class="muted">${esc(x.citation)}</span>` : ""}</p>`).join("")}</div>`;
  if (r.type === "assumption") return `<div class="src assumption"><div class="type">${r.status === "cited" ? "✓ Method" : "⚠ Assumption"} · ${esc(r.kind)}</div>
      <p><b>${esc(r.what)}</b>: ${esc(typeof r.value === "number" ? Math.round(r.value * 1e4) / 1e4 : JSON.stringify(r.value))}</p>
      <div class="basis">${esc(r.basis)}</div>${r.file ? `<p class="muted">${esc(r.file)}</p>` : ""}</div>`;
  if (r.type === "calc") {
    const groups = {}; (r.inputs || []).forEach((i) => (groups[i.split(":")[0]] ??= []).push(i));
    const name = { plan: "plan quotes", ev: "evidence rows", data: "datasets", asm: "assumptions & methods", calc: "computed inputs" };
    return `<div class="src"><div class="type">ƒ Computed</div><p><b>${esc(r.label)}</b>${r.value != null ? `: ${fmt(r.value)}` : ""}</p><div class="basis">${esc(r.formula)}</div>
      <div class="inputs">${Object.entries(groups).map(([k, v]) => `<button data-ids='${esc(JSON.stringify(v))}'>${v.length} ${name[k] || k} →</button>`).join("")}</div></div>`;
  }
  return `<div class="src"><div class="type">Missing</div><p>${esc(r.id)}</p></div>`;
}
$("drawer-body").addEventListener("click", (e) => { const b = e.target.closest(".inputs button"); if (b) openDrawer(JSON.parse(b.dataset.ids)); });

// ---------- settings: on/off, threshold, coverage per strategy
const cfg = (k) => S.set[k] || {};
const visible = (st) => SCOPE_RANK[st.scope] <= SCOPE_RANK[S.scope];
const isOn = (k) => visible(S.st[k]) && cfg(k).on !== false;
const mult = (k) => cfg(k).cov ?? 1;
const changed = (k) => !!(cfg(k).rule || (cfg(k).cov ?? 1) !== 1);
const ruleLabel = (k, r) => (S.st[k].rules.find((x) => x.rule === r) || {}).label || r;
// an option alone scales exactly with reach: deaths × min(1, sc·m)/min(1, sc) per hazard, cost × m
function scaled(k, p) {
  const m = mult(k), sc = S.st[k].sc, f = (h) => (sc[h] > 0 ? Math.min(1, sc[h] * m) / Math.min(1, sc[h]) : m);
  return { x: p.x * m, y: (p.yh || 0) * f("heat") + (p.yc || 0) * f("cold") };
}
function shortSeg(st) { return st.targets ? st.targets.segment_label : ""; }
function shortName(st) { return st.in_plan ? st.class_label : st.label; }

// ---------- left: scope + strategies grouped by who can pull the lever
function renderScope() {
  $("scope").innerHTML = S.M.scopes.map((sc) => `<button aria-pressed="${SCOPE_RANK[sc] <= SCOPE_RANK[S.scope]}" data-scope="${sc}"
    title="${sc === "plan" ? "Only the strategies the plan commits to" : sc === "menu" ? "Add other strategies from the shared menu and the plan's recommendations" : "Add long-term structural policies"}">${SCOPE_TEXT[sc]}</button>`).join("");
}
$("scope").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  S.scope = b.dataset.scope; renderScope(); renderLeft(); drawChart(); hash(); schedule(0);
});
function evMark(st) {
  if (st.harmful) return `<span class="ev-harm" title="Evidence of harm">◆</span>`;
  if (st.causal) return `<span class="ev-causal" title="Causal evidence that it saves lives">◆</span>`;
  return `<span class="ev-none" title="No causal evidence yet">◇</span>`;
}
function targetsLine(st) {
  const t = st.targets; if (!t) return "";
  const share = Object.entries(t.share).map(([h, v]) => `${pct(100 * v)} of ${h} deaths`).join(" · ");
  const reach = Math.min(100, 100 * t.coverage * mult(st.key));
  return `<p class="tg">Targets <b>${esc(t.segment_label)}</b> · ${share} · reaches ${pct(reach)} of them · all ${t.n_units} ${t.n_units === 1 ? "county" : "counties"} ${chip(t.cite, "")}</p>`;
}
function assignsLine(st) {
  if (!st.plan_assigns || !st.plan_assigns.length) return "";
  return `<p class="tg">Plan assigns: ${st.plan_assigns.map((a) => `${esc(a.label)}${st.plan_assigns.length > 1 || a.n > 1 ? ` (${a.n})` : ""} ${chip(a.cite, "")}`).join(" · ")}</p>`;
}
function renderLeft() {
  const by = {};
  S.M.strategies.filter(visible).forEach((st) => (by[st.group] ??= []).push(st));
  $("groups").innerHTML = S.M.groups.filter((g) => by[g]).map((g) => {
    const L = by[g], n = L.filter((st) => isOn(st.key)).length, closed = S.closed.has(g);
    return `<div class="grp" data-group="${esc(g)}"><div class="ghead">
        <input type="checkbox" class="gcb" ${n === L.length ? "checked" : ""} data-ind="${n > 0 && n < L.length}" aria-label="Include all: ${esc(g)}">
        <button class="gname" aria-expanded="${!closed}">${closed ? "▸" : "▾"} ${esc(g)}</button><span class="gn">${n}/${L.length}</span></div>
      ${closed ? "" : L.map(rowHtml).join("")}</div>`;
  }).join("");
  $("groups").querySelectorAll(".gcb").forEach((c) => (c.indeterminate = c.dataset.ind === "true"));
}
function rowHtml(st) {
  const k = st.key, on = isOn(k), open = S.open.has(k), c = cfg(k);
  const opts = `<option value="auto">Auto (best)</option>` + st.rules.map((r) => `<option value="${esc(r.rule)}" ${c.rule === r.rule ? "selected" : ""}>${esc(r.label)} · ${Math.round(r.days)} d/yr${r.plan ? " · plan" : ""}</option>`).join("");
  return `<div class="srow ${on ? "" : "off"}" data-key="${esc(k)}">
      <input type="checkbox" class="scb" ${on ? "checked" : ""} aria-label="Include ${esc(st.label)}">
      <button class="sname" aria-expanded="${open}" title="${esc(st.label)} · ${esc(st.family)}"><span class="dot" style="background:${famColor(st.family)}"></span><span class="nm"><span class="t">${esc(shortName(st))}</span><span class="sg">${esc(shortSeg(st))}</span></span></button>
      <span class="marks">${changed(k) ? '<span class="mod" title="Your setting">✎</span>' : ""}${st.in_plan ? '<span class="mk-plan" title="In the plan">●</span>' : ""}${evMark(st)}</span></div>
    ${open ? `<div class="sx" data-key="${esc(k)}">
      <label>Threshold <select class="rsel" aria-label="Threshold for ${esc(st.label)}">${opts}</select><span></span></label>
      <label>Coverage <input type="range" class="crange" min="${100 * S.M.coverage_mult[0]}" max="${100 * S.M.coverage_mult[1]}" step="5" value="${Math.round(100 * mult(k))}" aria-label="Coverage for ${esc(st.label)}"><output>${Math.round(100 * mult(k))}%</output></label>
      ${targetsLine(st)}${assignsLine(st)}
      <p class="tg">Who acts: ${esc(st.lever_owner)} ${chip(st.lever_cite, "")} · ${chip(st.cite)}</p></div>` : ""}`;
}
$("groups").addEventListener("click", (e) => {
  const g = e.target.closest(".gname");
  if (g) { const n = g.closest(".grp").dataset.group; S.closed.has(n) ? S.closed.delete(n) : S.closed.add(n); renderLeft(); return; }
  const s = e.target.closest(".sname");
  if (s) { const k = s.closest(".srow").dataset.key; S.open.has(k) ? S.open.delete(k) : S.open.add(k); renderLeft(); }
});
$("groups").addEventListener("change", (e) => {
  const t = e.target;
  if (t.classList.contains("gcb")) {
    const g = t.closest(".grp").dataset.group;
    S.M.strategies.filter((st) => st.group === g && visible(st)).forEach((st) => (S.set[st.key] = { ...cfg(st.key), on: t.checked }));
  } else if (t.classList.contains("scb")) {
    const k = t.closest(".srow").dataset.key; S.set[k] = { ...cfg(k), on: t.checked };
  } else if (t.classList.contains("rsel")) {
    const k = t.closest(".sx").dataset.key; S.set[k] = { ...cfg(k), rule: t.value === "auto" ? null : t.value };
  } else if (t.classList.contains("crange")) {
    const k = t.closest(".sx").dataset.key; S.set[k] = { ...cfg(k), cov: +t.value / 100 };
  } else return;
  renderLeft(); drawChart(); schedule();
});
$("groups").addEventListener("input", (e) => {
  if (e.target.classList.contains("crange")) e.target.nextElementSibling.textContent = `${e.target.value}%`;
});

// ---------- optimize (server) on every change, debounced; stale answers are dropped
let timer = null;
function schedule(ms = 250) { clearTimeout(timer); timer = setTimeout(optimize, ms); }
async function optimize() {
  const seq = ++S.seq, strategies = {};
  S.M.strategies.forEach((st) => {
    const c = cfg(st.key);
    if (c.on === false || c.rule || (c.cov ?? 1) !== 1) strategies[st.key] = { on: c.on !== false, rule: c.rule || "auto", cov: c.cov ?? 1 };
  });
  $("busy").hidden = false;
  try {
    const F = await api(`/api/j/${S.j}/optimize`, { view: S.view, scope: S.scope, strategies });
    if (seq !== S.seq) return;
    S.F = F; select(); drawChart(); renderMix(); if (S.analyse?.mode === "mix") openAnalyse("mix");
  } finally { if (seq === S.seq) $("busy").hidden = true; }
}
function select() {
  const pts = S.F ? S.F.frontier : [];
  S.sel = pts.filter((p) => p.x_pct <= S.budget + 1e-9).pop() || pts[0] || null;
  const xmax = Math.max(300, ...pts.map((p) => p.x_pct)); $("budget").max = Math.ceil(Math.min(xmax, 1000));
}

// ---------- one tooltip for the map and the charts: Plotly hover events drive a custom HTML card (hoverinfo "none")
const TIP = $("tip"), coarse = matchMedia("(pointer: coarse)").matches, act = coarse ? "Tap again" : "Click";
let tipAt = { x: 0, y: 0 }, tipKey = null;
document.addEventListener("mousemove", (e) => { tipAt = { x: e.clientX, y: e.clientY }; if (!TIP.hidden && !TIP.classList.contains("pinned")) placeTip(); }, { passive: true });
document.addEventListener("pointerdown", (e) => { if (TIP.classList.contains("pinned") && !e.target.closest("#tip, #chart, #map")) hideTip(); });
function placeTip() {
  const r = TIP.getBoundingClientRect(), g = 14;
  let x = tipAt.x + g, y = tipAt.y + g;
  if (x + r.width > innerWidth - 8) x = tipAt.x - r.width - g;
  if (y + r.height > innerHeight - 8) y = tipAt.y - r.height - g;
  TIP.style.left = `${Math.max(8, x)}px`; TIP.style.top = `${Math.max(8, y)}px`;
}
function showTip(html, ev, key = null, pinned = false) {
  if (ev && ev.clientX != null) tipAt = { x: ev.clientX, y: ev.clientY };
  TIP.innerHTML = html; TIP.hidden = false; TIP.classList.toggle("pinned", pinned); tipKey = key; placeTip();
}
function hideTip() { TIP.hidden = true; TIP.classList.remove("pinned"); tipKey = null; }
// hover shows the card; on touch the first tap shows it and the second opens
function bindTip(el, build, open) {
  el.on("plotly_hover", (ev) => { if (coarse) return; const p = ev.points[0], h = p && build(p); if (h) showTip(h, ev.event); });
  el.on("plotly_unhover", () => { if (!TIP.classList.contains("pinned")) hideTip(); });
  el.on("plotly_click", (ev) => {
    const p = ev.points[0]; if (!p) return;
    const k = `${p.curveNumber}:${p.pointNumber}`, h = coarse && build(p);
    if (h && tipKey !== k) { showTip(h, ev.event, k, true); return; }
    hideTip(); open(p);
  });
  el.addEventListener("mouseleave", () => { if (!TIP.classList.contains("pinned")) hideTip(); });
}
const EV_FALLBACK = { "--critical": "#d03b3b", "--good": "#0ca30c", "--untested": "#c98a00" };     // if a stale stylesheet lacks a token
const evColor = (st) => { const k = st.harmful ? "--critical" : st.causal ? "--good" : "--untested"; return css(k) || EV_FALLBACK[k]; };
const evBadge = (st) => (st.harmful ? '<span class="ev harm">⚠ evidence of harm</span>' : st.causal ? '<span class="ev causal">✓ proven to save lives</span>' : '<span class="ev none">○ untested</span>');
const HZ = { heat: "☀ heat", cold: "❄ cold", both: "☀❄ heat & cold" };
const who = (g) => (!g || g === "general public" ? "everyone" : g);
const trim = (s, n = 70) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const signed = (y) => (Math.abs(y) <= EPS ? "0" : sign(y));
const costName = () => (S.M.cost_basis === "own plan" ? "today's plan" : "its inherited plans");
const costOf = () => (S.M.cost_basis === "own plan" ? "today's plan's cost" : "its inherited plans' cost");
// rule labels name plan triggers by document and id ("plan {doc_id} trigger T8: …"); keep the words
const plainRule = (s) => String(s ?? "").replace(/(plan |any of: )?\S+ trigger T\d+: /g, "").replace(/^any of: /, "").replace(/^as the plan runs it \((.*)\)$/, "$1");
function planBar(plan_y, best_y) {
  const tot = Math.max(best_y, plan_y, EPS);
  return `<div class="pbar"><span class="p" style="width:${(100 * Math.max(0, plan_y)) / tot}%"></span><span class="g" style="width:${(100 * Math.max(0, best_y - plan_y)) / tot}%"></span></div>`;
}
function dotTip(d) {
  const st = S.st[d.key], sv = scaled(d.key, d), cites = planCites(st);
  const planNote = !st.in_plan ? "From the shared menu: its own plans don't include it" : d.plan ? "◯ How its plan runs it today"
    : st.plan_rule ? `Its plan runs it at: ${trim(plainRule(ruleLabel(d.key, st.plan_rule)))}` : "In its plan";
  if (cites.length) getSrc(cites[0]).then((r) => { const el = TIP.querySelector(`.tq[data-q="${CSS.escape(cites[0])}"]`); if (el && !TIP.hidden) { el.innerHTML = quoteHtml(r); placeTip(); } });
  return `<div style="border-left:4px solid ${evColor(st)};padding-left:8px">
    <div class="th"><b>${esc(st.class_label)}</b>${evBadge(st)}</div>
    <div class="tl"><span class="pill">${esc(who(shortSeg(st)))}</span><span class="hz">${HZ[st.hazard] || ""}</span></div>
    <div class="tm">On: ${esc(trim(plainRule(ruleLabel(d.key, d.rule))))} · ${Math.round(d.days)} days/yr</div>
    <div class="tstats"><div><b>${signed(sv.y)}</b><small>lives / yr, alone</small></div><div><b>${pct(sv.x)}</b><small>of ${costOf()}</small></div></div>
    <div class="tm">${esc(planNote)}</div>${cites.length ? `<div class="tq" data-q="${esc(cites[0])}"><span class="qs">loading the plan's words…</span></div>` : ""}
    ${!st.causal && !st.harmful && S.view === "evidence" ? '<div class="tm">Untested: counts as 0 in “Proven only”</div>' : ""}
    <div class="cta">${act} ${cites.length ? "to see it on the plan's page" : "for detail"} →</div></div>`;
}
function lineTip(p) {
  const plan = S.M.plan, top = [...p.items].sort((a, b) => b.marginal_y - a.marginal_y).slice(0, 3);
  return `<div class="th"><b>Best mix</b><span class="tag">${p.items.length} strateg${p.items.length === 1 ? "y" : "ies"}</span></div>
    <div class="tbig"><b class="plain">${fmt(p.y)}</b><span>lives / yr at ${pct(p.x_pct)} of ${costOf()}</span></div>
    ${plan.x_pct > 0 ? `<div class="tm">${signed(p.y - plan.y)} vs today's plan</div>` : ""}
    <ul class="tlist">${top.map((i) => `<li><span>${esc(trim(shortName(S.st[i.measure]), 34))}</span><span>${signed(i.marginal_y)}</span></li>`).join("")}</ul>
    <div class="cta">${act} to select this budget</div>`;
}
function starTip(title, y, sub) { return `<div class="th"><b>${title}</b></div><div class="tbig"><b class="plain">${fmt(y)}</b><span>lives / yr</span></div><div class="tm">${sub}</div>`; }
// a frontier vertex of one strategy sits exactly on that strategy's dot: hovering or clicking it means the dot
function dotOn(p) {
  const v = p.data.meta === "line" && S.line[p.pointNumber];
  if (!v || v.items.length !== 1) return null;
  const k = v.items[0].measure, r = v.items[0].rule;
  return S.M.dots.find((d) => d.key === k && d.rule === r && cfg(k).cov == null) || null;
}
function chartTip(p) {
  const m = p.data.meta, i = p.pointNumber, d = dotOn(p);
  if (d) return dotTip(d);
  if (m === "dot") return dotTip(S.M.dots[p.customdata]);
  if (m === "line") return S.line[i] ? lineTip(S.line[i]) : null;
  if (m === "plan") return starTip("★ Today's plan, as written", S.M.plan.y, `${S.M.plan.bar.length} strategies · 100% of its cost`);
  if (m === "pall") return starTip("☆ Whole plan, incl. standing commitments", S.M.plan_all.y, `${pct(S.M.plan_all.x_pct)} of the ★'s cost`);
  if (m === "vint") { const v = S.vint[i]; return starTip(`☆ Plans in force in ${v.year}`, v.y, `${esc(v.docs.join(", "))} · ${pct(v.x_pct)} of today's cost`); }
  return null;
}
function chartOpen(p) {
  const d = dotOn(p);
  if (d) openAnalyse("dot", d.key);
  else if (p.data.meta === "line") { S.budget = Math.min(+$("budget").max, Math.round(p.x * 100) / 100); syncBudget(); select(); drawChart(); renderMix(); }
  else if (p.data.meta === "dot") openAnalyse("dot", S.M.dots[p.customdata].key);
}

// ---------- plan quotes: for a strategy its own plans run, the plan's words verbatim with doc and page (/api/source), and the
// PDF page itself (pdf.js, loaded on first use) with the quote highlighted: a pulse that settles into a soft mark
const SRC = new Map();
const getSrc = (id) => { if (!SRC.has(id)) SRC.set(id, api(`/api/source/${S.j}/${encodeURIComponent(id)}`).catch(() => null)); return SRC.get(id); };
const planCites = (st) => (st.in_plan ? [...new Set((st.plan_assigns || []).flatMap((a) => a.cite || []).filter((i) => i.startsWith("plan:")))] : []);
const docOf = (id) => (S.M.docs || []).find((d) => d.doc_id === id) || { title: id };
function quoteHtml(r, n = 160) {
  if (!r || !r.quote) return '<span class="qs">quote unavailable</span>';
  const d = docOf(r.doc_id);
  return `<span class="qt">“${esc(trim(r.quote, n))}”</span><span class="qs">${esc(trim(d.title, 52))}${d.year ? ` (${d.year})` : ""} · p.${esc(r.page)}${r.verified === "True" || r.verified === true ? " · ✓ verbatim" : ""}</span>`;
}
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfReady = null;                  // browsers refuse a cross-origin worker URL, so the worker runs from a same-origin blob
const loadPdfJs = () => (pdfReady ??= new Promise((ok, no) => { const s = document.createElement("script"); s.src = `${PDFJS}pdf.min.js`; s.onload = ok; s.onerror = no; document.head.appendChild(s); })
  .then(() => fetch(`${PDFJS}pdf.worker.min.js`)).then((r) => r.text())
  .then((src) => { pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" }))); }));
const PDFS = new Map();
const nrm = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g, "");
async function showOnPage(box, r) {
  const ticket = (box._ticket = (box._ticket || 0) + 1);
  box.innerHTML = '<p class="muted">Loading the page…</p>';
  try {
    await loadPdfJs();
    const url = r.pdf_url.split("#")[0];
    if (!PDFS.has(url)) PDFS.set(url, pdfjsLib.getDocument(url).promise);
    const page = await (await PDFS.get(url)).getPage(+r.page);
    const w = Math.max(280, box.clientWidth - 2), vp = page.getViewport({ scale: w / page.getViewport({ scale: 1 }).width }), dpr = window.devicePixelRatio || 1;
    const d = document.createElement("div"); d.className = "qpage"; d.style.width = `${vp.width}px`; d.style.height = `${vp.height}px`;
    const cv = document.createElement("canvas"); cv.width = vp.width * dpr; cv.height = vp.height * dpr;
    const tl = document.createElement("div"); tl.className = "textLayer"; tl.style.setProperty("--scale-factor", vp.scale);
    d.append(cv, tl);
    await page.render({ canvasContext: cv.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    if (ticket !== box._ticket) return;                                     // another quote was picked meanwhile
    box.innerHTML = `<div class="qbar"><span>p.${esc(r.page)} · ${esc(trim(docOf(r.doc_id).title, 60))}</span><a href="${r.pdf_url}" target="_blank" rel="noopener">Open full PDF ↗</a></div>`;
    box.appendChild(d);
    await pdfjsLib.renderTextLayer({ textContentSource: await page.getTextContent(), container: tl, viewport: vp, textDivs: [] }).promise;
    const Q = nrm(r.quote), spans = [...tl.querySelectorAll("span")], hit = spans.map((s) => { const t = nrm(s.textContent); return t.length >= 6 && Q.includes(t); });
    const on = spans.map((s, i) => { const t = nrm(s.textContent); return hit[i] || (t.length > 0 && Q.includes(t) && hit[i - 1] && hit[i + 1]); });
    let run = [], best = [];                                                  // keep the longest run of matching spans: the quote itself
    on.forEach((x, i) => { if (x) run.push(i); if (!x || i === on.length - 1) { if (run.reduce((a, j) => a + spans[j].textContent.length, 0) > best.reduce((a, j) => a + spans[j].textContent.length, 0)) best = run; run = []; } });
    best.forEach((i) => spans[i].classList.add("hl"));
    const first = tl.querySelector(".hl");
    if (first) box.scrollTop = d.offsetTop + first.offsetTop - box.clientHeight / 3;
    else {
      d.classList.add("flash");
      box.querySelector(".qbar span").textContent += spans.length ? " · quote not located in the PDF's text layer: check by eye"
        : " · this page has no selectable text (scanned), so it can't be highlighted; the quote was verified in its extracted text";
    }
  } catch (e) {
    if (ticket === box._ticket) box.innerHTML = `<p class="muted">Could not render the page. <a href="${r.pdf_url}" target="_blank" rel="noopener">Open the PDF at p.${esc(r.page)} ↗</a></p>`;
  }
}
// the plan's quotes for one strategy in the Analyse panel: cards to pick from, the first one shown on its page
function fillQuotes(st) {
  const cites = planCites(st), show = cites.slice(0, 4), k = st.key;
  Promise.all(show.map(getSrc)).then((R) => {
    if (S.analyse?.key !== k || !$("qlist")) return;
    const rs = R.filter((r) => r && r.quote);
    if (!rs.length) { $("qlist").innerHTML = '<p class="muted">No quote available.</p>'; return; }
    $("qlist").innerHTML = rs.map((r, i) => `<button class="qcard${i ? "" : " on"}" data-i="${i}">${quoteHtml(r, 280)}<span class="qgo">Show on page →</span></button>`).join("")
      + (cites.length > show.length ? `<p class="note">${chip(cites, `all ${cites.length} quotes`)}</p>` : "");
    $("qlist").onclick = (e) => {
      const b = e.target.closest(".qcard"); if (!b) return;
      $("qlist").querySelectorAll(".qcard").forEach((x) => x.classList.toggle("on", x === b)); showOnPage($("qpdf"), rs[+b.dataset.i]);
    };
    showOnPage($("qpdf"), rs[0]);
  });
}

// ---------- center: the one chart. By default only the strategies in the selected mix or the plan show as dots ("All
// options" shows every strategy at every threshold); colour = evidence; hovering a brief row highlights its strategy.
function drawChart() {
  if (!S.M) return;
  const D = S.M.dots, muted = css("--text-muted"), red = css("--critical"), ink = css("--text-primary"), surf = css("--surface-1"), grid = css("--grid"), acc = css("--accent");
  const focus = new Set([...(S.sel ? S.sel.items.map((i) => i.measure) : []), ...S.M.plan.bar.map((b) => b.measure)]);
  const used = new Set(S.sel ? S.sel.items.map((i) => `${i.measure}@${i.rule}`) : []);
  const pos = { x: [], y: [], c: [], o: [], s: [], z: [], i: [] }, zero = { x: [], o: [], i: [] }, neg = { x: [], y: [], o: [], i: [] }, ring = { x: [], y: [] };
  D.forEach((d, i) => {
    const st = S.st[d.key], hl = S.hl === d.key;
    if (!hl && (!visible(st) || !(S.allDots || focus.has(d.key)))) return;
    if (st.harmful && !hl && !S.allDots && !d.plan && !used.has(`${d.key}@${d.rule}`)) return;
    const sv = scaled(d.key, d), c = cfg(d.key), active = isOn(d.key) && (!c.rule || c.rule === d.rule);
    const x = Math.max(0.05, sv.x), op = S.hl && !hl ? 0.25 : hl ? 1 : active ? 0.85 : 0.3;
    if (sv.y > EPS) { pos.x.push(x); pos.y.push(sv.y); pos.c.push(evColor(st)); pos.o.push(op); pos.s.push(st.scope === "standing" ? "diamond" : "circle"); pos.z.push(hl ? 12 : 8); pos.i.push(i); }
    else if (sv.y < -EPS) { neg.x.push(x); neg.y.push(sv.y); neg.o.push(op); neg.i.push(i); }
    else { zero.x.push(x); zero.o.push(Math.min(op, 0.6)); zero.i.push(i); }
    if (d.plan === "main" || (d.plan === "all" && S.scope === "standing")) { ring.x.push(x); ring.y.push(Math.abs(sv.y) <= EPS ? 0 : sv.y); }
  });
  const fr = (S.F ? S.F.frontier : []).filter((p) => p.x_pct > 0);
  const vint = (S.M.vintages || []).filter((v) => !v.current && v.x_pct > 0);
  const xs = [...pos.x, ...zero.x, ...neg.x, ...fr.map((p) => p.x_pct), ...vint.map((v) => v.x_pct), 100], xmin = Math.max(0.05, Math.min(...xs) * 0.7), xmax = Math.max(...xs) * 1.4;
  const line = fr.length ? [...fr, { ...fr[fr.length - 1], x_pct: xmax }] : [];
  S.line = fr; S.vint = vint;
  const plan = S.M.plan, pall = S.M.plan_all;
  const key = (name, color, symbol = "circle") => ({ x: [null], y: [null], type: "scatter", mode: "markers", name, hoverinfo: "skip", marker: { size: 9, color, symbol } });
  const traces = [
    key("proven", css("--good") || EV_FALLBACK["--good"]), key("untested", css("--untested") || EV_FALLBACK["--untested"]), ...(neg.x.length ? [key("harmful", red, "x")] : []),
    ...(zero.x.length ? [key(S.view === "evidence" ? "no proven effect (0)" : "no effect (0)", muted, "circle-open")] : []),
    // the frontier's vertices carry its hover, as small invisible markers under the dots: a dot on the line still wins
    { x: fr.map((p) => p.x_pct), y: fr.map((p) => p.y), type: "scatter", mode: "markers", meta: "line", showlegend: false, hoverinfo: "none", marker: { size: 5, color: acc, opacity: 0 } },
    { x: pos.x, y: pos.y, customdata: pos.i, type: "scatter", mode: "markers", meta: "dot", showlegend: false, hoverinfo: "none",
      marker: { size: pos.z, color: pos.c, opacity: pos.o, symbol: pos.s, line: { color: surf, width: 1 } } },
    { x: zero.x, y: zero.x.map(() => 0), customdata: zero.i, type: "scatter", mode: "markers", meta: "dot", showlegend: false, hoverinfo: "none",
      marker: { size: 7, symbol: "circle-open", color: muted, opacity: zero.o, line: { color: muted, width: 1.3 } } },
    { x: neg.x, y: neg.y, customdata: neg.i, type: "scatter", mode: "markers", meta: "dot", showlegend: false, hoverinfo: "none", marker: { size: 9, symbol: "x", color: red, opacity: neg.o } },
    { x: ring.x, y: ring.y, type: "scatter", mode: "markers", showlegend: false, hoverinfo: "skip", marker: { size: 14, symbol: "circle-open", color: ink, line: { width: 1.5 } } },
    { x: line.map((p) => p.x_pct), y: line.map((p) => p.y), type: "scatter", mode: "lines", name: "best mix", hoverinfo: "skip", line: { shape: "hv", width: 2.5, color: acc } },
  ];
  if (plan.x_pct > 0) traces.push({ x: [plan.x_pct], y: [plan.y], type: "scatter", mode: "markers", name: "today's plan", meta: "plan", hoverinfo: "none",
    marker: { symbol: "star", size: 20, color: ink, line: { color: surf, width: 2 } } });
  if (vint.length) traces.push({ x: vint.map((v) => v.x_pct), y: vint.map((v) => v.y), text: vint.map((v) => String(v.year)), type: "scatter", mode: "markers+text", textposition: "top center",
    textfont: { size: 11, color: muted }, name: "earlier plans", meta: "vint", hoverinfo: "none", marker: { symbol: "star-open", size: 15, color: muted, line: { width: 1.5 } } });
  if (S.scope === "standing") traces.push({ x: [pall.x_pct], y: [pall.y], type: "scatter", mode: "markers", name: "incl. standing commitments", meta: "pall", hoverinfo: "none",
    marker: { symbol: "star-open", size: 18, color: ink, line: { width: 1.5 } } });
  if (S.sel && S.sel.x_pct > 0) traces.push({ x: [S.sel.x_pct], y: [S.sel.y], type: "scatter", mode: "markers", showlegend: false, hoverinfo: "skip",
    marker: { symbol: "circle-open", size: 20, color: acc, line: { width: 3 } } });
  const ann = [], best = fr.filter((p) => p.x_pct <= 100 + 1e-9).pop();
  // mostly untested options count as 0 when only proven effects count: say so, and offer the view where they show
  const note = S.view === "evidence" && zero.x.length > pos.x.length ? [{ xref: "paper", yref: "paper", x: 0.995, y: 0.98, xanchor: "right", yanchor: "top", showarrow: false,
    text: "Most options here are untested, so they count as 0 in “Proven only”.  <b>See them under “If untested work” ▸</b>", captureevents: true, name: "to-agnostic",
    font: { size: 12, color: ink }, bgcolor: css("--warning-bg"), bordercolor: css("--border"), borderpad: 6 }] : [];
  if (plan.x_pct > 0) ann.push({ x: Math.log10(plan.x_pct), y: plan.y, text: "Today's plan", ax: -46, ay: 30, arrowcolor: muted, font: { size: 11.5, color: ink } });
  if (best && plan.x_pct > 0 && best.y - plan.y > EPS) ann.push({ x: Math.log10(best.x_pct), y: best.y, text: `${{ plan: "Plan retimed", menu: "Best mix", standing: "+ long-term" }[S.scope]}, same cost: ${sign(best.y - plan.y)}`, ax: -70, ay: -26,
    arrowcolor: acc, font: { size: 11.5, color: acc }, bgcolor: surf });
  const ticks = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000].filter((t) => t >= xmin / 1.5 && t <= xmax * 1.5);
  const layout = {
    margin: { l: 58, r: 14, t: 30, b: 50 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: css("--text-secondary"), size: 12 },
    xaxis: { type: "log", range: [Math.log10(xmin), Math.log10(xmax)], tickvals: ticks, ticktext: ticks.map((t) => `${t}%`), gridcolor: grid, zeroline: false,
      title: { text: `Cost vs ${costName()} (100% = same cost; relative tiers, not $)` } },
    yaxis: { title: { text: (S.M.docs || []).some((d) => d.layer !== "own") ? "Lives saved / yr, on top of inherited plans" : "Lives saved / yr" }, gridcolor: grid,
      zeroline: true, zerolinecolor: muted, zerolinewidth: 1 },
    shapes: [{ type: "line", x0: 100, x1: 100, yref: "paper", y0: 0, y1: 1, line: { color: muted, dash: "dot", width: 1 } }],
    annotations: [...ann.map((a) => ({ showarrow: true, arrowhead: 0, arrowwidth: 1, ...a })), ...note],
    legend: { orientation: "h", x: 0, y: 1.01, xanchor: "left", yanchor: "bottom", bgcolor: "rgba(0,0,0,0)", font: { size: 11.5 } },
    hovermode: "closest", uirevision: `${S.j}/${S.view}`,
  };
  Plotly.react("chart", traces, layout, { displayModeBar: false, responsive: true });
  const el = $("chart");
  if (!el._bound) {
    el._bound = true; bindTip(el, chartTip, chartOpen);
    el.addEventListener("mouseenter", () => highlight(null));                  // a brief row's highlight never outlives the pointer
    el.on("plotly_clickannotation", (ev) => { if (ev.annotation.name === "to-agnostic") { S.view = "agnostic"; load(); } });
  }
}

// ---------- bottom strip: the selected mix (the chart's readout)
function renderMix() {
  const p = S.sel, plan = S.M.plan;
  $("big").textContent = p ? fmt(p.y) : "–";
  $("vs").innerHTML = `${plan.x_pct > 0 && p ? `${signed(p.y - plan.y)} vs plan ★ <b>${fmt(plan.y)}</b> · ` : ""}at ${pct(p ? p.x_pct : 0)} of ${costOf()}`;
}

// ---------- right: the brief. What to change, add and who gains, at the plan's cost with default settings (studio.py brief)
function briefRow(r) {
  const drop = r.kind === "drop", harm = r.harmful && (drop || r.kind === "retime"), d = (x) => Math.round(x ?? 0);
  const what = harm ? (drop ? "Stop" : `Limit to ${r.to_label}`) : drop ? "Drop: frees budget"
    : r.kind === "add" || r.from_days == null || d(r.to_days) === d(r.from_days) ? r.to_label : `${r.to_days > r.from_days ? "Widen" : "Narrow"} to ${r.to_label}`;
  const days = r.kind === "retime" ? ` · ${d(r.from_days)} → ${d(r.to_days)} d/yr` : r.kind === "add" ? ` · ${d(r.to_days)} d/yr` : "";
  const [ic, glyph] = harm ? ["harm", "⚠"] : r.kind === "add" ? ["add", "+"] : drop ? ["", "−"] : ["retime", "↻"];
  const vc = Math.abs(r.dy) <= EPS ? "zero" : r.dy < 0 ? "neg" : "";
  return `<div class="brow" role="button" tabindex="0" data-key="${esc(r.measure)}"${r.from_label ? ` title="Now: ${esc(plainRule(r.from_label))}"` : ""}>
    <span class="ic ${ic}" aria-hidden="true">${glyph}</span>
    <span><span class="bn">${esc(r.label)}</span><span class="bm"><span class="pill">${esc(who(r.group))}</span><span class="hz">${HZ[r.hazard] || ""}</span><span>${esc(trim(plainRule(what), 48))}${days}</span></span></span>
    <span class="bv ${vc}">${signed(r.dy)}<br>${chip(r.cite, "")}</span></div>`;
}
function renderBrief() {
  const B = S.M.brief, own = S.M.cost_basis === "own plan";
  const change = B.rows.filter((r) => (r.kind === "retime" || r.kind === "drop") && Math.abs(r.dy) > EPS);
  const add = B.rows.filter((r) => r.kind === "add" && r.dy > EPS);
  const idle = B.rows.filter((r) => r.kind === "drop" && Math.abs(r.dy) <= EPS).length;
  const groups = B.groups.filter((g) => g.dy > EPS), gmax = Math.max(EPS, ...groups.map((g) => g.dy)), gsum = groups.reduce((a, g) => a + g.dy, 0);
  const list = (id, title, L) => {
    if (!L.length) return "";
    const open = S.briefMore.has(id), n = 3;
    return `<section><h4>${title}<span>${L.length}</span></h4>${(open ? L : L.slice(0, n)).map(briefRow).join("")}
      ${L.length > n ? `<button class="morebtn" data-more="${id}">${open ? "Show fewer" : `+ ${L.length - n} more`}</button>` : ""}</section>`;
  };
  const head = B.gain > EPS ? `<div class="gain"><b>${sign(B.gain)}</b><span>more lives / yr<br>${own ? "at the same cost" : "for what its inherited plans cost"}</span></div>`
    : B.best_y <= EPS ? `<div class="gain none"><b>0</b><span>no measure in this view saves lives at this cost</span></div>`
    : `<div class="gain none"><b>≈ best</b><span>already near the best mix at its cost</span></div>`;
  $("brief").innerHTML = `<div><div class="eyebrow">Recommended<span>${chip(B.cite, "")}</span></div>${head}${planBar(B.plan_y, B.best_y)}
      <div class="pbl"><span>${own ? "today" : "own plans"} <b>${fmt(B.plan_y)}</b></span><span>best mix <b>${fmt(B.best_y)}</b></span></div>
      <div class="range" title="The same recommendation under each effect view">${Object.keys(VIEW_SHORT).map((v) =>
        `<span class="${v === S.view ? "on" : ""}">${VIEW_SHORT[v]} ${signed(B.gain_by_view[v])}</span>`).join("")}</div></div>
    ${list("change", "Change", change)}${list("add", "Add", add)}
    ${groups.length ? `<section><h4>Protect<span>share of the gain</span></h4>${groups.slice(0, 4).map((g) => `<div class="gq"><span class="gt">${esc(who(g.group))}</span>
      <span class="gb"><span style="width:${(100 * g.dy) / gmax}%"></span></span><span class="gv">${Math.round((100 * g.dy) / gsum)}%</span></div>`).join("")}</section>` : ""}
    ${idle ? `<p class="note">${idle} plan strateg${idle === 1 ? "y adds" : "ies add"} nothing measurable in this view.</p>` : ""}
    ${B.standing_gain > EPS && S.scope !== "standing" ? `<button class="linkbtn" data-scope="standing">Long-term policies could add ${sign(B.standing_gain)} more ▸</button>` : ""}
    <div class="stack" id="stack"></div>`;
  renderStack();
}
$("brief").addEventListener("click", (e) => {
  if (e.target.closest(".chip, .stack")) return;
  const m = e.target.closest("[data-more]");
  if (m) { const id = m.dataset.more; S.briefMore.has(id) ? S.briefMore.delete(id) : S.briefMore.add(id); renderBrief(); return; }
  const sc = e.target.closest("[data-scope]");
  if (sc) { S.scope = sc.dataset.scope; renderScope(); renderLeft(); renderBrief(); drawChart(); hash(); schedule(0); return; }
  const r = e.target.closest(".brow"); if (r) openAnalyse("dot", r.dataset.key);
});
$("brief").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("brow")) { e.preventDefault(); openAnalyse("dot", e.target.dataset.key); }
});
function highlight(k) { if (k !== S.hl) { S.hl = k; drawChart(); } }
$("brief").addEventListener("mouseover", (e) => { const r = e.target.closest(".brow"); highlight(r ? r.dataset.key : null); });
$("brief").addEventListener("focusin", (e) => { const r = e.target.closest(".brow"); highlight(r ? r.dataset.key : null); });
$("brief").addEventListener("mouseleave", () => highlight(null));
const LAYER_TEXT = { own: "Its own plans", county: "County plans", state: "State plans" };
function renderStack() {
  if (!$("stack")) return;                       // optional in the layout
  const L = S.M.layers, R_ = S.M.residents, docs = S.M.docs || [];
  const by = {}; docs.forEach((d) => (by[d.layer] ??= []).push(d));
  const row = (k, y, cite) => {
    const ds = by[k] || []; if (!ds.length) return "";
    return `<details class="layer"><summary><span>${LAYER_TEXT[k]} · ${ds.length}</span><span>${y == null ? "" : `${fmt(y)} /yr ${chip(cite, "")}`}</span></summary>
      ${ds.map((d) => `<a href="${d.pdf}" target="_blank" rel="noopener" title="${esc(d.title)}">${esc(d.year ?? "")} · ${esc(d.title)}${d.role === "participant" ? " (participant)" : ""} ↗</a>`).join("")}</details>`;
  };
  const inh = (by.county || []).length + (by.state || []).length;
  $("stack").innerHTML = `<div class="sk">Plans covering residents</div>${row("own", L.own.y, L.own.cite)}${inh ? `<div class="floor">inherited, as written: <b>${fmt(L.floor.y)}</b> /yr ${chip(L.floor.cite, "")}</div>` : ""}
    ${row("county", null)}${row("state", null)}
    <div class="floor">all plans, same total cost, best mix: <b>${fmt(R_.best_y)}</b> vs <b>${fmt(R_.plan_y)}</b> ${chip(R_.best_cite, "")}</div>`;
}
function syncBudget() { $("budget").value = S.budget; $("budget-out").textContent = pct(S.budget); }
$("budget").addEventListener("input", (e) => { S.budget = +e.target.value; syncBudget(); select(); drawChart(); renderMix(); if (S.analyse?.mode === "mix") openAnalyse("mix"); });

// ---------- Analyse (slide-over)
$("analyse-btn").onclick = () => openAnalyse("mix");
$("analyse-close").onclick = () => { $("analyse").hidden = true; S.analyse = null; hash(); };
function itemRow(k, rule, dy, cost, maxv) {
  const st = S.st[k];
  return `<div class="arow"><span class="dot" style="background:${famColor(st.family)}" title="${esc(st.family)}"></span>
    <div><div class="an">${esc(shortName(st))} <span class="sg">· ${esc(shortSeg(st))}</span> ${evMark(st)} ${changed(k) ? yours() : ""}</div>
      <div class="am">${esc(ruleLabel(k, rule))} · ${esc(st.family)} · ${esc(st.group)}</div>
      ${targetsLine(st).replace('class="tg"', 'class="am"')}${assignsLine(st).replace('class="tg"', 'class="am"')}
      ${dy != null ? `<div class="abar" style="width:${(100 * Math.abs(dy)) / maxv}%;background:${dy < 0 ? css("--critical") : famColor(st.family)}"></div>` : ""}</div>
    <div class="av">${dy != null ? `${sign(dy)}<br><span class="muted">${pct(cost)} cost</span><br>` : ""}${chip(st.cite)}</div></div>`;
}
function openAnalyse(mode, key) {
  S.analyse = { mode, key }; $("analyse").hidden = false; hash(); const body = $("analyse-body");
  if (mode === "mix") {
    const p = S.sel, plan = S.M.plan; if (!p) { body.innerHTML = '<p class="muted">No mix yet.</p>'; return; }
    const match = S.F.frontier.find((q) => q.y >= plan.y - 1e-9 && q.x_pct > 0);
    $("analyse-title").textContent = `Best mix at ${pct(p.x_pct)} of the plan's cost`;
    const ratio = plan.y > EPS ? `${(p.y / plan.y).toFixed(1)}× the plan's ${fmt(plan.y)}` : `plan: ${fmt(plan.y)}`;
    const cards = [["Deaths averted / yr", fmt(p.y), `${ratio} ${chip(S.F.cite)} ${chip(plan.cite, "plan")}`], ["Cost", pct(p.x_pct), "of the plan's (relative tiers, not $)"],
      ["Matches the plan at", match ? pct(match.x_pct) : "–", "of the plan's cost"], ["Heat · cold", `${fmt(p.y_heat)} · ${fmt(p.y_cold)}`, "deaths averted / yr"]];
    const G = { Keep: [], Retime: [], Add: [] }; p.items.forEach((i) => G[i.group].push(i));
    const maxv = Math.max(0.001, ...p.items.map((i) => Math.abs(i.marginal_y)));
    const grp = (g, L, rows) => (L.length ? `<div class="agroup"><h4>${GROUP_TEXT[g]} <span>${L.length}${g !== "Drop" ? ` · ${sign(L.reduce((a, i) => a + i.marginal_y, 0))}` : ""}</span></h4>${rows}</div>` : "");
    body.innerHTML = `<div class="cards">${cards.map(([k, v, s]) => `<div class="card"><div class="ck">${k}</div><div class="cv">${v}</div><div class="cs">${s}</div></div>`).join("")}</div>
      ${["Keep", "Retime", "Add"].map((g) => grp(g, G[g], G[g].map((i) => itemRow(i.measure, i.rule, i.marginal_y, i.cost_pct, maxv)).join(""))).join("")}
      ${grp("Drop", p.drop, p.drop.map((k) => itemRow(k, S.st[k].plan_rule, null, null, maxv)).join(""))}
      <p class="muted">Contributions are added in order and sum to the total. Moving the budget slider updates this view.</p>`;
    return;
  }
  const st = S.st[key]; $("analyse-title").textContent = st.label;
  const m = mult(key), R = st.rules.map((r) => ({ ...r, ...scaled(key, r) })), nq = planCites(st).length;
  body.innerHTML = `${nq ? `<section class="said"><h4>What its plan says <span>${nq} quote${nq === 1 ? "" : "s"}</span></h4><div class="qlist" id="qlist"><p class="muted">Loading the plan's words…</p></div>
      <div class="qpdf" id="qpdf"></div></section>` : '<p class="note said">From the shared menu: its own plans don\'t include this strategy.</p>'}
    <div class="cards">${[["Evidence", esc(st.grade.toLowerCase().replace("_", " ")), st.harmful ? "evidence of harm" : st.causal ? "causal evidence it saves lives" : "no causal evidence: counts as 0 in the evidence view"],
      ["Best threshold alone", fmt(Math.max(...R.map((r) => r.y))), "deaths averted / yr"], ["In the plan", st.in_plan ? "yes" : "no", st.in_plan && st.plan_rule ? esc(trim(plainRule(ruleLabel(key, st.plan_rule)), 60)) : "menu strategy"],
      ["Coverage", pct(100 * m), m !== 1 ? "of the assumed reach (your setting)" : "of the assumed reach"]]
      .map(([k, v, s]) => `<div class="card"><div class="ck">${k}</div><div class="cv">${v}</div><div class="cs">${s}</div></div>`).join("")}</div>
    <div class="am">${targetsLine(st)}${assignsLine(st)}<p class="tg">Who acts: ${esc(st.lever_owner)} ${chip(st.lever_cite, "")} · all sources ${chip(st.cite)}</p></div>
    <h4>This strategy alone, at every threshold</h4><div class="apath" id="apath"></div>`;
  const ink = css("--text-primary"), col = famColor(st.family);
  Plotly.react("apath", [{ x: R.map((r) => Math.max(0.05, r.x)), y: R.map((r) => r.y), text: R.map((r) => `${esc(r.label)} · ${Math.round(r.days)} days/yr`), type: "scatter", mode: "lines+markers",
      line: { color: col, width: 2 }, marker: { size: R.map((r) => (r.plan ? 15 : 8)), symbol: R.map((r) => (r.plan ? "triangle-up" : "circle")), color: col, line: { color: css("--surface-1"), width: 1 } },
      hovertemplate: "%{text}<br>%{y:.2f} deaths averted/yr · cost %{x:.1f}% of the plan's<extra></extra>" }],
    { margin: { l: 50, r: 10, t: 6, b: 44 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: css("--text-secondary"), size: 11.5 }, showlegend: false,
      xaxis: { type: "log", gridcolor: css("--grid"), title: { text: "Cost, % of the plan's (log)" }, ticksuffix: "%" }, yaxis: { gridcolor: css("--grid"), zerolinecolor: css("--text-muted"), title: { text: "Deaths averted / yr" } },
      hoverlabel: { bgcolor: css("--surface-1"), font: { color: ink } } }, { displayModeBar: false, responsive: true });
  if (nq) fillQuotes(st);
}

// ---------- footer, view, jurisdiction
function renderFoot() {
  const t = S.M.trust, k = t.consistency_kappa;
  $("foot").innerHTML = `<span>Costs are relative tiers, not $ · ⚠ = team assumption</span>
    <span><b>${t.quotes_verified[0]}/${t.quotes_verified[1]}</b> quotes verbatim on their page</span>
    ${k ? `<span>second blind coder κ <b>${k.action_class ?? "–"}</b></span>` : ""}
    <span>${esc(t.coding)}</span><span>harm data ${chip(S.M.harm.cite, "")}</span>`;
}
function renderViews() {
  $("view").innerHTML = Object.keys(VIEW_SHORT).map((v) => `<button role="radio" aria-checked="${v === S.view}" data-view="${v}" title="${esc(S.M.views[v])}">${VIEW_SHORT[v]}</button>`).join("");
  $("view").querySelectorAll("button").forEach((b) => (b.onclick = () => { S.view = b.dataset.view; load(); }));
}
async function load() {
  S.M = await api(`/api/j/${S.j}/studio${S.view ? `?view=${S.view}` : ""}`);
  S.view = S.M.view; S.st = Object.fromEntries(S.M.strategies.map((st) => [st.key, st]));
  if (!S.M.scopes.includes(S.scope)) S.scope = S.M.default_scope;
  if (S.scope === "plan" && !S.M.strategies.some((st) => st.scope === "plan")) S.scope = "menu";   // no measures of its own: show what it could add
  const own = (S.M.docs || []).filter((d) => d.layer === "own").length, inh = (S.M.docs || []).length - own;
  $("doc").textContent = `${S.M.name} · ${own} plan${own === 1 ? "" : "s"} of its own${inh ? ` + ${inh} inherited` : ""}`;
  S.hl = null; renderViews(); renderScope(); renderLeft(); renderFoot(); syncBudget(); drawChart(); renderMix(); renderBrief();
  hash();
  await optimize();
}
function hash() { history.replaceState(null, "", `#${S.j}/${S.view}/${S.scope}${S.analyse?.mode === "mix" ? "/analyse" : ""}`); }
$("jur").onchange = (e) => { location.hash = `#${e.target.value}`; };
$("to-map").onclick = () => { location.hash = `#map/${MS.view || ""}`; };
$("theme").onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (e) {}
  if (document.body.dataset.page === "map") drawMap();
  else if (S.M) { renderLeft(); drawChart(); renderMix(); renderBrief(); if (S.analyse) openAnalyse(S.analyse.mode, S.analyse.key); }
};

// ---------- map (landing page)
const MS = { view: null, focus: "all", rows: null, geo: null, labels: {} };
const LEVEL_TEXT = { state: "states", county: "counties", city: "cities" };
function centroid(f) {
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  const walk = (c) => (typeof c[0] === "number" ? (x0 = Math.min(x0, c[0]), x1 = Math.max(x1, c[0]), y0 = Math.min(y0, c[1]), y1 = Math.max(y1, c[1])) : c.forEach(walk));
  walk(f.geometry.coordinates); return [x0, x1, y0, y1];
}
function focusBox() {
  const fs = MS.geo.features.filter((f) => MS.focus === "all" || f.id.startsWith(MS.focus)), B = fs.map(centroid);
  const x0 = Math.min(...B.map((b) => b[0])), x1 = Math.max(...B.map((b) => b[1])), y0 = Math.min(...B.map((b) => b[2])), y1 = Math.max(...B.map((b) => b[3]));
  const el = $("map"), W0 = el.clientWidth || 800, H0 = el.clientHeight || 600, card = $("mapview").querySelector(".mapcard").getBoundingClientRect();
  const side = W0 >= 700, dx = side ? card.width + 24 : 0, dy = side ? 0 : card.height + 16;     // leave room for the card
  const W = W0 - dx, H = H0 - dy, lat = (y0 + y1) / 2;
  const z = Math.max(1, Math.log2(Math.min((W / 512) * (360 / (x1 - x0)), (H / 512) * (170 / (y1 - y0)))) + 0.4);   // mapbox: 512-px world at zoom 0
  const degPx = 360 / (512 * 2 ** z);
  return { center: { lon: (x0 + x1) / 2 - (dx / 2) * degPx, lat: lat - (dy / 2) * degPx * Math.cos((lat * Math.PI) / 180) }, zoom: z };
}
function hexRgb(h) { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rampAt(scale, t) {
  t = Math.max(0, Math.min(1, t || 0));
  for (let i = 1; i < scale.length; i++) {
    if (t > scale[i][0]) continue;
    const [a, ca] = scale[i - 1], [b, cb] = scale[i], f = (t - a) / (b - a || 1), A = hexRgb(ca), B = hexRgb(cb);
    return `rgb(${A.map((x, k) => Math.round(x + f * (B[k] - x))).join(",")})`;
  }
  return scale[scale.length - 1][1];
}
// the map card: the gap (headline), plan → best (bar), per 100k with its colour and rank (the map's encoding), plans in force
function mapTip(r) {
  const V = r.views[MS.view], n = r.n_docs, rk = MS.rank[r.jurisdiction_id];
  const plans = [n.own && `${n.own} own`, n.county && `${n.county} county`, n.state && `${n.state} state`].filter(Boolean).join(" · ") || "none";
  const tag = r.level === "state" ? "" : n.own ? '<span class="tag own">own plan</span>' : '<span class="tag">no plan of its own</span>';
  return `<div class="th"><b>${esc(r.name)}</b>${tag}</div>
    ${V.gap_y > EPS ? `<div class="tbig"><b>${sign(V.gap_y)}</b><span>more lives / yr, same budget</span></div>`
      : V.best_y <= EPS ? '<div class="tbig"><b class="plain">0</b><span>no measure in this view saves lives here</span></div>' : '<div class="tbig"><b class="plain">≈ best</b><span>plans already near the best mix</span></div>'}
    ${planBar(V.plan_y, V.best_y)}<div class="pbl"><span>today <b>${fmt(V.plan_y)}</b></span><span>best mix <b>${fmt(V.best_y)}</b></span></div>
    <div class="tl"><span class="sw" style="background:${rampAt(MS.scale, V.gap_per100k / MS.zmax)}"></span><span><b>${fmt(V.gap_per100k)}</b> per 100k residents${rk ? ` · #${rk[0]} of ${rk[1]} ${rk[2]}` : ""}</span></div>
    <div class="tm">Plans: ${plans} · ~${fmt(r.temp_deaths_per_yr)} temperature deaths / yr</div>
    <div class="cta">${act}: what to change →</div>`;
}
function drawMap() {
  const v = MS.view, rows = MS.rows, C = rows.filter((r) => r.level === "county"), T = rows.filter((r) => r.level === "city");
  const vals = C.map((r) => r.views[v].gap_per100k).filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b);
  const zmax = Math.max(0.01, vals[Math.floor(0.95 * (vals.length - 1))] || 0.01);
  const scale = [[0, css("--ramp-0")], [0.35, css("--warning")], [0.7, css("--series-2")], [1, css("--critical")]];
  MS.scale = scale; MS.zmax = zmax; MS.byId = Object.fromEntries(rows.map((r) => [r.jurisdiction_id, r])); MS.rank = {};
  for (const [lvl, word] of [["county", "counties"], ["city", "cities"]]) {
    const L = rows.filter((r) => r.level === lvl && (MS.focus === "all" || r.jurisdiction_id.startsWith(MS.focus)) && r.views[v].gap_per100k != null)
      .sort((a, b) => b.views[v].gap_per100k - a.views[v].gap_per100k);
    L.forEach((r, i) => (MS.rank[r.jurisdiction_id] = [i + 1, L.length, word]));
  }
  const own = C.filter((r) => r.n_docs.own > 0), ink = css("--text-primary");
  const cen = Object.fromEntries(MS.geo.features.map((f) => { const b = centroid(f); return [f.id, [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]]; }));
  const traces = [
    { type: "choroplethmapbox", geojson: MS.geo, locations: C.map((r) => r.jurisdiction_id), z: C.map((r) => r.views[v].gap_per100k), zmin: 0, zmax,
      colorscale: scale, marker: { line: { width: 0.4, color: css("--border") }, opacity: 0.85 }, hoverinfo: "none",
      customdata: C.map((r) => r.jurisdiction_id), showscale: false },        // the legend is the ramp in the card
    { type: "choroplethmapbox", geojson: MS.geo, locations: own.map((r) => r.jurisdiction_id), z: own.map(() => 0), colorscale: [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0)"]],
      showscale: false, marker: { line: { width: 2, color: ink } }, hoverinfo: "skip" },
    { type: "scattermapbox", mode: "markers", lon: T.map((r) => (cen[r.parent_id] || [0, 0])[0] + 0.15), lat: T.map((r) => (cen[r.parent_id] || [0, 0])[1] + 0.15),
      marker: { size: 11, color: T.map((r) => r.views[v].gap_per100k), cmin: 0, cmax: zmax, colorscale: scale },
      customdata: T.map((r) => r.jurisdiction_id), hoverinfo: "none", showlegend: false },
  ];
  const box = $("mapview").getBoundingClientRect();                        // size to the container (Plotly's autosize misses it)
  // keyless OpenStreetMap tiles (CARTO styles now need a key)
  const layout = { width: box.width, height: box.height, mapbox: { style: "open-street-map", ...focusBox() }, margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: "rgba(0,0,0,0)",
    showlegend: false, uirevision: MS.focus };
  Plotly.react("map", traces, layout, { displayModeBar: false, responsive: true, scrollZoom: true });
  const el = $("map");
  if (!el._bound) { el._bound = true; bindTip(el, (p) => (p.customdata && MS.byId[p.customdata] ? mapTip(MS.byId[p.customdata]) : null), (p) => { if (p.customdata) location.hash = `#${p.customdata}/${MS.view}/menu`; }); }
  $("ramp-ticks").innerHTML = [0, zmax / 2, zmax].map((t, i) => `<span>${fmt(t)}${i === 2 ? "+" : ""}</span>`).join("");
  const inFocus = rows.filter((r) => r.level !== "state" && (MS.focus === "all" || r.jurisdiction_id.startsWith(MS.focus)) && r.views[v].gap_per100k != null);
  const top = inFocus.sort((a, b) => b.views[v].gap_per100k - a.views[v].gap_per100k).slice(0, 3);
  $("map-top").innerHTML = top.length ? `<div class="tk">Biggest gaps per resident</div>` + top.map((r, i) => `<a href="#${r.jurisdiction_id}/${v}/menu"><span class="n">${i + 1}</span><span class="nm">${esc(r.name)}</span>
      <span class="g">${fmt(r.views[v].gap_per100k)}<small> /100k</small></span><span class="a">+${fmt(r.views[v].gap_y)} lives/yr</span></a>`).join("") : "";
  $("map-key").textContent = `Each county counts every plan in force for its residents: its own, its county's and its state's. Colour is how many more deaths a year that same total budget could avert if it bought the best mix of measures and timings, per 100,000 residents. Outlined counties have plans of their own; dots are cities with plans. Effect view: ${MS.labels[v]}. Click any county for its plans, sources and the full analysis.`;
}
function renderMapControls() {
  const st = MS.rows.filter((r) => r.level === "state");
  $("view").innerHTML = Object.keys(VIEW_SHORT).map((v) => `<button role="radio" aria-checked="${v === MS.view}" data-view="${v}" title="${esc(MS.labels[v])}">${VIEW_SHORT[v]}</button>`).join("");
  $("view").querySelectorAll("button").forEach((b) => (b.onclick = () => { MS.view = b.dataset.view; history.replaceState(null, "", `#map/${MS.view}`); renderMapControls(); drawMap(); }));
  $("map-focus").innerHTML = [["all", "All"], ...st.map((r) => [r.jurisdiction_id, r.name])].map(([k, t]) => `<button role="radio" aria-checked="${k === MS.focus}" data-k="${k}">${esc(t)}</button>`).join("");
  $("map-focus").querySelectorAll("button").forEach((b) => (b.onclick = () => { MS.focus = b.dataset.k; renderMapControls(); drawMap(); }));
}
let JLIST = null;
async function jurisdictionsList() {
  if (JLIST) return JLIST;
  JLIST = await api("/api/jurisdictions");
  const groups = {}; JLIST.forEach((j) => (groups[`${j.state} · ${LEVEL_TEXT[j.level] || j.level}`] ??= []).push(j));
  $("jur").innerHTML = Object.entries(groups).map(([g, L]) => `<optgroup label="${esc(g)}">${L.sort((a, b) => a.name.localeCompare(b.name)).map((j) =>
    `<option value="${j.jurisdiction_id}">${esc(j.name)}${j.n_docs.own ? ` · ${j.n_docs.own} plan${j.n_docs.own === 1 ? "" : "s"}` : ""}</option>`).join("")}</optgroup>`).join("");
  return JLIST;
}
async function showMap(hv) {
  document.body.dataset.page = "map"; $("mapview").hidden = false; $("studio").hidden = true; $("foot").hidden = true; $("analyse").hidden = true;
  $("doc").textContent = ""; $("to-map").hidden = true; $("jur").value = "";
  if (!MS.rows) {
    const [m, g] = await Promise.all([api("/api/map"), fetch("ca_tx_counties.geojson").then((r) => r.json())]);
    MS.rows = m.rows; MS.geo = g; MS.labels = m.views; MS.view = m.default_view;
  }
  if (VIEW_SHORT[hv]) MS.view = hv;
  renderMapControls(); drawMap();
}
async function showStudio(parts) {
  document.body.dataset.page = "studio"; $("mapview").hidden = true; $("studio").hidden = false; $("foot").hidden = false; $("to-map").hidden = false;
  const J = await jurisdictionsList(); const [hj, hv, hsc] = parts, hs = parts.find((p) => p.startsWith("src="));
  if (!J.some((j) => j.jurisdiction_id === hj)) { location.hash = "#map"; return; }
  if (hj !== S.j) { S.j = hj; S.view = null; S.set = {}; S.open.clear(); S.briefMore.clear(); S.M = null; S.F = null; S.sel = null; }
  $("jur").value = S.j;
  if (VIEW_SHORT[hv]) S.view = hv;
  if (SCOPE_RANK[hsc] != null) S.scope = hsc;
  await load();
  if (parts.includes("analyse")) openAnalyse("mix");
  if (hs) openDrawer([decodeURIComponent(hs.slice(4))]);   // shareable link to one source
}
function setAdjust(open) {
  $("studio").dataset.adjust = open ? "open" : "closed"; $("adjust").setAttribute("aria-expanded", String(open));
  try { localStorage.setItem("adjust", open ? "open" : "closed"); } catch (e) {}
  if (S.M) requestAnimationFrame(() => Plotly.Plots.resize("chart"));
}
$("adjust").onclick = () => setAdjust($("studio").dataset.adjust !== "open");
$("alldots").onclick = () => { S.allDots = !S.allDots; $("alldots").setAttribute("aria-pressed", String(S.allDots)); drawChart(); };
function route() {
  hideTip();
  const parts = location.hash.slice(1).split("/");
  if (!parts[0] || parts[0] === "map") showMap(parts[1]); else showStudio(parts);
}
window.addEventListener("hashchange", route);
let rz = null; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (document.body.dataset.page === "map" && MS.rows) drawMap(); }, 150); });
(function init() {
  try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  let adj = "closed"; try { adj = localStorage.getItem("adjust") || adj; } catch (e) {}
  setAdjust(adj === "open");
  route();
})();
