// ═══════════════════════════════════════════
//  js/history.js — User score history
//  NasscomPrep · AI-ML Engineer Quiz
// ═══════════════════════════════════════════

import { fetchHistory, fetchUserProfile } from "./firebase.js";
import { fmtTime, gradeInfo } from "./quiz.js";

/**
 * Mount score history into a container element
 * @param {HTMLElement} container
 * @param {object}      user   — Firebase user
 */
export async function mountHistory(container, user) {
  if (!user) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>Sign in to see your history.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading your history…</p></div>`;

  let rows, profile;
  try {
    [rows, profile] = await Promise.all([
      fetchHistory(user.uid),
      fetchUserProfile(user.uid),
    ]);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Could not load history. Check your Firebase config.</p></div>`;
    return;
  }

  if (rows.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No sessions yet. Complete a quiz to see your history here.</p></div>`;
    return;
  }

  // ── Summary cards ──
  const totalSessions = profile?.totalSessions || rows.length;
  const bestScore = profile?.bestScore || Math.max(...rows.map(r => r.pct || 0));
  const avgScore = Math.round(rows.reduce((s, r) => s + (r.pct || 0), 0) / rows.length);
  const totalQ = rows.reduce((s, r) => s + (r.total || 0), 0);

  const summaryHtml = `
    <div class="stat-row" style="margin-bottom:1.5rem">
      <div class="stat-tile">
        <div class="stat-tile-val" style="color:var(--indigo-lo)">${totalSessions}</div>
        <div class="stat-tile-label">Sessions</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-val" style="color:var(--gold)">${bestScore}%</div>
        <div class="stat-tile-label">Best Score</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-val" style="color:var(--green)">${avgScore}%</div>
        <div class="stat-tile-label">Average</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-val" style="color:var(--violet)">${totalQ}</div>
        <div class="stat-tile-label">Questions Answered</div>
      </div>
    </div>`;

  // ── History rows ──
  const histHtml = rows.map(r => {
    const g = gradeInfo(r.pct || 0);
    const time = r.timeSecs ? fmtTime(r.timeSecs) : "—";
    const date = r.createdAt?.toDate
      ? r.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    return `<div class="hist-row">
      <div class="hist-grade" style="color:${g.color}">${g.emoji}</div>
      <div class="hist-info">
        <span class="hist-mode">${r.mode || "quiz"} · ${r.category || "All"}</span>
        <span class="hist-meta">${r.total} Qs answered · ${r.correct} correct · ⏱ ${time} · ${date}</span>
      </div>
      <div class="hist-pct" style="color:${g.color}">${r.pct}%</div>
    </div>`;
  }).join("");

  container.innerHTML = summaryHtml + `<div class="hist-list">${histHtml}</div>`;
}