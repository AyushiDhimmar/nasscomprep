// ═══════════════════════════════════════════
//  js/firebase.js — Init · Auth · Firestore helpers
//  NasscomPrep · AI-ML Engineer Quiz
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, getDocs, addDoc,
  query, orderBy, limit,
  serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────
// 🔥  PASTE YOUR FIREBASE CONFIG HERE
//  Firebase Console → Project Settings → Your Apps → Web
// ─────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ── Init ──────────────────────────────────────
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ═══════════════════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════════════════

/** Sign in with Google popup */
export async function signInGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    await upsertUser(result.user);
    return result.user;
  } catch (e) {
    console.error("Sign-in error:", e);
    throw e;
  }
}

/** Sign out */
export async function logOut() {
  await signOut(auth);
}

/** Listen for auth state changes */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Upsert user profile in Firestore + save login history */
async function upsertUser(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
      joinedAt: serverTimestamp(),
      totalSessions: 0,
      bestScore: 0,
    });
  }

  // ── Save login history entry ──
  const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Mobile" : "Desktop";

  await addDoc(collection(db, "loginHistory"), {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    photo: user.photoURL,
    device,
    loginAt: serverTimestamp(),
  });
}

/**
 * Save wrong question IDs for admin analytics
 * @param {string} uid
 * @param {number[]} wrongIds
 */
export async function saveWrongAnswers(uid, wrongIds) {
  if (!wrongIds || wrongIds.length === 0) return;
  await addDoc(collection(db, "wrongAnswers"), {
    uid,
    questionIds: wrongIds,
    createdAt: serverTimestamp(),
  });
}

// ═══════════════════════════════════════════
//  SCORE HELPERS
// ═══════════════════════════════════════════

/**
 * Save a completed quiz session
 * @param {object} user   - Firebase user object
 * @param {object} data   - { mode, category, total, correct, wrong, timeSecs }
 */
export async function saveScore(user, data) {
  const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;

  // add to scores collection (for leaderboard)
  await addDoc(collection(db, "scores"), {
    uid: user.uid,
    name: user.displayName,
    photo: user.photoURL,
    mode: data.mode,
    category: data.category || "All",
    total: data.total,
    correct: data.correct,
    wrong: data.wrong,
    pct,
    timeSecs: data.timeSecs || 0,
    createdAt: serverTimestamp(),
  });

  // update user best score
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const best = snap.data().bestScore || 0;
    await setDoc(userRef, {
      totalSessions: (snap.data().totalSessions || 0) + 1,
      bestScore: Math.max(best, pct),
      lastActiveAt: serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Fetch global leaderboard (top 20 by best pct per user)
 * Returns array sorted by highest pct, then quickest time
 */
export async function fetchLeaderboard() {
  const q = query(
    collection(db, "scores"),
    orderBy("pct", "desc"),
    orderBy("timeSecs", "asc"),
    limit(100)
  );
  const snap = await getDocs(q);
  const rows = [];
  const seen = new Set();
  snap.forEach(d => {
    const data = d.data();
    if (!seen.has(data.uid)) {
      seen.add(data.uid);
      rows.push({ id: d.id, ...data });
    }
  });
  return rows.slice(0, 20);
}

/**
 * Fetch score history for one user (most recent 50)
 */
export async function fetchHistory(uid) {
  const q = query(
    collection(db, "scores"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  return rows;
}

/**
 * Fetch user profile doc
 */
export async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}