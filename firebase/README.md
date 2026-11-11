# Backend setup (Firebase)

The game itself is static, so the backend is **Firebase**: Auth for accounts and
Firestore for the uploaded levels. No server to host, no build step — the page
loads the Firebase SDK from Google's CDN only when a config is present.

Until you fill in a config the game still works: accounts and uploads fall back
to `localStorage`, so the editor and the whole upload flow can be tested in one
browser with no setup.

## 1. Create the project

1. Open the [Firebase console](https://console.firebase.google.com/) and create a
   project (Analytics can stay off).
2. **Build → Authentication → Sign-in method** and enable **Email/Password**.
   Players never see an email — the app maps a username to the internal address
   `username@gdweb.local` — but the provider has to be on.
3. **Build → Firestore Database → Create database**, in production mode, in a
   region near you.

## 2. Publish the security rules

Either paste `firebase/firestore.rules` into **Firestore → Rules → Publish**, or
with the Firebase CLI from the repository root:

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules
```

`firebase.json` in the repository root already points at
`firebase/firestore.rules`.

## 3. Add the web config

**Project settings → General → Your apps → Web (`</>`)** and copy the config
object into [`js/firebase-config.js`](../js/firebase-config.js):

```js
export const FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '...',
  appId: '...',
};
```

These values are public identifiers by design (they are shipped to every
browser). The security rules are what protect the data, so this file is safe to
commit. Do **not** put a service-account key or any admin credential in here.

Commit and push; GitHub Pages serves the new build, and the Account screen will
say “Firebase accounts” instead of “Local accounts”.

## Data model

```
levels/{levelId}
  name         string   displayed name
  author       string   username of the uploader
  authorUid    string   auth uid, used by the rules to gate writes
  difficulty   string   Easy … Demon
  theme        string   palette key
  data         string   the level JSON produced by the editor
  plays        number
  createdAt    timestamp

users/{uid}        { username, createdAt }
usernames/{slug}   { uid }        uniqueness index
```

## Security notes

- Levels are readable by anyone, writable only by their `authorUid`.
- The synthetic email is never shown or collected, and no verification mail is
  sent, so **password reset is not possible** — an account that loses its
  password cannot be recovered. For a hobby sharing site that is the trade-off of
  not asking for an email address.
- Anyone can sign up and upload; add a moderator check in the rules (or a
  `banned/{uid}` doc) if the community grows.
