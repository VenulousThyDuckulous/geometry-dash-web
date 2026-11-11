// Accounts and level sharing.
//
// Preferred backend: Firebase (Auth + Firestore). Firebase Auth has no native
// username-only sign-up, so the username is turned into an internal address
// `${slug}@gdweb.local` — the player never sees or needs an email.
//
// If `firebase-config.js` is still empty the exact same API runs against
// localStorage instead, so the editor, accounts and upload flow all work
// offline with no setup.

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.5';
const LOCAL_USERS = 'gdweb.users.v1';
const LOCAL_LEVELS = 'gdweb.levels.v1';
const LOCAL_SESSION = 'gdweb.session.v1';

const readJson = (k, def) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; }
};
const writeJson = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota */ }
};

export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export class Cloud {
  constructor() {
    this.mode = 'local';
    this.user = null;
    this.app = null;
    this.auth = null;
    this.db = null;
    this.fs = null;
    this.ready = null;
    this.listeners = new Set();
  }

  get configured() {
    return !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.user, this.mode);
  }

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!this.configured) {
        const s = readJson(LOCAL_SESSION, null);
        if (s && s.username) this.user = { username: s.username, uid: `local:${s.username}` };
        this.mode = 'local';
        this.emit();
        return this;
      }
      const [{ initializeApp }, auth, fs] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`),
      ]);
      this.app = initializeApp(FIREBASE_CONFIG);
      this.auth = auth.getAuth(this.app);
      this.db = fs.getFirestore(this.app);
      this.fs = fs;
      this.mode = 'firebase';
      await new Promise((resolve) => {
        let first = true;
        auth.onAuthStateChanged(this.auth, (u) => {
          this.user = u ? { uid: u.uid, username: u.displayName || (u.email || '').split('@')[0] } : null;
          this.emit();
          if (first) { first = false; resolve(); }
        });
      });
      return this;
    })();
    return this.ready;
  }

  // ------------------------------------------------------------------ auth
  async signUp(username, password) {
    const slug = slugify(username);
    if (slug.length < 3) throw new Error('Username must be at least 3 characters (a-z, 0-9).');
    if (String(password).length < 6) throw new Error('Password must be at least 6 characters.');
    await this.init();

    if (this.mode === 'local') {
      const users = readJson(LOCAL_USERS, {});
      if (users[slug]) throw new Error('That username is taken.');
      const salt = randomSalt();
      users[slug] = { salt, hash: await hashPassword(password, salt), createdAt: Date.now() };
      writeJson(LOCAL_USERS, users);
      writeJson(LOCAL_SESSION, { username: slug });
      this.user = { uid: `local:${slug}`, username: slug };
      this.emit();
      return this.user;
    }

    const email = `${slug}@gdweb.local`;
    const { createUserWithEmailAndPassword, updateProfile } = await import(`${SDK}/firebase-auth.js`);
    const { doc, setDoc } = this.fs;
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      await updateProfile(cred.user, { displayName: slug });
      await setDoc(doc(this.db, 'users', cred.user.uid), { username: slug, createdAt: Date.now() });
      await setDoc(doc(this.db, 'usernames', slug), { uid: cred.user.uid }).catch(() => {});
      this.user = { uid: cred.user.uid, username: slug };
      this.emit();
      return this.user;
    } catch (e) {
      const msg = String(e.code || e.message || e);
      if (msg.includes('email-already-in-use')) throw new Error('That username is taken.');
      if (msg.includes('weak-password')) throw new Error('Password must be at least 6 characters.');
      if (msg.includes('operation-not-allowed')) throw new Error('Email/password sign-in is not enabled in your Firebase project.');
      throw new Error(msg.replace('auth/', ''));
    }
  }

  async signIn(username, password) {
    const slug = slugify(username);
    await this.init();

    if (this.mode === 'local') {
      const users = readJson(LOCAL_USERS, {});
      const rec = users[slug];
      if (!rec) throw new Error('No account with that username.');
      const hash = await hashPassword(password, rec.salt);
      if (hash !== rec.hash) throw new Error('Wrong password.');
      writeJson(LOCAL_SESSION, { username: slug });
      this.user = { uid: `local:${slug}`, username: slug };
      this.emit();
      return this.user;
    }

    const { signInWithEmailAndPassword } = await import(`${SDK}/firebase-auth.js`);
    try {
      const cred = await signInWithEmailAndPassword(this.auth, `${slug}@gdweb.local`, password);
      this.user = { uid: cred.user.uid, username: cred.user.displayName || slug };
      this.emit();
      return this.user;
    } catch (e) {
      const msg = String(e.code || e.message || e);
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        throw new Error('Wrong username or password.');
      }
      throw new Error(msg.replace('auth/', ''));
    }
  }

  async signOut() {
    await this.init();
    if (this.mode === 'local') writeJson(LOCAL_SESSION, null);
    else {
      const { signOut } = await import(`${SDK}/firebase-auth.js`);
      await signOut(this.auth);
    }
    this.user = null;
    this.emit();
  }

  // ---------------------------------------------------------------- levels
  async upload(level) {
    await this.init();
    if (!this.user) throw new Error('Sign in to upload a level.');
    const name = (level.name || 'Untitled').slice(0, 60);
    const record = {
      name,
      author: this.user.username,
      authorUid: this.user.uid,
      difficulty: level.difficulty || 'Normal',
      theme: level.theme || 'stereo',
      data: JSON.stringify(level),
      plays: 0,
      createdAt: Date.now(),
    };

    if (this.mode === 'local') {
      const all = readJson(LOCAL_LEVELS, []);
      const id = `l${record.createdAt}${Math.random().toString(36).slice(2, 6)}`;
      all.unshift({ id, ...record });
      writeJson(LOCAL_LEVELS, all.slice(0, 100));
      return id;
    }

    const { collection, addDoc, serverTimestamp } = this.fs;
    const ref = await addDoc(collection(this.db, 'levels'), { ...record, createdAt: serverTimestamp() });
    return ref.id;
  }

  async list(limit = 40) {
    await this.init();
    if (this.mode === 'local') {
      return readJson(LOCAL_LEVELS, []).slice(0, limit);
    }
    const { collection, query, orderBy, limit: limitTo, getDocs } = this.fs;
    const q = query(collection(this.db, 'levels'), orderBy('createdAt', 'desc'), limitTo(limit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async remove(id) {
    await this.init();
    if (!this.user) throw new Error('Sign in first.');
    if (this.mode === 'local') {
      const all = readJson(LOCAL_LEVELS, []).filter((l) => l.id !== id || l.authorUid !== this.user.uid);
      writeJson(LOCAL_LEVELS, all);
      return;
    }
    const { doc, deleteDoc } = this.fs;
    await deleteDoc(doc(this.db, 'levels', id));
  }
}

export const cloud = new Cloud();
