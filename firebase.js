/**
 * EarningX - Firebase Configuration & SDK Helpers
 * Connected to Firebase Project: earningx-61eb4
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  onSnapshot, 
  serverTimestamp, 
  increment,
  runTransaction
} from 'firebase/firestore';

// Exact Firebase project configuration specified
export const firebaseConfig = {
  apiKey: "AIzaSyDdyox_3aRlxrp6lTFeHD65iCNLvu9Azgs",
  authDomain: "earningx-61eb4.firebaseapp.com",
  databaseURL: "https://earningx-61eb4-default-rtdb.firebaseio.com",
  projectId: "earningx-61eb4",
  storageBucket: "earningx-61eb4.firebasestorage.app",
  messagingSenderId: "156284594962",
  appId: "1:156284594962:web:f4534c0d121af0067921cb",
  measurementId: "G-YTKSMHH84E"
};

// Initialize Firebase
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Default Application Settings
export const DEFAULT_SETTINGS = {
  appName: "EarningX",
  announcementMessage: "Welcome to EarningX! Watch sponsored ads to earn coins daily.",
  minWithdrawal: 500,
  adsEnabled: true,
  adNetworkMode: "both", // "adsgram" | "monetag" | "both" | "disabled"
  adsgramEnabled: true,
  adsgramBlockId: "52203",
  adsgramReward: 10,
  adsgramDailyLimit: 20,
  monetagEnabled: true,
  monetagZoneId: "11950607",
  monetagReward: 10,
  monetagDailyLimit: 20,
  rewardedAdsEnabled: true,
  adCooldownSeconds: 5,
  dailyBonus: 25,
  referralReward: 20,
  maintenanceMode: false,
  maintenanceMessage: "EarningX is temporarily under maintenance for server upgrades. Please check back shortly!"
};

// Helper: Get today's ISO date string (YYYY-MM-DD)
export function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * -------------------------------------------------------------
 * SETTINGS MANAGEMENT
 * -------------------------------------------------------------
 */

// Fetch settings once, initializing if not present
export async function getAppSettings() {
  try {
    const settingsRef = doc(db, 'settings', 'app');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() };
    } else {
      // First time initialization in Firestore
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    console.warn("Could not fetch remote settings, using defaults:", error);
    return DEFAULT_SETTINGS;
  }
}

// Subscribe to real-time settings changes
export function subscribeAppSettings(callback) {
  const settingsRef = doc(db, 'settings', 'app');
  return onSnapshot(settingsRef, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snap.data() });
    } else {
      callback(DEFAULT_SETTINGS);
    }
  }, (error) => {
    console.error("Settings subscription error:", error);
    callback(DEFAULT_SETTINGS);
  });
}

// Admin: Save updated settings to settings/app
export async function saveAppSettings(newSettings) {
  const settingsRef = doc(db, 'settings', 'app');
  await setDoc(settingsRef, {
    ...newSettings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * -------------------------------------------------------------
 * AUTHENTICATION
 * -------------------------------------------------------------
 */

export async function loginAnonymously() {
  return await signInAnonymously(auth);
}

export async function loginAdminWithEmail(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  return await signOut(auth);
}

/**
 * -------------------------------------------------------------
 * USER PROFILE & TELEGRAM SYNC
 * -------------------------------------------------------------
 */

export async function syncTelegramUser(uid, tgUser, startParam) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const todayStr = getTodayDateString();

  if (!snap.exists()) {
    // Generate clean referral code based on Telegram ID or random alphanumeric
    const tgId = tgUser?.id ? String(tgUser.id) : uid.substring(0, 8);
    const referralCode = `REF_${tgId}`;

    const newUser = {
      uid: uid,
      telegramId: tgUser?.id || tgId,
      firstName: tgUser?.first_name || 'Telegram',
      lastName: tgUser?.last_name || 'User',
      username: tgUser?.username || '',
      photoUrl: tgUser?.photo_url || '',
      balance: 0,
      totalEarned: 0,
      todayEarned: 0,
      totalAds: 0,
      todayAds: 0,
      todayAdsgram: 0,
      todayMonetag: 0,
      lastAdDate: todayStr,
      lastAdAt: null,
      lastDailyBonus: '',
      referralCode: referralCode,
      referredBy: null,
      blocked: false,
      isBlocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Process referral if startParam is provided and not self
    if (startParam && startParam !== referralCode) {
      newUser.referredBy = startParam;
      // Trigger referral reward asynchronously
      triggerReferralBonus(startParam, uid, newUser);
    }

    await setDoc(userRef, newUser);
    return newUser;
  } else {
    // Existing user: check if today's ad counter needs calendar reset
    const data = snap.data();
    const updates = {
      updatedAt: serverTimestamp()
    };

    // Ensure uid field exists
    if (!data.uid) updates.uid = uid;

    // Update profile info if changed
    if (tgUser?.first_name && tgUser.first_name !== data.firstName) updates.firstName = tgUser.first_name;
    if (tgUser?.last_name && tgUser.last_name !== data.lastName) updates.lastName = tgUser.last_name;
    if (tgUser?.username && tgUser.username !== data.username) updates.username = tgUser.username;
    if (tgUser?.photo_url && tgUser.photo_url !== data.photoUrl) updates.photoUrl = tgUser.photo_url;

    // Reset daily counters if calendar date has changed
    if (data.lastAdDate !== todayStr) {
      updates.todayAds = 0;
      updates.todayEarned = 0;
      updates.todayAdsgram = 0;
      updates.todayMonetag = 0;
      updates.lastAdDate = todayStr;
    }

    await updateDoc(userRef, updates);
    return { ...data, ...updates };
  }
}

// Real-time subscription to user profile
export function subscribeUserProfile(uid, callback) {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const todayStr = getTodayDateString();
      // Reset today stats in memory if calendar date rolled over
      if (data.lastAdDate !== todayStr) {
        data.todayAds = 0;
        data.todayEarned = 0;
        data.todayAdsgram = 0;
        data.todayMonetag = 0;
      }
      callback(data);
    } else {
      callback(null);
    }
  }, (err) => {
    console.error("User subscription error:", err);
  });
}

/**
 * -------------------------------------------------------------
 * REWARDS & TRANSACTIONS (CENTRALIZED AUTHORIZATION)
 * -------------------------------------------------------------
 */

/**
 * Atomic Ad Reward Execution
 * Note: The reward amount is strictly loaded from settings/app inside the transaction
 * and is NEVER trusted from client input!
 */
export async function claimAdReward(uid, telegramId, network) {
  const userRef = doc(db, 'users', uid);
  const settingsRef = doc(db, 'settings', 'app');
  const txRef = doc(collection(db, 'transactions'));
  const todayStr = getTodayDateString();

  return await runTransaction(db, async (transaction) => {
    // 1. Fetch authorized settings
    const settingsDoc = await transaction.get(settingsRef);
    const settings = settingsDoc.exists() ? settingsDoc.data() : DEFAULT_SETTINGS;

    if (settings.maintenanceMode) {
      throw new Error(settings.maintenanceMessage || "Maintenance mode is active. Ads are temporarily paused.");
    }

    if (!settings.adsEnabled || !settings.rewardedAdsEnabled || settings.adNetworkMode === 'disabled') {
      throw new Error("Rewarded ads are currently disabled by the administrator.");
    }

    if (settings.adNetworkMode === 'adsgram' && network !== 'adsgram') {
      throw new Error("Only AdsGram is currently active.");
    }
    if (settings.adNetworkMode === 'monetag' && network !== 'monetag') {
      throw new Error("Only Monetag is currently active.");
    }

    // Determine authorized reward & daily limit from server settings
    const authorizedReward = network === 'adsgram' 
      ? Number(settings.adsgramReward || 10) 
      : Number(settings.monetagReward || 10);

    const maxDailyLimit = network === 'adsgram'
      ? Number(settings.adsgramDailyLimit || 20)
      : Number(settings.monetagDailyLimit || 20);

    // 2. Fetch user document
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("User record not found");
    }
    const userData = userDoc.data();
    if (userData.blocked || userData.isBlocked) {
      throw new Error("This account is blocked by the administrator.");
    }

    // 3. Calendar reset check
    const isNewDay = userData.lastAdDate !== todayStr;
    const currentTodayAds = isNewDay ? 0 : (userData.todayAds || 0);
    const currentTodayEarned = isNewDay ? 0 : (userData.todayEarned || 0);
    const currentTodayAdsgram = isNewDay ? 0 : (userData.todayAdsgram || 0);
    const currentTodayMonetag = isNewDay ? 0 : (userData.todayMonetag || 0);

    // 4. Verify daily limits
    if (network === 'adsgram' && currentTodayAdsgram >= maxDailyLimit) {
      throw new Error("AdsGram daily limit reached for today.");
    }
    if (network === 'monetag' && currentTodayMonetag >= maxDailyLimit) {
      throw new Error("Monetag daily limit reached for today.");
    }

    // 5. Verify cooldown if lastAdAt is present
    const cooldownSeconds = Number(settings.adCooldownSeconds || 5);
    if (userData.lastAdAt && cooldownSeconds > 0) {
      let lastTime = 0;
      if (userData.lastAdAt.toMillis) lastTime = userData.lastAdAt.toMillis();
      else if (userData.lastAdAt.seconds) lastTime = userData.lastAdAt.seconds * 1000;
      else if (typeof userData.lastAdAt === 'string') lastTime = new Date(userData.lastAdAt).getTime();

      const elapsedSec = (Date.now() - lastTime) / 1000;
      if (elapsedSec < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - elapsedSec);
        throw new Error(`Cooldown active. Please wait ${remaining}s.`);
      }
    }

    const newTodayAdsgram = network === 'adsgram' ? currentTodayAdsgram + 1 : currentTodayAdsgram;
    const newTodayMonetag = network === 'monetag' ? currentTodayMonetag + 1 : currentTodayMonetag;

    // 6. Update user stats atomically
    transaction.update(userRef, {
      balance: increment(authorizedReward),
      totalEarned: increment(authorizedReward),
      todayEarned: currentTodayEarned + authorizedReward,
      totalAds: increment(1),
      todayAds: currentTodayAds + 1,
      todayAdsgram: newTodayAdsgram,
      todayMonetag: newTodayMonetag,
      lastAdDate: todayStr,
      lastAdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 7. Create Transaction Record
    const networkName = network === 'adsgram' ? 'AdsGram' : 'Monetag';
    transaction.set(txRef, {
      uid: uid,
      userId: uid,
      telegramId: telegramId || userData.telegramId || '',
      type: 'ad_reward',
      network: network,
      amount: authorizedReward,
      description: `${networkName} rewarded ad`,
      referenceId: txRef.id,
      createdAt: serverTimestamp()
    });

    return {
      success: true,
      reward: authorizedReward,
      network: network,
      newBalance: (userData.balance || 0) + authorizedReward
    };
  });
}

// Daily Login Bonus Claim (Server-authorized reward amount)
export async function claimDailyBonus(uid, telegramId) {
  const userRef = doc(db, 'users', uid);
  const settingsRef = doc(db, 'settings', 'app');
  const txRef = doc(collection(db, 'transactions'));
  const todayStr = getTodayDateString();

  return await runTransaction(db, async (transaction) => {
    // 1. Fetch authorized daily bonus from settings
    const settingsDoc = await transaction.get(settingsRef);
    const settings = settingsDoc.exists() ? settingsDoc.data() : DEFAULT_SETTINGS;

    if (settings.maintenanceMode) {
      throw new Error(settings.maintenanceMessage || "Maintenance in progress.");
    }

    const bonusAmount = Number(settings.dailyBonus || 25);

    // 2. Fetch user
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("User record not found");
    }
    const userData = userDoc.data();
    if (userData.blocked || userData.isBlocked) {
      throw new Error("Account is blocked.");
    }

    if (userData.lastDailyBonus === todayStr) {
      throw new Error("Daily bonus already claimed for today. Please return tomorrow!");
    }

    const isNewDay = userData.lastAdDate !== todayStr;
    const currentTodayEarned = isNewDay ? 0 : (userData.todayEarned || 0);

    transaction.update(userRef, {
      balance: increment(bonusAmount),
      totalEarned: increment(bonusAmount),
      todayEarned: currentTodayEarned + bonusAmount,
      lastDailyBonus: todayStr,
      updatedAt: serverTimestamp()
    });

    transaction.set(txRef, {
      uid: uid,
      userId: uid,
      telegramId: telegramId || userData.telegramId || '',
      type: 'daily_bonus',
      network: 'system',
      amount: bonusAmount,
      description: 'Daily login bonus',
      referenceId: txRef.id,
      createdAt: serverTimestamp()
    });

    return {
      success: true,
      amount: bonusAmount,
      newBalance: (userData.balance || 0) + bonusAmount
    };
  });
}

// Process Referral Reward
async function triggerReferralBonus(referralCode, newUid, newUser) {
  try {
    const settings = await getAppSettings();
    const reward = Number(settings.referralReward) || 20;

    // Query for user with matching referralCode
    const q = query(collection(db, 'users'), where('referralCode', '==', referralCode), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const referrerDoc = snap.docs[0];
      const referrerUid = referrerDoc.id;
      const referrerData = referrerDoc.data();

      // Prevent self referral
      if (referrerUid === newUid) return;

      const referrerRef = doc(db, 'users', referrerUid);
      const txRef = doc(collection(db, 'transactions'));

      await updateDoc(referrerRef, {
        balance: increment(reward),
        totalEarned: increment(reward),
        totalReferrals: increment(1),
        updatedAt: serverTimestamp()
      });

      await setDoc(txRef, {
        uid: referrerUid,
        userId: referrerUid,
        telegramId: referrerData.telegramId || '',
        type: 'referral_reward',
        network: 'system',
        amount: reward,
        description: `Referral reward for inviting @${newUser.username || newUser.firstName || 'User'}`,
        referenceId: txRef.id,
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Error crediting referral bonus:", err);
  }
}

// User Transactions Subscription
export function subscribeUserTransactions(uid, callback, maxLimit = 50) {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(maxLimit)
  );

  return onSnapshot(q, (snapshot) => {
    const txs = [];
    snapshot.forEach((docSnap) => {
      txs.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(txs);
  }, (err) => {
    console.error("Transactions subscription error:", err);
    callback([]);
  });
}

/**
 * -------------------------------------------------------------
 * ADMIN MANAGEMENT
 * -------------------------------------------------------------
 */

// Check if user has admin role in admins/{uid}
export async function verifyAdminRole(uid) {
  try {
    const adminRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminRef);
    if (snap.exists() && snap.data().role === 'admin') {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error verifying admin role:", err);
    return false;
  }
}

// Admin helper: Bootstrap admin document if authorized
export async function bootstrapAdminDocument(uid, email) {
  const adminRef = doc(db, 'admins', uid);
  await setDoc(adminRef, {
    role: 'admin',
    email: email || '',
    createdAt: serverTimestamp()
  }, { merge: true });
}

// Admin: Get Dashboard Real-time Stats from Firestore
export async function getAdminMetrics() {
  const usersColl = collection(db, 'users');
  const userDocs = await getDocs(usersColl);

  let totalUsers = 0;
  let activeUsers = 0;
  let totalAdViews = 0;
  let totalRewards = 0;
  let blockedUsers = 0;
  let todayAdsTotal = 0;
  let todayRewardsTotal = 0;

  const todayStr = getTodayDateString();

  userDocs.forEach((docSnap) => {
    totalUsers++;
    const u = docSnap.data();
    if (u.blocked || u.isBlocked) blockedUsers++;
    totalAdViews += (u.totalAds || 0);
    totalRewards += (u.totalEarned || 0);

    if (u.lastAdDate === todayStr) {
      if ((u.todayAds || 0) > 0 || (u.todayEarned || 0) > 0) {
        activeUsers++;
        todayAdsTotal += (u.todayAds || 0);
        todayRewardsTotal += (u.todayEarned || 0);
      }
    }
  });

  return {
    totalUsers,
    activeUsers,
    totalAdViews,
    totalRewards,
    blockedUsers,
    todayAdsTotal,
    todayRewardsTotal
  };
}

// Admin: Query Users with optional limit
export async function fetchAllUsersList() {
  const q = query(collection(db, 'users'), limit(250));
  const snap = await getDocs(q);
  const users = [];
  snap.forEach(d => {
    users.push({ uid: d.id, ...d.data() });
  });
  return users;
}

// Admin: Block / Unblock User
export async function setBlockedStatus(uid, isBlocked) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    blocked: Boolean(isBlocked),
    isBlocked: Boolean(isBlocked),
    updatedAt: serverTimestamp()
  });
}

// Admin: Add or Deduct User Balance
export async function adminAdjustBalance(uid, telegramId, amount, reason = "Admin adjustment") {
  const userRef = doc(db, 'users', uid);
  const txRef = doc(collection(db, 'transactions'));

  return await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User does not exist");
    const u = userDoc.data();

    const currentBal = u.balance || 0;
    const newBal = currentBal + amount;
    if (newBal < 0) throw new Error("Balance cannot be adjusted below 0.");

    transaction.update(userRef, {
      balance: newBal,
      totalEarned: amount > 0 ? (u.totalEarned || 0) + amount : (u.totalEarned || 0),
      updatedAt: serverTimestamp()
    });

    transaction.set(txRef, {
      uid: uid,
      userId: uid,
      telegramId: telegramId || u.telegramId || '',
      type: 'admin_adjustment',
      network: 'admin',
      amount: amount,
      description: reason,
      referenceId: txRef.id,
      createdAt: serverTimestamp()
    });

    return { success: true, newBalance: newBal };
  });
}

// Admin: Fetch recent transactions across system
export async function fetchRecentGlobalTransactions(limitCount = 60) {
  const q = query(
    collection(db, 'transactions'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  const txs = [];
  snap.forEach(d => txs.push({ id: d.id, ...d.data() }));
  return txs;
}
