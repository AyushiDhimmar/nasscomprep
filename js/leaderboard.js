// ═══════════════════════════════════════════
//  js/leaderboard.js — Fetch + render leaderboard
//  NasscomPrep · AI-ML Engineer Quiz
// ═══════════════════════════════════════════

import { fetchLeaderboard } from "./firebase.js";
import { fmtTime } from "./quiz.js";

/**
 * Mount leaderboard into a container element
 * @param {HTMLElement} container
 * @param {string|null} currentUid  — highlight the logged-in user's row
 */
export async function mountLeaderboard(container, currentUid = null) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading leaderboard…</p></div>`;

  let rows;
  try {
    rows = await fetchLeaderboard();
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Could not load leaderboard. Check your Firebase config.</p></div>`;
    return;
  }

  if (rows.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🏁</div><p>No scores yet — be the first to complete a quiz!</p></div>`;
    return;
  }

  const medals = ["gold", "silver", "bronze"];
  const rankSyms = ["🥇", "🥈", "🥉"];

  const html = rows.map((r, i) => {
    const rank = i + 1;
    const rankCls = medals[i] || "";
    const isMe = r.uid === currentUid;
    const time = r.timeSecs ? fmtTime(r.timeSecs) : "—";

    return `<div class="lb-row${isMe ? " lb-row-me" : ""}" title="${isMe ? "That's you!" : ""}">
      <span class="lb-rank ${rankCls}">${rank <= 3 ? rankSyms[i] : rank}</span>
      <img class="lb-avatar" src="${r.photo || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(r.name)}" alt="" loading="lazy">
      <div class="lb-info">
        <span class="lb-name">${escHtml(r.name)}${isMe ? ' <span class="badge badge-indigo" style="font-size:.65rem;padding:.15rem .5rem">You</span>' : ""}</span>
        <span class="lb-meta">${r.mode || "quiz"} · ${r.category || "All"} · ${r.total} Qs · ⏱ ${time}</span>
      </div>
      <div class="lb-score" style="color:${pctColor(r.pct)}">${r.pct}%</div>
    </div>`;
  }).join("");

  container.innerHTML = `<div class="lb-list">${html}</div>`;
}

function pctColor(pct) {
  if (pct >= 90) return "var(--gold)";
  if (pct >= 75) return "var(--green)";
  if (pct >= 60) return "var(--indigo-lo)";
  return "var(--red)";
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}