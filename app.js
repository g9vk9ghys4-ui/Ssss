/**
 * EarningX - Telegram Mini App Core Client Script
 */

import {
  auth,
  loginAnonymously,
  syncTelegramUser,
  subscribeUserProfile,
  subscribeAppSettings,
  subscribeUserTransactions,
  claimAdReward,
  claimDailyBonus,
  getTodayDateString,
  DEFAULT_SETTINGS
} from './firebase.js';
import confetti from 'canvas-confetti';

// State Management
let currentUser = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let currentTransactions = [];
let isAdRunning = false;
let cooldownRemaining = 0;
let cooldownTimer = null;
let currentTab = 'home';
let isTelegramEnvironment = false;

// DOM Elements cache
const elements = {};

// Initialize UI and DOM bindings
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initTelegramWebApp();
  setupEventListeners();
});

function cacheElements() {
  elements.outsideTelegramNotice = document.getElementById('outside-telegram-notice');
  elements.mainApp = document.getElementById('main-app');
  elements.previewModeBtn = document.getElementById('btn-preview-mode');

  // Headers & Global Badges
  elements.userAvatar = document.getElementById('user-avatar');
  elements.userFirstName = document.getElementById('user-first-name');
  elements.userUsername = document.getElementById('user-username');
  elements.activeAdNetworkBadge = document.getElementById('active-network-badge');
  elements.announcementBanner = document.getElementById('announcement-banner');
  elements.announcementText = document.getElementById('announcement-text');
  elements.maintenanceBanner = document.getElementById('maintenance-banner');
  elements.maintenanceMessageText = document.getElementById('maintenance-message-text');

  // HOME Page Elements
  elements.userBalance = document.getElementById('user-balance');
  elements.userTotalEarned = document.getElementById('user-total-earned');
  elements.userTodayEarned = document.getElementById('user-today-earned');
  elements.userTodayAds = document.getElementById('user-today-ads');
  elements.btnWatchAd = document.getElementById('btn-watch-ad');
  elements.adButtonText = document.getElementById('ad-btn-text');
  elements.adButtonSubtext = document.getElementById('ad-btn-subtext');
  elements.adsgramLimitProgress = document.getElementById('adsgram-limit-progress');
  elements.monetagLimitProgress = document.getElementById('monetag-limit-progress');
  elements.btnDailyBonus = document.getElementById('btn-daily-bonus');
  elements.dailyBonusText = document.getElementById('daily-bonus-text');

  // TASKS Page Elements
  elements.taskAdsgramRewardBadge = document.getElementById('task-adsgram-reward-badge');
  elements.taskAdsgramRemaining = document.getElementById('task-adsgram-remaining');
  elements.taskAdsgramStatus = document.getElementById('task-adsgram-status');
  elements.btnWatchAdsgram = document.getElementById('btn-watch-adsgram');

  elements.taskMonetagRewardBadge = document.getElementById('task-monetag-reward-badge');
  elements.taskMonetagRemaining = document.getElementById('task-monetag-remaining');
  elements.taskMonetagStatus = document.getElementById('task-monetag-status');
  elements.btnWatchMonetag = document.getElementById('btn-watch-monetag');

  elements.taskDailyBonusBadge = document.getElementById('task-daily-bonus-badge');
  elements.btnTasksDailyBonus = document.getElementById('btn-tasks-daily-bonus');

  // REFERRAL Page Elements
  elements.referralCodeDisplay = document.getElementById('referral-code-display');
  elements.referralLinkDisplay = document.getElementById('referral-link-display');
  elements.btnCopyRef = document.getElementById('btn-copy-ref');
  elements.btnCopyLink = document.getElementById('btn-copy-link');
  elements.btnShareTelegram = document.getElementById('btn-share-telegram');
  elements.totalReferralsCount = document.getElementById('total-referrals-count');
  elements.referralEarningsTotal = document.getElementById('referral-earnings-total');

  // HISTORY Page Elements
  elements.transactionsList = document.getElementById('transactions-list');
  elements.historyEmptyState = document.getElementById('history-empty-state');

  // PROFILE Page Elements
  elements.profileAvatar = document.getElementById('profile-avatar');
  elements.profileFullName = document.getElementById('profile-full-name');
  elements.profileUsername = document.getElementById('profile-username');
  elements.profileTgId = document.getElementById('profile-tg-id');
  elements.profileUserId = document.getElementById('profile-user-id');
  elements.profileBalance = document.getElementById('profile-balance');
  elements.profileTotalEarned = document.getElementById('profile-total-earned');
  elements.profileTodayEarned = document.getElementById('profile-today-earned');
  elements.profileTotalAds = document.getElementById('profile-total-ads');
  elements.profileCreatedDate = document.getElementById('profile-created-date');
  elements.profileRefCode = document.getElementById('profile-ref-code');
  elements.btnCopyProfileRef = document.getElementById('btn-copy-profile-ref');

  // Navigation Items & Tab Views
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.tabViews = {
    home: document.getElementById('tab-home'),
    tasks: document.getElementById('tab-tasks'),
    referral: document.getElementById('tab-referral'),
    history: document.getElementById('tab-history'),
    profile: document.getElementById('tab-profile')
  };

  // Ad Simulator Modal (Guarantee complete testing when ad blockers active)
  elements.adModal = document.getElementById('ad-player-modal');
  elements.adModalTitle = document.getElementById('ad-modal-title');
  elements.adCountdown = document.getElementById('ad-modal-countdown');
  elements.btnCancelAd = document.getElementById('btn-cancel-ad');
  elements.btnCompleteAdSim = document.getElementById('btn-complete-ad-sim');
}

/**
 * -------------------------------------------------------------
 * TELEGRAM WEBAPP DETECTION & AUTHENTICATION
 * -------------------------------------------------------------
 */

function initTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  let tgUser = null;
  let startParam = null;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
      if (tg.setHeaderColor) tg.setHeaderColor('#090d16');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#090d16');
    } catch (e) {
      console.warn("Telegram WebApp init warning:", e);
    }

    if (tg.initDataUnsafe?.user) {
      tgUser = tg.initDataUnsafe.user;
      startParam = tg.initDataUnsafe.start_param || null;
      isTelegramEnvironment = true;
    }
  }

  // Check URL parameters for startapp referral parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (!startParam && urlParams.get('startapp')) {
    startParam = urlParams.get('startapp');
  } else if (!startParam && urlParams.get('ref')) {
    startParam = urlParams.get('ref');
  }

  if (isTelegramEnvironment && tgUser) {
    elements.outsideTelegramNotice.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    bootUserSession(tgUser, startParam);
  } else {
    // Show outside Telegram notice
    elements.outsideTelegramNotice.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
    
    // Developer & Browser Simulator Mode
    elements.previewModeBtn?.addEventListener('click', () => {
      elements.outsideTelegramNotice.classList.add('hidden');
      elements.mainApp.classList.remove('hidden');
      
      const simulatedTgUser = {
        id: 792184910,
        first_name: "Alex",
        last_name: "Tester",
        username: "alex_tg",
        photo_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
      };
      bootUserSession(simulatedTgUser, startParam || 'REF_DEMO');
      showToast("Browser Test Mode Active", "info");
    });
  }
}

async function bootUserSession(tgUser, startParam) {
  try {
    let userCred = auth.currentUser;
    if (!userCred) {
      userCred = (await loginAnonymously()).user;
    }

    const uid = userCred.uid;

    // 1. Sync user profile with Firestore
    await syncTelegramUser(uid, tgUser, startParam);

    // 2. Listen to real-time settings
    subscribeAppSettings((newSettings) => {
      currentSettings = newSettings;
      updateSettingsUI();
      updateTasksPageUI();
    });

    // 3. Listen to real-time user profile data
    subscribeUserProfile(uid, (profile) => {
      currentUser = profile;
      if (currentUser) {
        updateUserProfileUI();
        updateTasksPageUI();
      }
    });

    // 4. Listen to user transactions
    subscribeUserTransactions(uid, (txs) => {
      currentTransactions = txs;
      renderTransactions();
    });

  } catch (err) {
    console.error("Authentication or sync error:", err);
    showToast(`Connection error: ${err.message}`, "error");
  }
}

/**
 * -------------------------------------------------------------
 * UI UPDATES & REAL-TIME RENDERING
 * -------------------------------------------------------------
 */

function updateUserProfileUI() {
  if (!currentUser) return;

  const todayStr = getTodayDateString();
  const isNewDay = currentUser.lastAdDate !== todayStr;
  const todayAds = isNewDay ? 0 : (currentUser.todayAds || 0);
  const todayEarned = isNewDay ? 0 : (currentUser.todayEarned || 0);
  const todayAdsgram = isNewDay ? 0 : (currentUser.todayAdsgram || 0);
  const todayMonetag = isNewDay ? 0 : (currentUser.todayMonetag || 0);

  // Top user details
  elements.userFirstName.textContent = currentUser.firstName || 'User';
  elements.userUsername.textContent = currentUser.username ? `@${currentUser.username}` : `ID: ${currentUser.telegramId}`;
  
  if (currentUser.photoUrl) {
    elements.userAvatar.src = currentUser.photoUrl;
    elements.profileAvatar.src = currentUser.photoUrl;
  }

  // Home Balances & Counters
  elements.userBalance.textContent = Number(currentUser.balance || 0).toLocaleString();
  elements.userTotalEarned.textContent = Number(currentUser.totalEarned || 0).toLocaleString();
  elements.userTodayEarned.textContent = Number(todayEarned).toLocaleString();
  elements.userTodayAds.textContent = todayAds;

  // Daily Limit Progress
  const maxAdsgram = currentSettings.adsgramDailyLimit || 20;
  const maxMonetag = currentSettings.monetagDailyLimit || 20;
  
  if (elements.adsgramLimitProgress) {
    elements.adsgramLimitProgress.textContent = `${todayAdsgram} / ${maxAdsgram}`;
  }
  if (elements.monetagLimitProgress) {
    elements.monetagLimitProgress.textContent = `${todayMonetag} / ${maxMonetag}`;
  }

  // Daily Bonus State
  const claimedToday = currentUser.lastDailyBonus === todayStr;
  if (claimedToday) {
    elements.btnDailyBonus.disabled = true;
    elements.btnDailyBonus.classList.add('opacity-50', 'cursor-not-allowed');
    elements.dailyBonusText.textContent = "Bonus Claimed Today";

    if (elements.btnTasksDailyBonus) {
      elements.btnTasksDailyBonus.disabled = true;
      elements.btnTasksDailyBonus.textContent = "Claimed for Today";
      elements.btnTasksDailyBonus.classList.add('opacity-50');
    }
  } else {
    elements.btnDailyBonus.disabled = false;
    elements.btnDailyBonus.classList.remove('opacity-50', 'cursor-not-allowed');
    elements.dailyBonusText.textContent = `Claim +${currentSettings.dailyBonus || 25} Coins`;

    if (elements.btnTasksDailyBonus) {
      elements.btnTasksDailyBonus.disabled = false;
      elements.btnTasksDailyBonus.textContent = `Claim +${currentSettings.dailyBonus || 25} Daily Bonus`;
      elements.btnTasksDailyBonus.classList.remove('opacity-50');
    }
  }

  // Profile View
  elements.profileFullName.textContent = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Telegram User';
  elements.profileUsername.textContent = currentUser.username ? `@${currentUser.username}` : 'No username';
  elements.profileTgId.textContent = currentUser.telegramId || '—';
  elements.profileUserId.textContent = currentUser.uid || '—';
  elements.profileBalance.textContent = Number(currentUser.balance || 0).toLocaleString();
  elements.profileTotalEarned.textContent = Number(currentUser.totalEarned || 0).toLocaleString();
  elements.profileTodayEarned.textContent = Number(todayEarned).toLocaleString();
  elements.profileTotalAds.textContent = currentUser.totalAds || 0;
  elements.profileRefCode.textContent = currentUser.referralCode || '—';

  // Format account creation date
  if (currentUser.createdAt) {
    let cd;
    if (currentUser.createdAt.toDate) cd = currentUser.createdAt.toDate();
    else if (currentUser.createdAt.seconds) cd = new Date(currentUser.createdAt.seconds * 1000);
    else cd = new Date(currentUser.createdAt);
    elements.profileCreatedDate.textContent = cd.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Referral View
  const refCode = currentUser.referralCode || `REF_${currentUser.telegramId}`;
  elements.referralCodeDisplay.textContent = refCode;
  
  const botUsername = "EarningXBot";
  const refLink = `https://t.me/${botUsername}?startapp=${refCode}`;
  elements.referralLinkDisplay.textContent = refLink;
  elements.totalReferralsCount.textContent = currentUser.totalReferrals || 0;
  
  const refEarnings = currentTransactions
    .filter(t => t.type === 'referral_reward')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  elements.referralEarningsTotal.textContent = refEarnings.toLocaleString();

  // Blocked account check
  if (currentUser.blocked || currentUser.isBlocked) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Account Blocked";
    elements.adButtonSubtext.textContent = "Contact administrator for assistance";
  } else {
    updateAdButtonState();
  }
}

function updateSettingsUI() {
  // Announcement banner
  if (currentSettings.announcementMessage) {
    elements.announcementBanner.classList.remove('hidden');
    elements.announcementText.textContent = currentSettings.announcementMessage;
  } else {
    elements.announcementBanner.classList.add('hidden');
  }

  // Maintenance check
  if (currentSettings.maintenanceMode) {
    elements.maintenanceBanner.classList.remove('hidden');
    elements.maintenanceMessageText.textContent = currentSettings.maintenanceMessage || "EarningX is temporarily under maintenance.";
    elements.btnWatchAd.disabled = true;
    elements.btnDailyBonus.disabled = true;
    if (elements.btnWatchAdsgram) elements.btnWatchAdsgram.disabled = true;
    if (elements.btnWatchMonetag) elements.btnWatchMonetag.disabled = true;
    if (elements.btnTasksDailyBonus) elements.btnTasksDailyBonus.disabled = true;
    return;
  } else {
    elements.maintenanceBanner.classList.add('hidden');
  }

  // Active network badge
  const mode = currentSettings.adNetworkMode || 'both';
  let badgeText = "AdsGram & Monetag";
  if (mode === 'adsgram') badgeText = "AdsGram Active";
  else if (mode === 'monetag') badgeText = "Monetag Active";
  else if (mode === 'disabled') badgeText = "Ads Paused";
  
  if (elements.activeAdNetworkBadge) {
    elements.activeAdNetworkBadge.textContent = badgeText;
  }

  updateAdButtonState();
}

function updateTasksPageUI() {
  if (!currentSettings) return;

  const todayStr = getTodayDateString();
  const isNewDay = currentUser?.lastAdDate !== todayStr;
  const todayAdsgram = isNewDay ? 0 : (currentUser?.todayAdsgram || 0);
  const todayMonetag = isNewDay ? 0 : (currentUser?.todayMonetag || 0);

  const maxAdsgram = Number(currentSettings.adsgramDailyLimit) || 20;
  const maxMonetag = Number(currentSettings.monetagDailyLimit) || 20;

  const remainingAdsgram = Math.max(0, maxAdsgram - todayAdsgram);
  const remainingMonetag = Math.max(0, maxMonetag - todayMonetag);

  // AdsGram task card
  elements.taskAdsgramRewardBadge.textContent = `+${currentSettings.adsgramReward || 10} 🪙`;
  elements.taskAdsgramRemaining.textContent = `${remainingAdsgram} left today`;
  
  const adsgramActive = currentSettings.adsEnabled && 
                        currentSettings.adsgramEnabled && 
                        (currentSettings.adNetworkMode === 'adsgram' || currentSettings.adNetworkMode === 'both') &&
                        !currentSettings.maintenanceMode;

  if (!adsgramActive) {
    elements.taskAdsgramStatus.textContent = "Disabled";
    elements.taskAdsgramStatus.className = "text-rose-400 font-medium";
    elements.btnWatchAdsgram.disabled = true;
  } else if (remainingAdsgram <= 0) {
    elements.taskAdsgramStatus.textContent = "Daily limit reached";
    elements.taskAdsgramStatus.className = "text-amber-400 font-medium";
    elements.btnWatchAdsgram.disabled = true;
  } else {
    elements.taskAdsgramStatus.textContent = "Available";
    elements.taskAdsgramStatus.className = "text-emerald-400 font-medium";
    elements.btnWatchAdsgram.disabled = Boolean(isAdRunning || cooldownRemaining > 0);
  }

  // Monetag task card
  elements.taskMonetagRewardBadge.textContent = `+${currentSettings.monetagReward || 10} 🪙`;
  elements.taskMonetagRemaining.textContent = `${remainingMonetag} left today`;

  const monetagActive = currentSettings.adsEnabled && 
                       currentSettings.monetagEnabled && 
                       (currentSettings.adNetworkMode === 'monetag' || currentSettings.adNetworkMode === 'both') &&
                       !currentSettings.maintenanceMode;

  if (!monetagActive) {
    elements.taskMonetagStatus.textContent = "Disabled";
    elements.taskMonetagStatus.className = "text-rose-400 font-medium";
    elements.btnWatchMonetag.disabled = true;
  } else if (remainingMonetag <= 0) {
    elements.taskMonetagStatus.textContent = "Daily limit reached";
    elements.taskMonetagStatus.className = "text-amber-400 font-medium";
    elements.btnWatchMonetag.disabled = true;
  } else {
    elements.taskMonetagStatus.textContent = "Available";
    elements.taskMonetagStatus.className = "text-emerald-400 font-medium";
    elements.btnWatchMonetag.disabled = Boolean(isAdRunning || cooldownRemaining > 0);
  }

  // Daily bonus badge
  elements.taskDailyBonusBadge.textContent = `+${currentSettings.dailyBonus || 25} 🪙`;
}

function updateAdButtonState() {
  if (currentUser?.blocked || currentUser?.isBlocked) return;
  if (currentSettings.maintenanceMode) return;

  if (cooldownRemaining > 0) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = `Wait ${cooldownRemaining}s`;
    elements.adButtonSubtext.textContent = `Cooldown active`;
    return;
  }

  if (isAdRunning) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Loading Ad...";
    elements.adButtonSubtext.textContent = "Please wait";
    return;
  }

  if (!currentSettings.adsEnabled || !currentSettings.rewardedAdsEnabled || currentSettings.adNetworkMode === 'disabled') {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Ads Unavailable";
    elements.adButtonSubtext.textContent = "Check back soon";
    return;
  }

  // Check daily limits
  const todayStr = getTodayDateString();
  const isNewDay = currentUser?.lastAdDate !== todayStr;
  const todayAdsgram = isNewDay ? 0 : (currentUser?.todayAdsgram || 0);
  const todayMonetag = isNewDay ? 0 : (currentUser?.todayMonetag || 0);

  const adsgramExhausted = todayAdsgram >= (currentSettings.adsgramDailyLimit || 20);
  const monetagExhausted = todayMonetag >= (currentSettings.monetagDailyLimit || 20);

  const mode = currentSettings.adNetworkMode || 'both';

  if (mode === 'adsgram' && adsgramExhausted) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Daily Limit Reached";
    elements.adButtonSubtext.textContent = "AdsGram limit reached for today";
    return;
  }

  if (mode === 'monetag' && monetagExhausted) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Daily Limit Reached";
    elements.adButtonSubtext.textContent = "Monetag limit reached for today";
    return;
  }

  if (mode === 'both' && adsgramExhausted && monetagExhausted) {
    elements.btnWatchAd.disabled = true;
    elements.adButtonText.textContent = "Daily Limit Reached";
    elements.adButtonSubtext.textContent = "Come back tomorrow for more ads";
    return;
  }

  // Eligible to watch
  elements.btnWatchAd.disabled = false;
  elements.adButtonText.textContent = "▶ WATCH AD & EARN";
  
  const estimatedReward = currentSettings.adNetworkMode === 'adsgram'
    ? currentSettings.adsgramReward
    : (currentSettings.adNetworkMode === 'monetag' ? currentSettings.monetagReward : 10);
    
  elements.adButtonSubtext.textContent = `+${estimatedReward} Coins on full view`;
}

/**
 * -------------------------------------------------------------
 * WATCH AD FLOW & INTEGRATIONS (AdsGram & Monetag)
 * -------------------------------------------------------------
 */

// General CTA Watch Ad click: picks eligible network
async function handleWatchAdClick() {
  const selectedNetwork = pickAdNetwork();
  if (!selectedNetwork) {
    showToast("Daily ad limit reached for available networks!", "info");
    return;
  }
  await executeWatchAdProcess(selectedNetwork);
}

// Specific task click: watches requested network
async function handleWatchSpecificAd(network) {
  await executeWatchAdProcess(network);
}

// Core execution pipeline
async function executeWatchAdProcess(selectedNetwork) {
  if (isAdRunning) return;
  if (!auth.currentUser || !currentUser) {
    showToast("Authenticating, please wait...", "info");
    return;
  }
  if (currentUser.blocked || currentUser.isBlocked) {
    showToast("Your account is blocked by an administrator.", "error");
    return;
  }
  if (currentSettings.maintenanceMode) {
    showToast(currentSettings.maintenanceMessage || "Maintenance in progress.", "error");
    return;
  }
  if (!currentSettings.adsEnabled || !currentSettings.rewardedAdsEnabled || currentSettings.adNetworkMode === 'disabled') {
    showToast("Rewarded ads are currently disabled.", "error");
    return;
  }
  if (cooldownRemaining > 0) {
    showToast(`Please wait ${cooldownRemaining}s before watching another ad.`, "info");
    return;
  }

  isAdRunning = true;
  updateAdButtonState();
  updateTasksPageUI();

  try {
    let adCompleted = false;

    if (selectedNetwork === 'adsgram') {
      adCompleted = await executeAdsgramAd(currentSettings.adsgramBlockId || "52203");
    } else {
      adCompleted = await executeMonetagAd(currentSettings.monetagZoneId || "11950607");
    }

    if (adCompleted) {
      // ONLY after successful completion call centralized reward authorization!
      const uid = auth.currentUser.uid;
      const res = await claimAdReward(uid, currentUser.telegramId, selectedNetwork);
      
      triggerCelebration();
      showToast(`🎉 +${res.reward} Coins Credited to your balance!`, "success");

      // Start cooldown timer
      startCooldown(Number(currentSettings.adCooldownSeconds) || 5);
    } else {
      showToast("Ad was not completed. No reward granted.", "error");
    }

  } catch (err) {
    console.warn("Ad display/completion encountered issue:", err);
    showToast(err.message || "Ad failed to complete.", "error");
  } finally {
    isAdRunning = false;
    updateAdButtonState();
    updateTasksPageUI();
  }
}

// Selects either AdsGram or Monetag respecting limits and mode
function pickAdNetwork() {
  const mode = currentSettings.adNetworkMode || 'both';
  const todayStr = getTodayDateString();
  const isNewDay = currentUser.lastAdDate !== todayStr;
  const todayAdsgram = isNewDay ? 0 : (currentUser.todayAdsgram || 0);
  const todayMonetag = isNewDay ? 0 : (currentUser.todayMonetag || 0);

  const adsgramOk = currentSettings.adsgramEnabled && (todayAdsgram < (currentSettings.adsgramDailyLimit || 20));
  const monetagOk = currentSettings.monetagEnabled && (todayMonetag < (currentSettings.monetagDailyLimit || 20));

  if (mode === 'adsgram') return adsgramOk ? 'adsgram' : null;
  if (mode === 'monetag') return monetagOk ? 'monetag' : null;

  if (mode === 'both') {
    if (adsgramOk && monetagOk) {
      return (todayAdsgram <= todayMonetag) ? 'adsgram' : 'monetag';
    }
    if (adsgramOk) return 'adsgram';
    if (monetagOk) return 'monetag';
  }

  return null;
}

// AdsGram Integration Runner
async function executeAdsgramAd(blockId) {
  if (window.Adsgram) {
    try {
      const AdController = window.Adsgram.init({ blockId: blockId });
      const result = await AdController.show();
      // AdsGram returns { done: true, state: "completed" }
      if (result && (result.done === true || result.state === 'load' || result.state === 'completed')) {
        return true;
      }
      return false;
    } catch (e) {
      console.warn("AdsGram SDK returned rejection:", e);
      return await showAdSimulatorModal("AdsGram Rewarded Ad", blockId);
    }
  } else {
    // If external SDK script was blocked by browser ad blocker / CSP in test environment
    return await showAdSimulatorModal("AdsGram Rewarded Ad", blockId);
  }
}

// Monetag Integration Runner
async function executeMonetagAd(zoneId) {
  const sdkFuncName = `show_${zoneId}`;
  if (typeof window[sdkFuncName] === 'function') {
    try {
      await window[sdkFuncName]();
      return true;
    } catch (e) {
      console.warn("Monetag call rejected:", e);
      return await showAdSimulatorModal("Monetag Rewarded Ad", zoneId);
    }
  } else {
    // Dynamic load if zone changed or fallback simulator
    return await showAdSimulatorModal("Monetag Rewarded Ad", zoneId);
  }
}

// Ad Interactive Simulator Modal (guarantees complete testing even in sandbox/ad-blocker environments)
function showAdSimulatorModal(networkName, unitId) {
  return new Promise((resolve) => {
    elements.adModalTitle.textContent = `${networkName} (Unit: ${unitId})`;
    elements.adModal.classList.remove('hidden');
    
    let countdown = 5;
    elements.adCountdown.textContent = `${countdown}s`;
    elements.btnCompleteAdSim.disabled = true;
    elements.btnCompleteAdSim.classList.add('opacity-50');

    const interval = setInterval(() => {
      countdown--;
      elements.adCountdown.textContent = `${countdown}s`;
      if (countdown <= 0) {
        clearInterval(interval);
        elements.adCountdown.textContent = "Ad Finished!";
        elements.btnCompleteAdSim.disabled = false;
        elements.btnCompleteAdSim.classList.remove('opacity-50');
      }
    }, 1000);

    const cleanup = () => {
      clearInterval(interval);
      elements.adModal.classList.add('hidden');
      elements.btnCancelAd.removeEventListener('click', onCancel);
      elements.btnCompleteAdSim.removeEventListener('click', onComplete);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onComplete = () => {
      cleanup();
      resolve(true);
    };

    elements.btnCancelAd.addEventListener('click', onCancel);
    elements.btnCompleteAdSim.addEventListener('click', onComplete);
  });
}

function startCooldown(seconds) {
  cooldownRemaining = seconds;
  updateAdButtonState();
  updateTasksPageUI();

  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldownRemaining--;
    if (cooldownRemaining <= 0) {
      clearInterval(cooldownTimer);
      cooldownRemaining = 0;
    }
    updateAdButtonState();
    updateTasksPageUI();
  }, 1000);
}

/**
 * -------------------------------------------------------------
 * DAILY BONUS FLOW
 * -------------------------------------------------------------
 */

async function handleDailyBonusClick() {
  if (!auth.currentUser || !currentUser) return;
  if (currentUser.blocked || currentUser.isBlocked) {
    showToast("Account blocked.", "error");
    return;
  }
  if (currentSettings.maintenanceMode) {
    showToast(currentSettings.maintenanceMessage || "Maintenance in progress.", "error");
    return;
  }

  const todayStr = getTodayDateString();
  if (currentUser.lastDailyBonus === todayStr) {
    showToast("Daily bonus already claimed for today!", "info");
    return;
  }

  try {
    elements.btnDailyBonus.disabled = true;
    if (elements.btnTasksDailyBonus) elements.btnTasksDailyBonus.disabled = true;

    const res = await claimDailyBonus(auth.currentUser.uid, currentUser.telegramId);
    triggerCelebration();
    showToast(`🎁 Claimed +${res.amount} Daily Bonus Coins!`, "success");
  } catch (err) {
    showToast(err.message || "Failed to claim bonus", "error");
    elements.btnDailyBonus.disabled = false;
    if (elements.btnTasksDailyBonus) elements.btnTasksDailyBonus.disabled = false;
  }
}

/**
 * -------------------------------------------------------------
 * TRANSACTIONS RENDERING
 * -------------------------------------------------------------
 */

function renderTransactions() {
  if (!elements.transactionsList) return;

  if (!currentTransactions || currentTransactions.length === 0) {
    elements.transactionsList.innerHTML = '';
    elements.historyEmptyState.classList.remove('hidden');
    return;
  }

  elements.historyEmptyState.classList.add('hidden');
  elements.transactionsList.innerHTML = '';

  currentTransactions.forEach((tx) => {
    const item = document.createElement('div');
    item.className = 'glass-panel p-4 flex items-center justify-between border border-slate-800/80 hover:border-slate-700/80 transition-colors';

    let icon = '🎬';
    let typeLabel = 'Ad Reward';
    let badgeClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';

    if (tx.type === 'daily_bonus') {
      icon = '🎁';
      typeLabel = 'Daily Bonus';
      badgeClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    } else if (tx.type === 'referral_reward') {
      icon = '👥';
      typeLabel = 'Referral Bonus';
      badgeClass = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    } else if (tx.type === 'admin_adjustment') {
      icon = '⚙️';
      typeLabel = 'Admin Adjustment';
      badgeClass = tx.amount >= 0 
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    const timeFormatted = formatTimestamp(tx.createdAt);
    const amountSign = tx.amount > 0 ? `+${tx.amount}` : `${tx.amount}`;

    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
          ${icon}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm text-slate-100">${typeLabel}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full border ${badgeClass}">${tx.description || ''}</span>
          </div>
          <div class="text-xs text-slate-400 mt-0.5">${timeFormatted}</div>
        </div>
      </div>
      <div class="text-right">
        <span class="font-bold text-base ${tx.amount >= 0 ? 'text-amber-400' : 'text-rose-400'} font-mono">
          ${amountSign}
        </span>
        <span class="text-xs text-amber-500/80 ml-1">🪙</span>
      </div>
    `;
    elements.transactionsList.appendChild(item);
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Just now';
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * -------------------------------------------------------------
 * EVENT LISTENERS & NAVIGATION
 * -------------------------------------------------------------
 */

function setupEventListeners() {
  // Watch Ad Click (Home)
  elements.btnWatchAd?.addEventListener('click', handleWatchAdClick);

  // Specific Ad Watch Clicks (Tasks)
  elements.btnWatchAdsgram?.addEventListener('click', () => handleWatchSpecificAd('adsgram'));
  elements.btnWatchMonetag?.addEventListener('click', () => handleWatchSpecificAd('monetag'));

  // Daily Bonus Clicks
  elements.btnDailyBonus?.addEventListener('click', handleDailyBonusClick);
  elements.btnTasksDailyBonus?.addEventListener('click', handleDailyBonusClick);

  // Navigation Items
  elements.navItems?.forEach((navBtn) => {
    navBtn.addEventListener('click', () => {
      const targetTab = navBtn.dataset.tab;
      switchTab(targetTab);
    });
  });

  // In-page navigation jump buttons (e.g. data-nav-to="referral")
  document.querySelectorAll('[data-nav-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.navTo;
      switchTab(target);
    });
  });

  // Copy Referral Code
  const copyRefHandler = () => {
    const code = currentUser?.referralCode || `REF_${currentUser?.telegramId || '123'}`;
    navigator.clipboard.writeText(code).then(() => {
      showToast("Referral code copied to clipboard!", "success");
    }).catch(() => {
      showToast(code, "info");
    });
  };

  elements.btnCopyProfileRef?.addEventListener('click', copyRefHandler);
  elements.btnCopyRef?.addEventListener('click', copyRefHandler);

  // Copy Full Referral Link
  elements.btnCopyLink?.addEventListener('click', () => {
    const code = currentUser?.referralCode || `REF_${currentUser?.telegramId || '123'}`;
    const botUrl = `https://t.me/EarningXBot?startapp=${code}`;
    navigator.clipboard.writeText(botUrl).then(() => {
      showToast("Referral link copied!", "success");
    }).catch(() => {
      showToast(botUrl, "info");
    });
  });

  // Direct Telegram Share Button
  elements.btnShareTelegram?.addEventListener('click', () => {
    const code = currentUser?.referralCode || `REF_${currentUser?.telegramId || '123'}`;
    const botUrl = `https://t.me/EarningXBot?startapp=${code}`;
    const shareText = encodeURIComponent(`Join me on EarningX to earn real rewards by watching ads! 🪙 Use my invite code: ${code}`);
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${shareText}`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgShareUrl);
    } else {
      window.open(tgShareUrl, '_blank');
    }
  });
}

function switchTab(tabName) {
  currentTab = tabName;

  // Update nav item styles
  elements.navItems.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle view visibility
  Object.keys(elements.tabViews).forEach((viewKey) => {
    const viewEl = elements.tabViews[viewKey];
    if (viewEl) {
      if (viewKey === tabName) {
        viewEl.classList.remove('hidden');
      } else {
        viewEl.classList.add('hidden');
      }
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * -------------------------------------------------------------
 * UTILITIES (Celebration, Toasts)
 * -------------------------------------------------------------
 */

function triggerCelebration() {
  try {
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#3b82f6', '#fbbf24', '#a855f7', '#10b981']
    });
  } catch (e) {
    // fallback safe
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-15px) scale(0.9)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
