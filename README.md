# EarningX — Telegram Rewarded Ads Mini App

EarningX is a production-ready, full-featured Telegram Rewarded Ads Mini App built with **Telegram WebApp SDK**, **Firebase Authentication**, **Cloud Firestore**, **AdsGram**, and **Monetag**. Users earn coins by completing rewarded video tasks, claiming daily check-in rewards, and inviting friends. The app includes a responsive **Admin Control Panel** for live ad network orchestration, user balance management, anti-fraud enforcement, and emergency maintenance controls.

---

## 📁 Project File Structure

```text
├── index.html          # Main Telegram Mini App (Home, Tasks, Referral, History, Profile)
├── admin.html          # Admin Panel (Dashboard, User Management, Ads/App Settings, Ledger)
├── app.js              # Client application logic & Telegram WebApp handling
├── admin.js            # Admin controller, live metrics, balance adjustments, setting sync
├── firebase.js         # Firebase initialization, centralized atomic transactions, Firestore rules
├── firestore.rules     # Cloud Firestore security rules
├── styles.css          # Premium dark-navy responsive styles & glassmorphic UI
├── package.json        # Dependencies & build scripts
├── vite.config.ts      # Multi-page Vite configuration (builds index.html and admin.html)
└── README.md           # Setup, architecture, limitations, and deployment guide
```

---

## 🔒 Security Architecture & Centralized Authorization

In this client-side Telegram WebApp environment:
1. **Centralized Reward Authorization (`firebase.js`):**
   - The user application does **NOT** pass arbitrary reward amounts to Firestore.
   - The `claimAdReward(uid, telegramId, network)` method executes inside a Firestore atomic `runTransaction`.
   - It reads the authorized reward amount and daily limits directly from `settings/app` on the server/Firestore side.
   - It checks whether the user is blocked, checks maintenance mode, validates cooldown intervals, enforces calendar day limits, increments `balance`, `totalEarned`, `todayEarned`, and `todayAds`, and writes an immutable audit log to `transactions/{txId}`.
2. **Client-Only Architecture Limitation & Production Hardening:**
   - Both AdsGram and Monetag SDKs resolve client-side JavaScript promises when an ad is completed.
   - While client tampering with coin reward amounts is strictly prevented by our centralized Firestore transaction logic, determined adversaries with debugger tools could simulate SDK promise resolutions.
   - **Production Recommendation:** For high-volume production deployments with cash payouts, enable AdsGram Server-to-Server (S2S) postback rewards and Monetag postbacks backed by Cloud Functions or an Express webhook endpoint verifying cryptographic signatures before credit.

---

## 🚀 Firebase Configuration

Connected to the exact Firebase project:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDdyox_3aRlxrp6lTFeHD65iCNLvu9Azgs",
  authDomain: "earningx-61eb4.firebaseapp.com",
  databaseURL: "https://earningx-61eb4-default-rtdb.firebaseio.com",
  projectId: "earningx-61eb4",
  storageBucket: "earningx-61eb4.firebasestorage.app",
  messagingSenderId: "156284594962",
  appId: "1:156284594962:web:f4534c0d121af0067921cb",
  measurementId: "G-YTKSMHH84E"
};
```

---

## 🛠️ Step-by-Step Setup Instructions

### 1. Firebase Console Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and navigate to project `earningx-61eb4`.
2. **Authentication:**
   - Enable **Anonymous Authentication** (for Telegram users).
   - Enable **Email/Password Authentication** (for administrators).
3. **Cloud Firestore:**
   - Create a Firestore database in default/production mode.
   - Copy the contents of `firestore.rules` into the **Rules** tab and click **Publish**.

### 2. Admin Account Setup
1. In Firebase Console -> **Authentication** -> **Users**, click **Add User**.
2. Enter your admin email (e.g., `admin@earningx.com`) and a strong password.
3. Copy the created `User UID`.
4. In Firestore -> Create a document at path:
   ```text
   admins/{UID}
   ```
   With document fields:
   ```json
   {
     "role": "admin",
     "email": "admin@earningx.com",
     "createdAt": "<server timestamp>"
   }
   ```
5. Log in at `https://<YOUR_DOMAIN>/admin.html` with this email and password.

### 3. Telegram BotFather Mini App Setup
1. In Telegram, open `@BotFather` and run `/newbot`.
2. Name your bot (e.g., `EarningX Bot`) and choose a username (e.g., `EarningXOfficialBot`).
3. Run `/newapp` to create a Telegram Mini App:
   - Select your bot.
   - Enter title: `EarningX`.
   - Enter description: `Watch rewarded ads to earn coins!`.
   - Upload a 640x360 photo.
   - Enter your HTTPS Web App URL (e.g., `https://your-app.web.app` or Cloud Run URL).
   - Choose a short name (e.g., `app`).
4. Users can now launch the app via:
   - `https://t.me/<BOT_USERNAME>/app`
   - With referral: `https://t.me/<BOT_USERNAME>/app?startapp=REF_<TG_ID>`

### 4. AdsGram Setup
1. Register your Telegram Mini App on the [AdsGram Dashboard](https://adsgram.ai).
2. Create a **Rewarded Video Interstitial** placement.
3. Copy your **Block ID** (Default in project: `52203`).
4. Open the EarningX Admin Panel -> **Ad & App Settings** -> Enter your Block ID and click **Save All Changes**.

### 5. Monetag Setup
1. Register on [Monetag](https://monetag.com).
2. Create a **Rewarded / In-App Interstitial** zone for your domain.
3. Copy your **Zone ID** (Default in project: `11950607`).
4. In Admin Panel -> **Ad & App Settings** -> Enter your Zone ID and click **Save All Changes**.

---

## 🌐 HTTPS Deployment Instructions

Telegram WebApp, AdsGram, and Monetag **strictly require HTTPS**.

### Option A: Firebase Hosting
```bash
npm run build
firebase login
firebase init hosting
# Choose existing project earningx-61eb4, public folder 'dist'
firebase deploy --only hosting
```

### Option B: Vercel
```bash
npm i -g vercel
vercel
# Build Command: npm run build
# Output Directory: dist
```

### Option C: Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## ✅ Final Testing Checklist

- [x] Telegram WebApp auto-detection and graceful browser preview simulation.
- [x] Firebase Anonymous auth for normal users; Email/Password for Admins.
- [x] Real-time Firestore sync on balance, counters, transactions, and settings.
- [x] Centralized reward authorization preventing client-manipulated reward amounts.
- [x] Daily calendar limit resets (`todayAds`, `todayEarned`, `todayAdsgram`, `todayMonetag`).
- [x] Cooldown enforcement between ad views (default 5s).
- [x] Daily login bonus claimable once per calendar day.
- [x] Referral code generation, clipboard copy, Telegram direct share link, and referrer reward attribution.
- [x] 5 Working tabs: Home, Tasks, Referral, History, Profile.
- [x] Admin Dashboard metrics (Total Users, Active Today, Total Ads, Total Rewards, Today's Ads, Today's Rewards).
- [x] Admin User Management (search, view, block/unblock, add/deduct balance with audit trail).
- [x] Admin Ad Settings (mode: both, adsgram, monetag, disabled; Block ID, Zone ID, payouts, daily limits).
- [x] Admin App Settings (app name, announcement broadcast, min withdrawal, maintenance mode).
- [x] Emergency Maintenance Mode banner disabling user claims in real-time.
- [x] Custom toasts and confirmation modals (no browser `alert()` or `confirm()`).
- [x] Strict Firestore rules preventing privilege escalation or unauthorized data modification.
