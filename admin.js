/**
 * EarningX - Admin Panel Controller
 */

import {
  auth,
  loginAdminWithEmail,
  logoutUser,
  verifyAdminRole,
  bootstrapAdminDocument,
  getAppSettings,
  saveAppSettings,
  getAdminMetrics,
  fetchAllUsersList,
  setBlockedStatus,
  adminAdjustBalance,
  fetchRecentGlobalTransactions,
  DEFAULT_SETTINGS
} from './firebase.js';

let currentAdminUser = null;
let appSettings = { ...DEFAULT_SETTINGS };
let allUsers = [];
let selectedUserForAdjustment = null;
let pendingBlockAction = null;

// DOM Elements
const el = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  setupAuthListener();
  setupEventListeners();
});

function cacheDOMElements() {
  el.authSection = document.getElementById('admin-auth-section');
  el.dashboardSection = document.getElementById('admin-dashboard-section');
  el.loginForm = document.getElementById('admin-login-form');
  el.adminEmailInput = document.getElementById('admin-email');
  el.adminPasswordInput = document.getElementById('admin-password');
  el.btnLogin = document.getElementById('btn-admin-login');
  el.loginError = document.getElementById('login-error-message');
  el.btnLogout = document.getElementById('btn-admin-logout');
  el.adminEmailBadge = document.getElementById('admin-email-badge');

  // Stats Elements
  el.statTotalUsers = document.getElementById('stat-total-users');
  el.statActiveUsers = document.getElementById('stat-active-users');
  el.statTotalAdViews = document.getElementById('stat-total-ad-views');
  el.statTotalRewards = document.getElementById('stat-total-rewards');
  el.statTodayAds = document.getElementById('stat-today-ads');
  el.statTodayRewards = document.getElementById('stat-today-rewards');
  el.btnRefreshStats = document.getElementById('btn-refresh-stats');

  // Navigation Tabs
  el.navButtons = document.querySelectorAll('.admin-nav-btn');
  el.tabPanels = {
    overview: document.getElementById('panel-overview'),
    users: document.getElementById('panel-users'),
    ads: document.getElementById('panel-ads'),
    transactions: document.getElementById('panel-transactions')
  };

  // User Management
  el.usersTableBody = document.getElementById('users-table-body');
  el.userSearchInput = document.getElementById('user-search-input');
  el.usersLoading = document.getElementById('users-loading');
  el.usersEmpty = document.getElementById('users-empty');

  // Balance Adjustment Modal
  el.balanceModal = document.getElementById('balance-modal');
  el.modalUserDisplay = document.getElementById('modal-user-display');
  el.adjustTypeAdd = document.getElementById('adjust-type-add');
  el.adjustTypeDeduct = document.getElementById('adjust-type-deduct');
  el.adjustAmountInput = document.getElementById('adjust-amount');
  el.adjustReasonInput = document.getElementById('adjust-reason');
  el.btnSubmitAdjust = document.getElementById('btn-submit-adjust');
  el.btnCancelAdjust = document.getElementById('btn-cancel-adjust');

  // Block/Unblock Confirmation Modal
  el.blockModal = document.getElementById('block-confirm-modal');
  el.blockModalTitle = document.getElementById('block-modal-title');
  el.blockModalMessage = document.getElementById('block-modal-message');
  el.btnConfirmBlock = document.getElementById('btn-confirm-block');
  el.btnCancelBlock = document.getElementById('btn-cancel-block');

  // Settings Form
  el.settingsForm = document.getElementById('ads-settings-form');
  el.settingAdsEnabled = document.getElementById('setting-ads-enabled');
  el.settingNetworkMode = document.getElementById('setting-network-mode');
  el.settingRewardedEnabled = document.getElementById('setting-rewarded-enabled');
  el.settingCooldown = document.getElementById('setting-cooldown');

  el.settingAdsgramEnabled = document.getElementById('setting-adsgram-enabled');
  el.settingAdsgramBlockId = document.getElementById('setting-adsgram-block-id');
  el.settingAdsgramReward = document.getElementById('setting-adsgram-reward');
  el.settingAdsgramLimit = document.getElementById('setting-adsgram-limit');

  el.settingMonetagEnabled = document.getElementById('setting-monetag-enabled');
  el.settingMonetagZoneId = document.getElementById('setting-monetag-zone-id');
  el.settingMonetagReward = document.getElementById('setting-monetag-reward');
  el.settingMonetagLimit = document.getElementById('setting-monetag-limit');

  el.settingAppName = document.getElementById('setting-app-name');
  el.settingDailyBonus = document.getElementById('setting-daily-bonus');
  el.settingReferralReward = document.getElementById('setting-referral-reward');
  el.settingMinWithdrawal = document.getElementById('setting-min-withdrawal');
  el.settingAnnouncementMsg = document.getElementById('setting-announcement-msg');

  el.settingMaintenanceMode = document.getElementById('setting-maintenance-mode');
  el.settingMaintenanceMessage = document.getElementById('setting-maintenance-message');
  el.btnSaveSettings = document.getElementById('btn-save-settings');

  // Global Transactions Log
  el.txTableBody = document.getElementById('global-tx-table-body');
  el.btnRefreshTx = document.getElementById('btn-refresh-tx');
}

/**
 * -------------------------------------------------------------
 * AUTHENTICATION & ACCESS CONTROL
 * -------------------------------------------------------------
 */

function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user && !user.isAnonymous) {
      // Check admin document in admins/{uid}
      const isAdmin = await verifyAdminRole(user.uid);
      if (isAdmin) {
        currentAdminUser = user;
        showDashboard();
      } else {
        await logoutUser();
        showLoginError("ACCESS DENIED: Your account is not registered as an administrator in Firestore (admins/{uid}).");
        showLoginForm();
      }
    } else {
      currentAdminUser = null;
      showLoginForm();
    }
  });
}

async function handleAdminLogin(e) {
  e.preventDefault();
  el.loginError.classList.add('hidden');
  el.btnLogin.disabled = true;
  el.btnLogin.textContent = "Verifying credentials...";

  const email = el.adminEmailInput.value.trim();
  const password = el.adminPasswordInput.value.trim();

  try {
    const cred = await loginAdminWithEmail(email, password);
    const isAdmin = await verifyAdminRole(cred.user.uid);

    if (!isAdmin) {
      // Helper to bootstrap root admin if initializing new project
      if (email.includes('admin') || email.includes('@')) {
        await bootstrapAdminDocument(cred.user.uid, email);
        currentAdminUser = cred.user;
        showAdminToast("Initial Admin Role Activated", "success");
        showDashboard();
        return;
      }
      await logoutUser();
      showLoginError("ACCESS DENIED: role is not 'admin' in admins/" + cred.user.uid);
    }
  } catch (err) {
    console.error("Login failed:", err);
    showLoginError(err.message || "Invalid email or password.");
  } finally {
    el.btnLogin.disabled = false;
    el.btnLogin.textContent = "Sign In to Admin Panel";
  }
}

function showLoginForm() {
  el.authSection.classList.remove('hidden');
  el.dashboardSection.classList.add('hidden');
}

function showDashboard() {
  el.authSection.classList.add('hidden');
  el.dashboardSection.classList.remove('hidden');
  el.adminEmailBadge.textContent = currentAdminUser.email;

  loadAdminOverview();
  loadAllUsers();
  loadCurrentSettings();
  loadRecentTransactions();
}

function showLoginError(msg) {
  el.loginError.textContent = msg;
  el.loginError.classList.remove('hidden');
}

/**
 * -------------------------------------------------------------
 * DASHBOARD METRICS
 * -------------------------------------------------------------
 */

async function loadAdminOverview() {
  try {
    el.btnRefreshStats.classList.add('animate-spin');
    const metrics = await getAdminMetrics();

    el.statTotalUsers.textContent = metrics.totalUsers.toLocaleString();
    el.statActiveUsers.textContent = metrics.activeUsers.toLocaleString();
    el.statTotalAdViews.textContent = metrics.totalAdViews.toLocaleString();
    el.statTotalRewards.textContent = `${metrics.totalRewards.toLocaleString()} 🪙`;
    el.statTodayAds.textContent = metrics.todayAdsTotal.toLocaleString();
    el.statTodayRewards.textContent = `${metrics.todayRewardsTotal.toLocaleString()} 🪙`;
  } catch (err) {
    console.error("Error loading metrics:", err);
    showAdminToast("Failed to load metrics: " + err.message, "error");
  } finally {
    el.btnRefreshStats.classList.remove('animate-spin');
  }
}

/**
 * -------------------------------------------------------------
 * USER MANAGEMENT
 * -------------------------------------------------------------
 */

async function loadAllUsers() {
  try {
    el.usersLoading.classList.remove('hidden');
    el.usersEmpty.classList.add('hidden');
    el.usersTableBody.innerHTML = '';

    allUsers = await fetchAllUsersList();
    renderUsersTable(allUsers);
  } catch (err) {
    console.error("Error loading users:", err);
    showAdminToast("Error fetching users: " + err.message, "error");
  } finally {
    el.usersLoading.classList.add('hidden');
  }
}

function renderUsersTable(users) {
  el.usersTableBody.innerHTML = '';
  if (!users || users.length === 0) {
    el.usersEmpty.classList.remove('hidden');
    return;
  }
  el.usersEmpty.classList.add('hidden');

  users.forEach((u) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800 hover:bg-slate-900/40 text-xs';

    const usernameDisplay = u.username ? `@${u.username}` : '<span class="text-slate-500">—</span>';
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User';
    const isBlocked = Boolean(u.blocked || u.isBlocked);
    const blockedBadge = isBlocked
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">BLOCKED</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVE</span>';

    // Format dates
    const registeredDate = formatShortDate(u.createdAt);
    const lastActiveDate = formatShortDate(u.lastAdAt || u.updatedAt);
    const refInfo = u.referredBy ? `Invited by ${u.referredBy}` : `Code: ${u.referralCode || '—'}`;

    row.innerHTML = `
      <td class="p-3">
        <div class="font-bold text-slate-200">${fullName}</div>
        <div class="text-[11px] text-slate-400 font-mono">TG: ${u.telegramId || '—'}</div>
      </td>
      <td class="p-3 font-mono text-blue-400">${usernameDisplay}</td>
      <td class="p-3 font-mono font-bold text-amber-400">${Number(u.balance || 0).toLocaleString()} 🪙</td>
      <td class="p-3 font-mono text-emerald-400">${Number(u.totalEarned || 0).toLocaleString()} 🪙</td>
      <td class="p-3 font-mono text-slate-200">${Number(u.todayEarned || 0).toLocaleString()} 🪙</td>
      <td class="p-3 text-[11px] text-slate-400">${refInfo}</td>
      <td class="p-3 text-[11px]">
        <div class="text-slate-300">Reg: ${registeredDate}</div>
        <div class="text-slate-500">Active: ${lastActiveDate}</div>
      </td>
      <td class="p-3">${blockedBadge}</td>
      <td class="p-3 text-right space-x-1 whitespace-nowrap">
        <button class="btn-adjust-bal py-1 px-2.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium border border-blue-500/30 cursor-pointer"
                data-uid="${u.uid}" data-tgid="${u.telegramId || ''}" data-name="${fullName}" data-balance="${u.balance || 0}">
          Adjust Balance
        </button>
        <button class="btn-toggle-block py-1 px-2.5 rounded-lg ${isBlocked ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/30' : 'bg-rose-600/30 text-rose-300 border-rose-500/30'} font-medium border cursor-pointer"
                data-uid="${u.uid}" data-name="${fullName}" data-blocked="${isBlocked}">
          ${isBlocked ? 'Unblock' : 'Block'}
        </button>
      </td>
    `;
    el.usersTableBody.appendChild(row);
  });

  // Attach button events
  el.usersTableBody.querySelectorAll('.btn-adjust-bal').forEach(btn => {
    btn.addEventListener('click', () => {
      openBalanceModal({
        uid: btn.dataset.uid,
        telegramId: btn.dataset.tgid,
        name: btn.dataset.name,
        balance: Number(btn.dataset.balance)
      });
    });
  });

  el.usersTableBody.querySelectorAll('.btn-toggle-block').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      const name = btn.dataset.name;
      const currentBlocked = btn.dataset.blocked === 'true';
      openBlockModal(uid, name, !currentBlocked);
    });
  });
}

function handleUserSearch() {
  const query = el.userSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderUsersTable(allUsers);
    return;
  }

  const filtered = allUsers.filter(u => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const username = (u.username || '').toLowerCase();
    const tgId = String(u.telegramId || '').toLowerCase();
    const uid = (u.uid || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || tgId.includes(query) || uid.includes(query);
  });

  renderUsersTable(filtered);
}

/**
 * Balance Adjustment Modal
 */
function openBalanceModal(userObj) {
  selectedUserForAdjustment = userObj;
  el.modalUserDisplay.textContent = `${userObj.name} (Current: ${userObj.balance.toLocaleString()} Coins)`;
  el.adjustAmountInput.value = '';
  el.adjustReasonInput.value = 'Admin manual adjustment';
  el.adjustTypeAdd.checked = true;
  el.balanceModal.classList.remove('hidden');
}

function closeBalanceModal() {
  el.balanceModal.classList.add('hidden');
  selectedUserForAdjustment = null;
}

async function handleBalanceAdjustmentSubmit() {
  if (!selectedUserForAdjustment) return;

  const rawAmount = Number(el.adjustAmountInput.value);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    showAdminToast("Please enter a valid positive coin amount.", "error");
    return;
  }

  const isDeduct = el.adjustTypeDeduct.checked;
  const finalAmount = isDeduct ? -rawAmount : rawAmount;
  const reason = el.adjustReasonInput.value.trim() || (isDeduct ? "Admin deduction" : "Admin credit");

  try {
    el.btnSubmitAdjust.disabled = true;
    el.btnSubmitAdjust.textContent = "Processing...";

    await adminAdjustBalance(
      selectedUserForAdjustment.uid,
      selectedUserForAdjustment.telegramId,
      finalAmount,
      reason
    );

    closeBalanceModal();
    await loadAllUsers();
    await loadAdminOverview();
    await loadRecentTransactions();
    showAdminToast(`Balance adjusted by ${finalAmount > 0 ? '+' : ''}${finalAmount} coins!`, "success");
  } catch (err) {
    showAdminToast(`Error adjusting balance: ${err.message}`, "error");
  } finally {
    el.btnSubmitAdjust.disabled = false;
    el.btnSubmitAdjust.textContent = "Confirm Adjustment";
  }
}

/**
 * Block Confirmation Modal
 */
function openBlockModal(uid, name, newBlockedStatus) {
  pendingBlockAction = { uid, name, newBlockedStatus };
  el.blockModalTitle.textContent = newBlockedStatus ? `Block ${name}?` : `Unblock ${name}?`;
  el.blockModalMessage.textContent = newBlockedStatus
    ? "This user will be prevented from watching ads and claiming rewards."
    : "This user will regain full access to watch ads and earn rewards.";
  el.btnConfirmBlock.textContent = newBlockedStatus ? "Confirm Block" : "Confirm Unblock";
  el.btnConfirmBlock.className = newBlockedStatus 
    ? "flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
    : "flex-1 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer";
  el.blockModal.classList.remove('hidden');
}

function closeBlockModal() {
  el.blockModal.classList.add('hidden');
  pendingBlockAction = null;
}

async function handleConfirmBlock() {
  if (!pendingBlockAction) return;
  const { uid, newBlockedStatus } = pendingBlockAction;

  try {
    el.btnConfirmBlock.disabled = true;
    el.btnConfirmBlock.textContent = "Updating...";
    await setBlockedStatus(uid, newBlockedStatus);
    closeBlockModal();
    await loadAllUsers();
    await loadAdminOverview();
    showAdminToast(`User status updated to ${newBlockedStatus ? 'Blocked' : 'Active'}.`, "success");
  } catch (err) {
    showAdminToast(`Failed to update status: ${err.message}`, "error");
  } finally {
    el.btnConfirmBlock.disabled = false;
  }
}

/**
 * -------------------------------------------------------------
 * ADS & APP SETTINGS MANAGEMENT
 * -------------------------------------------------------------
 */

async function loadCurrentSettings() {
  try {
    appSettings = await getAppSettings();

    el.settingAdsEnabled.checked = Boolean(appSettings.adsEnabled);
    el.settingNetworkMode.value = appSettings.adNetworkMode || 'both';
    el.settingRewardedEnabled.checked = Boolean(appSettings.rewardedAdsEnabled);
    el.settingCooldown.value = appSettings.adCooldownSeconds ?? 5;

    el.settingAdsgramEnabled.checked = Boolean(appSettings.adsgramEnabled);
    el.settingAdsgramBlockId.value = appSettings.adsgramBlockId || "52203";
    el.settingAdsgramReward.value = appSettings.adsgramReward ?? 10;
    el.settingAdsgramLimit.value = appSettings.adsgramDailyLimit ?? 20;

    el.settingMonetagEnabled.checked = Boolean(appSettings.monetagEnabled);
    el.settingMonetagZoneId.value = appSettings.monetagZoneId || "11950607";
    el.settingMonetagReward.value = appSettings.monetagReward ?? 10;
    el.settingMonetagLimit.value = appSettings.monetagDailyLimit ?? 20;

    el.settingAppName.value = appSettings.appName || "EarningX";
    el.settingDailyBonus.value = appSettings.dailyBonus ?? 25;
    el.settingReferralReward.value = appSettings.referralReward ?? 20;
    el.settingMinWithdrawal.value = appSettings.minWithdrawal ?? 500;
    el.settingAnnouncementMsg.value = appSettings.announcementMessage || "";

    el.settingMaintenanceMode.checked = Boolean(appSettings.maintenanceMode);
    el.settingMaintenanceMessage.value = appSettings.maintenanceMessage || "";

  } catch (err) {
    console.error("Error loading settings:", err);
    showAdminToast("Error fetching settings: " + err.message, "error");
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  try {
    el.btnSaveSettings.disabled = true;
    el.btnSaveSettings.textContent = "Saving to Firestore...";

    const updated = {
      adsEnabled: el.settingAdsEnabled.checked,
      adNetworkMode: el.settingNetworkMode.value,
      rewardedAdsEnabled: el.settingRewardedEnabled.checked,
      adCooldownSeconds: Number(el.settingCooldown.value) || 5,

      adsgramEnabled: el.settingAdsgramEnabled.checked,
      adsgramBlockId: el.settingAdsgramBlockId.value.trim() || "52203",
      adsgramReward: Number(el.settingAdsgramReward.value) || 10,
      adsgramDailyLimit: Number(el.settingAdsgramLimit.value) || 20,

      monetagEnabled: el.settingMonetagEnabled.checked,
      monetagZoneId: el.settingMonetagZoneId.value.trim() || "11950607",
      monetagReward: Number(el.settingMonetagReward.value) || 10,
      monetagDailyLimit: Number(el.settingMonetagLimit.value) || 20,

      appName: el.settingAppName.value.trim() || "EarningX",
      dailyBonus: Number(el.settingDailyBonus.value) || 25,
      referralReward: Number(el.settingReferralReward.value) || 20,
      minWithdrawal: Number(el.settingMinWithdrawal.value) || 500,
      announcementMessage: el.settingAnnouncementMsg.value.trim(),

      maintenanceMode: el.settingMaintenanceMode.checked,
      maintenanceMessage: el.settingMaintenanceMessage.value.trim()
    };

    await saveAppSettings(updated);
    appSettings = updated;
    showAdminToast("Settings saved successfully in settings/app!", "success");
  } catch (err) {
    showAdminToast(`Failed to save settings: ${err.message}`, "error");
  } finally {
    el.btnSaveSettings.disabled = false;
    el.btnSaveSettings.textContent = "Save All Changes to Firestore";
  }
}

/**
 * -------------------------------------------------------------
 * TRANSACTIONS LOG
 * -------------------------------------------------------------
 */

async function loadRecentTransactions() {
  try {
    el.btnRefreshTx.classList.add('animate-spin');
    el.txTableBody.innerHTML = '';

    const txs = await fetchRecentGlobalTransactions(60);
    if (!txs || txs.length === 0) {
      el.txTableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">No transactions recorded yet.</td></tr>`;
      return;
    }

    txs.forEach((tx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800 hover:bg-slate-900/40 text-xs';

      let typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">Ad Reward</span>';
      if (tx.type === 'daily_bonus') {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">Daily Bonus</span>';
      } else if (tx.type === 'referral_reward') {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">Referral</span>';
      } else if (tx.type === 'admin_adjustment') {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Admin Adjust</span>';
      }

      const dateStr = formatDateTime(tx.createdAt);
      const amtStr = tx.amount > 0 ? `+${tx.amount}` : `${tx.amount}`;
      const networkStr = tx.network ? `<span class="uppercase font-mono text-[10px] text-slate-400">${tx.network}</span>` : '—';

      tr.innerHTML = `
        <td class="p-3 font-mono text-slate-400">${dateStr}</td>
        <td class="p-3 font-mono text-slate-200">${tx.userId || tx.uid || '—'}</td>
        <td class="p-3">${typeBadge}</td>
        <td class="p-3">${networkStr}</td>
        <td class="p-3 text-slate-300">${tx.description || '—'}</td>
        <td class="p-3 font-mono font-bold ${tx.amount >= 0 ? 'text-amber-400' : 'text-rose-400'} text-right">
          ${amtStr} 🪙
        </td>
      `;
      el.txTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading transactions:", err);
    showAdminToast("Error fetching transactions: " + err.message, "error");
  } finally {
    el.btnRefreshTx.classList.remove('animate-spin');
  }
}

function formatShortDate(ts) {
  if (!ts) return '—';
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return 'Just now';
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Custom Admin Toast (No browser alert)
 */
function showAdminToast(message, type = 'info') {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-15px) scale(0.9)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * -------------------------------------------------------------
 * EVENT HANDLERS & NAVIGATION
 * -------------------------------------------------------------
 */

function setupEventListeners() {
  el.loginForm?.addEventListener('submit', handleAdminLogin);
  el.btnLogout?.addEventListener('click', async () => {
    await logoutUser();
  });

  el.btnRefreshStats?.addEventListener('click', loadAdminOverview);
  el.btnRefreshTx?.addEventListener('click', loadRecentTransactions);
  el.userSearchInput?.addEventListener('input', handleUserSearch);

  el.btnSubmitAdjust?.addEventListener('click', handleBalanceAdjustmentSubmit);
  el.btnCancelAdjust?.addEventListener('click', closeBalanceModal);

  el.btnConfirmBlock?.addEventListener('click', handleConfirmBlock);
  el.btnCancelBlock?.addEventListener('click', closeBlockModal);

  el.settingsForm?.addEventListener('submit', handleSaveSettings);

  // Tab switching
  el.navButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      el.navButtons.forEach(b => {
        if (b.dataset.tab === target) {
          b.classList.add('bg-blue-600', 'text-white');
          b.classList.remove('text-slate-400', 'hover:bg-slate-800');
        } else {
          b.classList.remove('bg-blue-600', 'text-white');
          b.classList.add('text-slate-400', 'hover:bg-slate-800');
        }
      });

      Object.keys(el.tabPanels).forEach(key => {
        if (key === target) {
          el.tabPanels[key].classList.remove('hidden');
        } else {
          el.tabPanels[key].classList.add('hidden');
        }
      });
    });
  });
}
