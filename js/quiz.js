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
// BUG 7 FIX: guard zero total before saving
// BUG 11 FIX: throws on error so quiz.html can show toast
export async function saveSession() {
  if (!state.user || state.saved) return;
  const stats = getStats();
  if (stats.total === 0) return; // nothing answered — don't save

  const wrongIds = state.activeQ
    .filter(q => state.answered[q.id] !== undefined && state.answered[q.id] !== q.a)
    .map(q => q.id);

  // throws on Firestore failure — caller handles toast
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

// ── Seeded shuffle — consistent per user+question within a session ──
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Numeric seed from uid + question id
function makeSeed(uid, qid) {
  const str = (uid || "guest") + "_" + qid;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Get scrambled order for a question (returns array of original indices)
// e.g. [2,0,3,1] means: show option2 first, option0 second, etc.
export function getScrambledOrder(q) {
  const uid = state.user?.uid || "guest";
  const seed = makeSeed(uid, q.id);
  return seededShuffle([0, 1, 2, 3], seed);
}

// ── Render a single question card ──
export function renderQCard(q) {
  // scrambledOrder[i] = original index of option shown at position i
  const scrambledOrder = getScrambledOrder(q);

  // What original index did user answer? (stored in state.answered)
  const answeredOrigIdx = state.answered[q.id]; // undefined if not answered yet

  // Is the answer correct?
  const isCorrect = answeredOrigIdx === q.a;

  // Card border colour
  const cardCls = answeredOrigIdx !== undefined
    ? (isCorrect ? "q-card correct-ans" : "q-card wrong-ans")
    : "q-card";

  const opts = scrambledOrder.map((origIdx, displayPos) => {
    let cls = "opt";

    if (answeredOrigIdx !== undefined) {
      // question has been answered — lock all options
      cls += " locked";
      if (origIdx === q.a) {
        // this is the correct option — always highlight green
        cls += " reveal";
      } else if (origIdx === answeredOrigIdx) {
        // this is what the user clicked and it was wrong
        cls += " wrong";
      }
    }

    const letter = String.fromCharCode(65 + displayPos);

    // data-idx stores the ORIGINAL index so answer() works correctly
    return `<div class="${cls}" data-qid="${q.id}" data-idx="${origIdx}">
      <span class="opt-letter">${letter}.</span>
      <span>${q.o[origIdx]}</span>
    </div>`;
  }).join("");

  const expShow = answeredOrigIdx !== undefined ? " show" : "";

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