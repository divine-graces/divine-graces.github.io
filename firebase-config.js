// ============================================================
// DIVINE GRACE SCHOOL — Firebase Configuration
// Replace firebaseConfig with YOUR project config from:
// Firebase Console → Project Settings → Your Apps → Web
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCJQhewNr4GW3gOKCqcac9Lrr_mOJmgmAE",
  authDomain: "divine-grace-school-ba415.firebaseapp.com",
  projectId: "divine-grace-school-ba415",
  storageBucket: "divine-grace-school-ba415.firebasestorage.app",
  messagingSenderId: "715765687350",
  appId: "1:715765687350:web:9afff5c2e4a654cd92e497"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ============================================================
// SCHOOL CONSTANTS
// ============================================================
const SCHOOL_NAME    = "Divine Grace School";
const SCHOOL_MOTTO   = "Outstanding Knowledge";
const SCHOOL_LOGO    = "logo.png";
const PIN_SECRET     = 67;

const CLASSES = [
  'Pre Nursery',
  'Nursery 1','Nursery 2','Nursery 3',
  'Basic 1','Basic 2','Basic 3',
  'Basic 4','Basic 5','Basic 6',
  'Basic 7','Basic 8','Basic 9'
];

// ============================================================
// SUBJECTS PER CLASS — Firestore-backed (dynamic)
// Stored as: subjects/{className} → { subjects: [...sorted] }
// Managed from the Admin → Subjects tab.
// ============================================================

// In-memory cache so we don't re-fetch the same class twice
// within a single page session.
const _subjectsCache = {};

async function getSubjectsForClass(className) {
  if (!className) return [];
  if (_subjectsCache[className]) return _subjectsCache[className];
  try {
    const snap = await db.collection('subjects').doc(className).get();
    const list = snap.exists ? (snap.data().subjects || []) : [];
    _subjectsCache[className] = list;
    return list;
  } catch (e) {
    console.error('getSubjectsForClass error:', e);
    return [];
  }
}

// Call this whenever subjects for a class are changed so the
// next call re-fetches from Firestore.
function invalidateSubjectsCache(className) {
  delete _subjectsCache[className];
}

function isNurseryOrLowerPrimary(className) {
  if (!className) return false;
  if (className === 'Pre Nursery') return true;
  if (className.startsWith('Nursery')) return true;
  const num = parseInt(className.replace('Basic ',''));
  return num <= 3;
}

// ============================================================
// ID GENERATION  →  DGS-001-2026
// ============================================================
async function generateStudentId(year) {
  const snap = await db.collection('id_counters').doc(String(year)).get();
  let next = 1;
  if (snap.exists) next = (snap.data().count || 0) + 1;
  await db.collection('id_counters').doc(String(year)).set({ count: next });
  const serial = String(next).padStart(3, '0');
  return `DGS-${serial}-${year}`;
}

// ============================================================
// PIN GENERATION
// PIN = floor((serial × year + SECRET) / 7) → last 4 digits
// ============================================================
function generatePin(serial, year) {
  const num = parseInt(serial);        // e.g. 1
  const raw = Math.floor((num * year + PIN_SECRET) / 7);
  const str = String(raw).slice(-4);   // last 4 digits
  return str.padStart(4, '0');         // pad if < 4 digits
}

// Extract serial number from ID  e.g. "DGS-007-2026" → 7
function serialFromId(id) {
  const parts = id.split('-');
  return parseInt(parts[1]) || 0;
}

function yearFromId(id) {
  const parts = id.split('-');
  return parseInt(parts[2]) || new Date().getFullYear();
}

// ============================================================
// GRADING
// ============================================================

// Nursery – Basic 3 grading
const LOWER_GRADE_SCALE = [
  { min: 90, grade: 'A', comment: 'Outstanding' },
  { min: 80, grade: 'B', comment: 'Excellent' },
  { min: 70, grade: 'C', comment: 'Very Good' },
  { min: 60, grade: 'D', comment: 'Good' },
  { min: 50, grade: 'E', comment: 'Average' },
  { min: 40, grade: 'F', comment: 'Pass' },
  { min: 0,  grade: '',  comment: 'Fail' },
];

// Basic 4 – Basic 9 grading
const UPPER_GRADE_SCALE = [
  { min: 70, grade: 'A', comment: 'Excellent' },
  { min: 60, grade: 'B', comment: 'Very Good' },
  { min: 50, grade: 'C', comment: 'Good' },
  { min: 40, grade: 'D', comment: 'Pass' },
  { min: 0,  grade: 'F', comment: 'Fail' },
];

function getGrade(score, className) {
  const scale = isNurseryOrLowerPrimary(className) ? LOWER_GRADE_SCALE : UPPER_GRADE_SCALE;
  for (const entry of scale) {
    if (score >= entry.min) return { grade: entry.grade, comment: entry.comment };
  }
  return { grade: '', comment: 'Fail' };
}

// Compute total for upper school: CA1(20%) + CA2(20%) + Exam(60%)
function computeTotal(ca1, ca2, exam) {
  const v1 = Math.min(20, Number(ca1) || 0);
  const v2 = Math.min(20, Number(ca2) || 0);
  const v3 = Math.min(60, Number(exam) || 0);
  return Math.round(v1 + v2 + v3);
}

// ============================================================
// STAR RATING HTML
// ============================================================
function starHTML(rating, max = 5) {
  let s = '';
  for (let i = 1; i <= max; i++) {
    s += `<span style="color:${i <= rating ? '#c8963e' : '#ddd'};font-size:1.1rem;">★</span>`;
  }
  return s;
}

// ============================================================
// MISC UTILITIES
// ============================================================
function getCurrentSession() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y+1}` : `${y-1}/${y}`;
}

function calcClassAvg(scores) {
  if (!scores || !scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function showToast(msg, type = 'success') {
  const old = document.querySelector('.dg-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = `dg-toast dg-toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('dg-toast--show'), 10);
  setTimeout(() => { t.classList.remove('dg-toast--show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function showLoading(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
}
