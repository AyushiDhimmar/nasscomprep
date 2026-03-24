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

// ── Firebase Config ───────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAD0A7e88MbDU4kjidg0iDSJ2aoQNaZtyQ",
  authDomain: "nasscomprep.firebaseapp.com",
  projectId: "nasscomprep",
  storageBucket: "nasscomprep.firebasestorage.app",
  messagingSenderId: "280841749276",
  appId: "1:280841749276:web:af35389af00c18e87df0d9",
  measurementId: "G-X5MD27J4HG"
};

// ── Init ──────────────────────────────────────
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ═══════════════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════════════

// BUG 8 FIX: upsertUser is ONLY called here inside signInWithPopup
// NOT inside onAuthStateChanged — so login history saves only on
// actual sign-in clicks, not on every page refresh.
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

export async function logOut() {
  await signOut(auth);
}

// onAuth does NOT call upsertUser — no login history on refresh
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

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

// ═══════════════════════════════════════
//  SCORE HELPERS
// ═══════════════════════════════════════

// BUG 7 FIX: returns false if total === 0, throws on Firestore error
// BUG 11 FIX: throws error so caller can show toast
export async function saveScore(user, data) {
  if (!data.total || data.total === 0) return false;
  const pct = Math.round((data.correct / data.total) * 100);
  try {
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
    return true;
  } catch (e) {
    console.error("saveScore error:", e);
    throw e;
  }
}

// BUG 11 FIX: throws on failure
export async function saveWrongAnswers(uid, wrongIds) {
  if (!wrongIds || wrongIds.length === 0) return;
  try {
    await addDoc(collection(db, "wrongAnswers"), {
      uid,
      questionIds: wrongIds,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("saveWrongAnswers error:", e);
    throw e;
  }
}

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

export async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}