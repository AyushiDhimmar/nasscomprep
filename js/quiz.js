// ═══════════════════════════════════════════
//  js/quiz.js — Quiz state, scoring, rendering
//  NasscomPrep · AI-ML Engineer Quiz
// ═══════════════════════════════════════════

import { saveScore, saveWrongAnswers } from "./firebase.js";
import { loadQuestions, getCategories } from "./sheets.js";

// ── State ─────────────────────────────────────
export const state = {
  allQ: [],   // all questions loaded
  activeQ: [],   // current session questions
  answered: {},   // { id: chosenIndex }
  correct: 0,
  wrong: 0,
  mode: "random100",   // random100 | section | all | weak | round
  category: "All",
  roundNum: 1,
  startTime: null,
  user: null,
  saved: false,
};

// ── Load questions ────────────────────────────
export async function initQuiz() {
  state.allQ = await loadQuestions();
  return state.allQ;
}

// ── Build a session ───────────────────────────
export function buildSession(mode, category = "All", roundNum = 1) {
  state.mode = mode;
  state.category = category;
  state.roundNum = roundNum;
  state.answered = {};
  state.correct = 0;
  state.wrong = 0;
  state.saved = false;
  state.startTime = Date.now();

  let pool = [...state.allQ];

  // filter by category
  if (category !== "All") {
    pool = pool.filter(q => q.t === category);
  }

  // filter by mode
  if (mode === "random100") {
    state.activeQ = shuffle(pool).slice(0, 100);
  } else if (mode === "all") {
    state.activeQ = pool;
  } else if (mode === "section") {
    state.activeQ = pool; // already filtered by category above
  } else if (mode === "weak") {
    const wrongIds = getWrongIds();
    const weakQ = pool.filter(q => wrongIds.includes(q.id));
    state.activeQ = weakQ.length > 0 ? weakQ : shuffle(pool).slice(0, 100);
  } else if (mode === "round") {
    const start = (roundNum - 1) * 100;
    state.activeQ = state.allQ.slice(start, start + 100);
  }

  return state.activeQ;
}

// ── Answer a question ─────────────────────────
export function answer(id, chosenIdx) {
  if (state.answered[id] !== undefined) return null; // already answered
  const q = state.allQ.find(x => x.id === id);
  if (!q) return null;

  state.answered[id] = chosenIdx;
  const isRight = chosenIdx === q.a;
  if (isRight) state.correct++;
  else state.wrong++;

  persistWrong(id, isRight);
  return isRight;
}

// ── Stats helpers ─────────────────────────────
export function getStats() {
  const total = Object.keys(state.answered).length;
  const pct = total > 0 ? Math.round((state.correct / total) * 100) : 0;
  const elapsed = Math.round((Date.now() - (state.startTime || Date.now())) / 1000);
  return { total, correct: state.correct, wrong: state.wrong, pct, elapsed, outOf: state.activeQ.length };
}

export function getCategories2() {
  return getCategories(state.allQ);
}

// ── Filter helpers ────────────────────────────
export function getFilteredQ(cat = "All", status = "all") {
  let q = cat === "All" ? state.activeQ : state.activeQ.filter(x => x.t === cat);
  if (status === "unanswered") q = q.filter(x => state.answered[x.id] === undefined);
  if (status === "correct") q = q.filter(x => state.answered[x.id] !== undefined && state.answered[x.id] === x.a);
  if (status === "wrong") q = q.filter(x => state.answered[x.id] !== undefined && state.answered[x.id] !== x.a);
  return q;
}

// ── Save session to Firebase ──────────────────
export async function saveSession() {
  if (!state.user || state.saved) return;
  const stats = getStats();
  if (stats.total === 0) return;

  // get IDs of questions answered wrong this session
  const wrongIds = state.activeQ
    .filter(q => state.answered[q.id] !== undefined && state.answered[q.id] !== q.a)
    .map(q => q.id);

  await Promise.all([
    saveScore(state.user, {
      mode: state.mode,
      category: state.category,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      timeSecs: stats.elapsed,
    }),
    saveWrongAnswers(state.user.uid, wrongIds),
  ]);

  state.saved = true;
}

// ── LocalStorage: weak question tracking ─────
function getWrongIds() {
  try { return JSON.parse(localStorage.getItem("np_wrong") || "[]"); }
  catch { return []; }
}

function persistWrong(id, isRight) {
  const ids = new Set(getWrongIds());
  if (!isRight) ids.add(id);
  else ids.delete(id);
  localStorage.setItem("np_wrong", JSON.stringify([...ids]));
}

export function getWeakCount(allQ) {
  const ids = new Set(getWrongIds());
  return allQ.filter(q => ids.has(q.id)).length;
}

// ── Utility ───────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export function gradeInfo(pct) {
  if (pct >= 90) return { emoji: "🏆", label: "Outstanding", color: "var(--gold)" };
  if (pct >= 75) return { emoji: "🎯", label: "Great job", color: "var(--green)" };
  if (pct >= 60) return { emoji: "📚", label: "Keep going", color: "var(--indigo)" };
  return { emoji: "💪", label: "Keep practising", color: "var(--red)" };
}

// ── Render a single question card (shared HTML) ──
export function renderQCard(q) {
  const ans = state.answered[q.id];
  const cardCls = ans !== undefined
    ? (ans === q.a ? "q-card correct-ans" : "q-card wrong-ans")
    : "q-card";

  const opts = q.o.map((o, i) => {
    let cls = "opt";
    if (ans !== undefined) {
      cls += " locked";
      if (i === q.a) cls += " reveal";
      else if (i === ans) cls += " wrong";
    }
    const letter = String.fromCharCode(65 + i);
    return `<div class="${cls}" data-qid="${q.id}" data-idx="${i}">
      <span class="opt-letter">${letter}.</span>
      <span>${o}</span>
    </div>`;
  }).join("");

  const expShow = ans !== undefined ? " show" : "";

  return `<div class="${cardCls}" id="qc-${q.id}">
    <div class="q-top">
      <span class="q-num">Q${q.id}</span>
      <span class="badge badge-indigo">${q.t}</span>
    </div>
    <div class="q-text">${q.q}</div>
    <div class="q-opts">${opts}</div>
    <div class="explanation${expShow}" id="exp-${q.id}">
      <strong>💡 Explanation:</strong> ${q.e || "No explanation provided."}
    </div>
  </div>`;
}