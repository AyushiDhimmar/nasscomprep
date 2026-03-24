// ═══════════════════════════════════════════
//  js/sheets.js — Question loader
//  Now uses questions.js instead of Google Sheets
//  NasscomPrep · AI-ML Engineer Quiz
// ═══════════════════════════════════════════

import { QUESTIONS } from "./questions.js";

// Returns all questions from questions.js
export async function loadQuestions() {
  return QUESTIONS;
}

// Force-refresh (no-op now, kept for compatibility)
export function clearCache() { }

// Get all unique categories — BUG 6 FIX: sorted alphabetically for consistent order
export function getCategories(questions) {
  const cats = [...new Set(questions.map(q => q.t).filter(Boolean))].sort();
  return ["All", ...cats];
}

// Fallback (not used anymore — kept for compatibility)
export const FALLBACK_QUESTIONS = QUESTIONS;