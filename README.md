# ⚡ NasscomPrep — AI-ML Engineer Quiz App

> Full-stack quiz prep webapp with Google Sheets questions,
> Firebase auth, live leaderboard, and personal score history.

---

## Project Structure

```
NasscomPrep/
├── index.html          ← Landing page + Google sign-in
├── quiz.html           ← Main quiz (all modes)
├── leaderboard.html    ← Global leaderboard
├── history.html        ← Your personal score history
│
├── css/
│   ├── base.css        ← CSS variables, reset, typography
│   └── components.css  ← Buttons, cards, nav, quiz components
│
└── js/
    ├── firebase.js     ← Firebase init + auth + Firestore helpers
    ├── sheets.js       ← Google Sheets loader + CSV parser + fallback Qs
    ├── quiz.js         ← Quiz state, scoring, rendering
    ├── leaderboard.js  ← Leaderboard fetch + render
    └── history.js      ← Score history fetch + render
```

---

## ⚙️ Step-by-Step Setup

### 1. Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **Add project** → name it (e.g. "NasscomPrep")
3. Enable **Google Analytics** if you want (optional)

#### Enable Authentication
- Left menu → **Build → Authentication → Get started**
- **Sign-in method** tab → Enable **Google** → Save

#### Enable Firestore
- Left menu → **Build → Firestore Database → Create database**
- Choose **Production mode** → pick your region → Done

#### Get your config
- Left menu → **Project Settings** (gear icon)
- **Your apps** → click **</>** (Web) → register app
- Copy the `firebaseConfig` object
- Paste it into **`js/firebase.js`** replacing the placeholder values

#### Firestore Security Rules
- Firestore → **Rules** tab → replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{docId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

- Click **Publish**

---

### 2. Google Sheet Setup

1. Go to **https://sheets.google.com** → create a new Sheet
2. **Row 1** must have these exact headers (lowercase, with underscores):

| question | option_a | option_b | option_c | option_d | answer | explanation | category |
|---|---|---|---|---|---|---|---|

3. Fill in your questions from **Row 2** onwards:
   - `answer` = **0, 1, 2, or 3** (index of the correct option)
   - `category` = any label, e.g. `AI Fundamentals`, `ML Algorithms`

4. **Publish the sheet:**
   - File → **Share → Publish to web**
   - Select **Sheet1** and **CSV** format → **Publish** → confirm

5. Copy your **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit
   ```

6. Paste it into **`js/sheets.js`** replacing `"YOUR_GOOGLE_SHEET_ID"`

> ✅ That's it! Now any edit to the Sheet updates the quiz automatically — no redeployment.

---

### 3. Deploy (Free Options)

#### Option A — Netlify Drop (easiest, ~30 seconds)
1. Go to **https://app.netlify.com/drop**
2. Drag the entire `NasscomPrep/` folder onto the page
3. You get a live URL like `https://amazing-name-123.netlify.app`

> **Important:** After first deploy, go to **Site settings → Domain management** to set a custom name.
> Also add your Netlify URL to Firebase → Authentication → **Authorised domains**.

#### Option B — GitHub Pages
1. Create a GitHub repo, push the `NasscomPrep/` folder contents into it
2. **Settings → Pages → Deploy from branch: main → / (root)**
3. Live at `https://yourusername.github.io/your-repo`
4. Add this URL to Firebase authorized domains

#### Option C — Vercel
```bash
npm i -g vercel
cd NasscomPrep
vercel
```
Follow prompts → live in ~1 min.

> **After any deployment:** Add your live domain to Firebase Console →
> Authentication → **Sign-in method → Authorised domains → Add domain**

---

## 📊 Adding / Updating Questions

Just open your Google Sheet and:

| Action | How |
|---|---|
| **Add** a question | Add a new row at the bottom |
| **Edit** a question | Click any cell and type |
| **Delete** a question | Delete the row |
| **Add a new category** | Type a new name in the `category` column |

Changes are **live on the next page reload** — no code changes, no redeployment.

---

## 🔥 Firestore Data Structure

```
scores/              ← One doc per quiz session
  {docId}
    uid, name, photo
    mode, category
    total, correct, wrong, pct
    timeSecs
    createdAt

users/               ← One doc per user
  {uid}
    uid, name, email, photo
    joinedAt, lastActiveAt
    totalSessions, bestScore
```

---

## 🎯 Quiz Modes

| Mode | Description |
|---|---|
| **Random 100** | 100 random questions from all categories |
| **All Questions** | Complete question bank |
| **Weak Areas** | Only questions you previously got wrong (saved in browser) |
| **By Round** | 100 questions per round, in fixed order |
| **By Category** | Questions filtered to one topic |

---

## 🛠️ Customisation

| What | Where |
|---|---|
| Colour scheme | `css/base.css` → `:root` variables |
| App name / branding | Each HTML file's `<title>` and `.nav-logo` |
| Number of questions per round | `quiz.html` and `quiz.js` (default: 100) |
| Fallback questions | `js/sheets.js` → `FALLBACK_QUESTIONS` array |
| Leaderboard size | `js/firebase.js` → `fetchLeaderboard()` → change `limit(100)` |

---

## ❓ Troubleshooting

**Sign-in popup blocked?**
→ Allow popups for your domain in browser settings.

**"FirebaseError: auth/unauthorized-domain"**
→ Add your domain to Firebase → Authentication → Authorised domains.

**Questions not loading from Sheet?**
→ Confirm the Sheet is published (File → Share → Publish to web).
→ Check the SHEET_ID in `js/sheets.js` matches your Sheet URL.
→ Make sure Row 1 has the exact header names.

**Scores not saving?**
→ Check Firestore rules allow write for authenticated users.
→ Make sure user is signed in before finishing a quiz.
