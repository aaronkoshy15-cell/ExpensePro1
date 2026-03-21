// State Management
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentCurrency = localStorage.getItem('currency') || 'USD';
let userName = localStorage.getItem('userName') || 'Display Name';
let appPin = localStorage.getItem('appPin') || null;
let isPinEnabled = localStorage.getItem('isPinEnabled') === 'true';
let monthlyBudget = parseFloat(localStorage.getItem('monthlyBudget')) || 0;
let goalName = localStorage.getItem('goalName') || '';
let goalAmount = parseFloat(localStorage.getItem('goalAmount')) || 0;
let appTheme = localStorage.getItem('appTheme') || 'system';
let isOledMode = localStorage.getItem('isOledMode') === 'true';
let isFamilyMode = localStorage.getItem('isFamilyMode') === 'true';
let familyMembers = JSON.parse(localStorage.getItem('familyMembers')) || ['Me'];
let accentColor = localStorage.getItem('accentColor') || '#6366f1';
let customAvatarUrl = localStorage.getItem('customAvatarUrl') || null;
let isBalanceHidden = localStorage.getItem('isBalanceHidden') === 'true';

// Haptic & Sound Feedback State
let isHapticsEnabled = localStorage.getItem('isHapticsEnabled') !== 'false'; // default on
let isSoundEnabled   = localStorage.getItem('isSoundEnabled')   !== 'false'; // default on

// Helper to close any modal and unlock body
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('active');
        // Check if any other modal is still active before unlocking body
        setTimeout(() => {
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.classList.remove('modal-open');
            }
        }, 300);
    }
}
let memberChartInstance = null;
let editingId = null;

// =====================================================
// PERSISTENCE SERVICE (IndexedDB Mirroring)
// =====================================================
const DB_NAME = 'ExpenseProDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function syncToIndexedDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const data = {
            transactions,
            currentCurrency,
            userName,
            appPin,
            isPinEnabled,
            monthlyBudget,
            goalName,
            goalAmount,
            appTheme,
            isOledMode,
            isFamilyMode,
            familyMembers,
            accentColor,
            customAvatarUrl,
            isBalanceHidden,
            isHapticsEnabled,
            isSoundEnabled,
            epro_account: localStorage.getItem('epro_account'),
            epro_devices: localStorage.getItem('epro_devices'),
            epro_remembered: localStorage.getItem('epro_remembered'),
            lastSync: new Date().toISOString()
        };
        
        store.put(data, 'main_backup');
        return true;
    } catch (e) {
        console.error('IndexedDB Sync Failed:', e);
        return false;
    }
}

async function restoreFromIndexedDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('main_backup');
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    // Only restore if localStorage is actually empty/suspiciously small
                    if (!localStorage.getItem('transactions') || JSON.parse(localStorage.getItem('transactions')).length === 0) {
                        for (const key in data) {
                            if (key === 'lastSync') continue;
                            const val = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
                            localStorage.setItem(key, val);
                        }
                        console.log('Data restored from IndexedDB');
                        location.reload(); // Reload to apply restored state
                    }
                }
                resolve(true);
            };
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

// ---- Data Export/Import ----
window.exportData = function() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ExpensePro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playSound('success');
    triggerHaptic(20);
};

window.importData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("This will replace all current data with the backup. Proceed?")) {
                localStorage.clear();
                for (const key in data) {
                    localStorage.setItem(key, data[key]);
                }
                alert("Data restored successfully! The app will now reload.");
                playSound('success');
                location.reload();
            }
        } catch (err) {
            alert("Invalid backup file.");
            playSound('error');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
};

// =====================================================
// FEEDBACK SERVICE (Haptics & Sound)
// =====================================================
function triggerHaptic(duration = 15) {
    if (!isHapticsEnabled) return;
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// Lightweight Sound Synthesis (no external files needed)
function playSound(type) {
    if (!isSoundEnabled) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

function showButtonSuccess(btn, originalHtml) {
    btn.classList.remove('loading');
    btn.classList.add('success');
    btn.innerHTML = '&nbsp;'; // Space for the pseudo-element checkmark
    
    playSound('success');
    triggerHaptic(50);

    setTimeout(() => {
        btn.classList.remove('success');
        btn.innerHTML = originalHtml;
    }, 1500);
}

// Global Click Listener for Haptics & Sound
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, a, .num-btn, .nav-links li, .lock-dot');
    if (target) {
        triggerHaptic(15);
        if (target.classList.contains('num-btn')) {
            playSound('click');
        } else if (!target.classList.contains('active')) {
            // General click sound for interactive elements
            playSound('click');
        }
    }
}, true);

// Currency Selection
function changeCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('currency', currentCurrency);
    updateUI();
}

// DOM Elements
const totalBalanceEl = document.getElementById('totalBalance');
const toggleBalanceBtn = document.getElementById('toggleBalanceBtn');
const balanceEyeIcon = document.getElementById('balanceEyeIcon');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const transactionListEl = document.getElementById('transactionList');

// Modal Elements
const closeModalBtn = document.getElementById('closeModalBtn');
const modalOverlay = document.getElementById('addTransactionModal');
const transactionForm = document.getElementById('transactionForm');
const voiceAddBtn = document.getElementById('voiceAddBtn');

// // =====================================================
// LOGIN DEVICES — Multi-Device Session Tracking
// =====================================================
const DEVICES_KEY     = 'epro_devices';
const DEVICE_ID_KEY   = 'epro_device_id';   // unique ID per browser/profile

// Generate (or reuse) a unique ID for THIS browser install
function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'Desktop';
    let deviceIcon = 'fa-desktop';
    if (/Android/i.test(ua))          { deviceType = 'Android';      deviceIcon = 'fa-mobile-screen-button'; }
    else if (/iPhone|iPod/i.test(ua)) { deviceType = 'iPhone';       deviceIcon = 'fa-mobile-screen-button'; }
    else if (/iPad/i.test(ua))        { deviceType = 'iPad';         deviceIcon = 'fa-tablet-screen-button'; }
    else if (/Windows Phone/i.test(ua)){ deviceType ='Windows Phone'; deviceIcon = 'fa-mobile-screen-button'; }

    let browser = 'Unknown Browser';
    if (/Edg\//i.test(ua))                                 browser = 'Microsoft Edge';
    else if (/OPR\//i.test(ua))                             browser = 'Opera';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
    else if (/Firefox\//i.test(ua))                         browser = 'Mozilla Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua))  browser = 'Safari';

    let os = 'Unknown OS';
    if (/Windows NT 10/.test(ua))   os = 'Windows 10/11';
    else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
    else if (/Mac OS X/.test(ua))   os = 'macOS';
    else if (/Linux/.test(ua))      os = 'Linux';
    else if (/Android/.test(ua))    os = 'Android';
    else if (/iPhone OS/.test(ua))  os = 'iOS';

    return { deviceType, deviceIcon, browser, os };
}

// Seed realistic past-device history so the panel is never empty
function seedSimulatedDevices() {
    const now = Date.now();
    return [
        {
            id: 'sim_1',
            fingerprint: 'sim_phone_1',
            deviceType: 'iPhone',
            deviceIcon: 'fa-mobile-screen-button',
            browser: 'Safari',
            os: 'iOS',
            location: 'Mumbai, IN',
            firstLogin: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
            lastSeen:   new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
            isCurrent: false,
            isSimulated: true
        },
        {
            id: 'sim_2',
            fingerprint: 'sim_tablet_1',
            deviceType: 'iPad',
            deviceIcon: 'fa-tablet-screen-button',
            browser: 'Safari',
            os: 'iOS',
            location: 'Chennai, IN',
            firstLogin: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
            lastSeen:   new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
            isCurrent: false,
            isSimulated: true
        },
        {
            id: 'sim_3',
            fingerprint: 'sim_desktop_1',
            deviceType: 'Desktop',
            deviceIcon: 'fa-desktop',
            browser: 'Mozilla Firefox',
            os: 'Windows 10/11',
            location: 'Bangalore, IN',
            firstLogin: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
            lastSeen:   new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
            isCurrent: false,
            isSimulated: true
        }
    ];
}

function registerDevice() {
    let devices = JSON.parse(localStorage.getItem(DEVICES_KEY)) || [];
    const info       = getDeviceInfo();
    const deviceId   = getOrCreateDeviceId();
    const now        = new Date().toISOString();

    // Migration: wipe old-format data (no isSimulated field → old implementation)
    const hasNewFormat = devices.some(d => d.isSimulated !== undefined);
    if (!hasNewFormat) {
        devices = [];
        localStorage.removeItem(DEVICES_KEY);
    }

    // Seed simulated devices on very first registration (or after migration)
    if (devices.length === 0) {
        devices = seedSimulatedDevices();
    }

    // Mark all as non-current first
    devices.forEach(d => d.isCurrent = false);

    const existingIdx = devices.findIndex(d => d.fingerprint === deviceId);
    if (existingIdx !== -1) {
        devices[existingIdx].lastSeen  = now;
        devices[existingIdx].isCurrent = true;
    } else {
        const newDevice = {
            id: deviceId,
            fingerprint: deviceId,
            ...info,
            location: '',
            firstLogin: now,
            lastSeen:   now,
            isCurrent:  true,
            isSimulated: false
        };
        devices.unshift(newDevice);
    }

    // Keep max 10
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices.slice(0, 10)));
}

function getDevices() {
    return JSON.parse(localStorage.getItem(DEVICES_KEY)) || [];
}

window.openDevicesModal = function() {
    const modal = document.getElementById('devicesModal');
    if (modal) { renderDeviceList(); modal.style.display = 'flex'; }
};

window.closeDevicesModal = function() {
    const modal = document.getElementById('devicesModal');
    if (modal) modal.style.display = 'none';
};

// Add a simulated new device (demo button)
window.addSimulatedDevice = function() {
    const demos = [
        { deviceType:'Android', deviceIcon:'fa-mobile-screen-button', browser:'Google Chrome', os:'Android', location:'Delhi, IN' },
        { deviceType:'Desktop', deviceIcon:'fa-desktop',              browser:'Microsoft Edge',os:'Windows 10/11', location:'Hyderabad, IN' },
        { deviceType:'Desktop', deviceIcon:'fa-desktop',              browser:'Safari',        os:'macOS', location:'Pune, IN' },
        { deviceType:'iPhone',  deviceIcon:'fa-mobile-screen-button', browser:'Safari',        os:'iOS', location:'Kolkata, IN' },
    ];
    const pick = demos[Math.floor(Math.random() * demos.length)];
    const now  = new Date();
    const ago  = new Date(now - Math.floor(Math.random() * 5 + 1) * 24 * 60 * 60 * 1000);

    let devices = getDevices();
    devices.push({
        id:          'sim_' + Date.now(),
        fingerprint: 'sim_' + Math.random().toString(36).slice(2),
        ...pick,
        firstLogin:  ago.toISOString(),
        lastSeen:    ago.toISOString(),
        isCurrent:   false,
        isSimulated: true
    });
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices.slice(0, 10)));
    renderDeviceList();
};

// Generate a fake IP for display
function fakeIp(seed) {
    const h = s => { let r=0; for(let i=0;i<s.length;i++) r=(r*31+s.charCodeAt(i))>>>0; return r; };
    const n = h(seed || 'x');
    return `${(n>>24&0x7f)+1}.${(n>>16&0xff)}.${(n>>8&0xff)}.${n&0xff}`;
}

function updateSecurityStrip(devices) {
    const totalEl   = document.getElementById('dvTotalCount');
    const activeEl  = document.getElementById('dvActiveCount');
    const statusEl  = document.getElementById('dvSecurityStatus');
    if (!totalEl) return;

    const total   = devices.length;
    const active  = devices.filter(d => d.isCurrent).length;
    const now     = Date.now();
    const oldDays = 30 * 24 * 60 * 60 * 1000;
    const suspicious = devices.filter(d => !d.isCurrent && (now - new Date(d.lastSeen)) > oldDays);

    totalEl.textContent  = `${total} Device${total !== 1 ? 's' : ''}`;
    activeEl.textContent = `${active} Active`;

    if (suspicious.length > 0) {
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i> <span style="color:var(--danger);">${suspicious.length} Suspicious</span>`;
    } else {
        statusEl.innerHTML = `<i class="fa-solid fa-lock" style="color:var(--success);"></i> <span>Account Secure</span>`;
    }
}

function renderDeviceList() {
    const container = document.getElementById('devicesList');
    if (!container) return;
    const devices = getDevices();

    updateSecurityStrip(devices);

    if (devices.length === 0) {
        container.innerHTML = `
          <div class="dv-empty-state">
            <i class="fa-solid fa-laptop-slash"></i>
            <p>No login history found.</p>
          </div>`;
        return;
    }

    // Sort: current first, then by lastSeen desc
    const sorted = [...devices].sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return new Date(b.lastSeen) - new Date(a.lastSeen);
    });

    const now     = Date.now();
    const dayMs   = 24 * 60 * 60 * 1000;

    // Group into sections
    const groups = { current: [], recent: [], older: [] };
    sorted.forEach(d => {
        const age = now - new Date(d.lastSeen);
        if (d.isCurrent)       groups.current.push(d);
        else if (age < 7*dayMs) groups.recent.push(d);
        else                    groups.older.push(d);
    });

    function cardHtml(d, index) {
        const lastSeen   = new Date(d.lastSeen);
        const firstLogin = new Date(d.firstLogin);
        const timeAgo    = getTimeAgo(lastSeen);
        const ip         = fakeIp(d.fingerprint || d.id);
        const ageDays    = Math.floor((now - lastSeen) / dayMs);
        const isSuspicious = !d.isCurrent && ageDays > 30;

        const locationBadge = d.location
            ? `<span class="dv-pill"><i class="fa-solid fa-location-dot"></i> ${d.location}</span>`
            : '';
        const ipBadge = `<span class="dv-pill"><i class="fa-solid fa-network-wired"></i> ${ip}</span>`;

        return `
        <div class="device-card ${d.isCurrent ? 'device-current' : ''} ${isSuspicious ? 'device-suspicious' : ''}" 
             style="animation-delay:${index * 0.06}s">
            <div class="device-icon-wrap ${isSuspicious ? 'icon-danger' : ''}">
                <i class="fa-solid ${d.deviceIcon}"></i>
            </div>
            <div class="device-info">
                <div class="device-name">
                    ${d.browser}
                    <span class="device-type-tag">${d.deviceType}</span>
                    ${d.isCurrent ? '<span class="device-badge"><i class="fa-solid fa-circle-check"></i> This Device</span>' : ''}
                    ${isSuspicious   ? '<span class="device-sus-tag"><i class="fa-solid fa-triangle-exclamation"></i> Suspicious</span>' : ''}
                    ${d.isSimulated && !d.isCurrent && !isSuspicious ? '<span class="device-sim-tag">Simulated</span>' : ''}
                </div>
                <div class="device-meta">${d.os}</div>
                <div class="dv-pills">
                    ${locationBadge}
                    ${ipBadge}
                </div>
                <div class="device-time">
                    <i class="fa-solid fa-clock"></i> Last active: <strong>${timeAgo}</strong>
                    &nbsp;•&nbsp;
                    <i class="fa-solid fa-calendar-plus"></i> First login: ${firstLogin.toLocaleDateString()}
                </div>
            </div>
            <div class="dv-card-actions">
                ${d.isCurrent
                    ? `<span class="device-active-dot" title="Active now"></span>`
                    : `<button class="device-revoke-btn" onclick="revokeDevice('${d.id}')" title="Sign out this device">
                           <i class="fa-solid fa-ban"></i>
                       </button>`
                }
            </div>
        </div>`;
    }

    let html = '';
    let globalIdx = 0;

    if (groups.current.length) {
        html += `<div class="dv-group-label"><i class="fa-solid fa-wifi"></i> Active Now</div>`;
        html += groups.current.map(d => cardHtml(d, globalIdx++)).join('');
    }
    if (groups.recent.length) {
        html += `<div class="dv-group-label"><i class="fa-solid fa-clock-rotate-left"></i> Recent (last 7 days)</div>`;
        html += groups.recent.map(d => cardHtml(d, globalIdx++)).join('');
    }
    if (groups.older.length) {
        html += `<div class="dv-group-label"><i class="fa-solid fa-calendar-xmark"></i> Older</div>`;
        html += groups.older.map(d => cardHtml(d, globalIdx++)).join('');
    }

    container.innerHTML = html;
}

function getTimeAgo(date) {
    const now  = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}

window.revokeDevice = function(id) {
    if (!confirm('Sign out and remove this device from login history?')) return;
    let devices = getDevices().filter(d => d.id !== id);
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
    triggerHaptic(25);
    playSound('success');
    renderDeviceList();
};

window.clearAllDevices = function() {
    if (!confirm('Clear all other login history? Only this device will remain.')) return;
    let devices = getDevices().filter(d => d.isCurrent);
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
    renderDeviceList();
};

window.signOutAllOtherDevices = function() {
    if (!confirm('Sign out of all other devices? This device will remain active.')) return;
    let devices = getDevices().filter(d => d.isCurrent);
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
    triggerHaptic(30);
    playSound('success');
    renderDeviceList();
    // Flash security strip green
    const strip = document.getElementById('dvSecurityStrip');
    if (strip) {
        strip.style.borderColor = 'var(--success)';
        strip.style.boxShadow = '0 0 12px rgba(16,185,129,0.3)';
        setTimeout(() => { strip.style.borderColor = ''; strip.style.boxShadow = ''; }, 1500);
    }
};




// Auth & Lock Elements
const lockScreen = document.getElementById('lockScreen');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');

// Settings Elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsNameInput = document.getElementById('settingsNameInput');
const settingsBudgetInput = document.getElementById('settingsBudgetInput');
const settingsGoalName = document.getElementById('settingsGoalName');
const settingsGoalAmount = document.getElementById('settingsGoalAmount');
const userProfileBtn = document.getElementById('userProfileBtn');
const pinToggle = document.getElementById('pinToggle');
const pinSetupArea = document.getElementById('pinSetupArea');
const newPinInput = document.getElementById('newPin');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const appContainer = document.getElementById('appContainer');
const displayUsername = document.getElementById('displayUsername');
const displayCardholder = document.getElementById('displayCardholder');
const displayAvatar = document.getElementById('displayAvatar');
const themeSelect = document.getElementById('themeSelect');
const oledToggle = document.getElementById('oledToggle');
const accentColorPicker = document.getElementById('accentColorPicker');
const familyToggle = document.getElementById('familyToggle');
const hapticToggle = document.getElementById('hapticToggle');
const soundToggle = document.getElementById('soundToggle');
const familyMemberManager = document.getElementById('familyMemberManager');
const newMemberInput = document.getElementById('newMemberInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const memberListUI = document.getElementById('memberList');
const memberSelector = document.getElementById('memberSelector');
const memberSelectorGroup = document.getElementById('memberSelectorGroup');

const isRecurringToggle = document.getElementById('isRecurring');
const recurringFrequencySelect = document.getElementById('recurringFrequency');

if (isRecurringToggle) {
    isRecurringToggle.addEventListener('change', () => {
        recurringFrequencySelect.style.display = isRecurringToggle.checked ? 'block' : 'none';
    });
}

// =====================================================
// PROFILE PICTURE UPLOAD
// =====================================================
const avatarFileInput       = document.getElementById('avatarFileInput');
const sidebarAvatarWrapper  = document.getElementById('sidebarAvatarWrapper');
const settingsAvatarWrapper = document.getElementById('settingsAvatarWrapper');
const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
const removeAvatarBtn       = document.getElementById('removeAvatarBtn');

function applyAvatar(url) {
    const src = url || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(userName)}`;
    if (displayAvatar) displayAvatar.src = src;
    if (settingsAvatarPreview) settingsAvatarPreview.src = src;
    if (removeAvatarBtn) removeAvatarBtn.style.display = url ? 'block' : 'none';
}

function triggerAvatarPicker() {
    if (avatarFileInput) avatarFileInput.click();
}

if (sidebarAvatarWrapper) {
    sidebarAvatarWrapper.addEventListener('click', (e) => {
        e.stopPropagation(); // don't open settings
        triggerAvatarPicker();
    });
}

if (settingsAvatarWrapper) {
    settingsAvatarWrapper.addEventListener('click', triggerAvatarPicker);
}

if (avatarFileInput) {
    avatarFileInput.addEventListener('change', () => {
        const file = avatarFileInput.files[0];
        if (!file) return;

        // Validate: images only, max 5 MB
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPG, PNG, GIF, WebP, etc.)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image is too large. Please choose a file under 5 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            customAvatarUrl = e.target.result;
            localStorage.setItem('customAvatarUrl', customAvatarUrl);
            applyAvatar(customAvatarUrl);
        };
        reader.readAsDataURL(file);
        avatarFileInput.value = ''; // reset so same file can be re-selected
    });
}

if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', () => {
        customAvatarUrl = null;
        localStorage.removeItem('customAvatarUrl');
        applyAvatar(null);
    });
}

// Apply saved avatar on load
applyAvatar(customAvatarUrl);

// Budget Elements
const budgetContainer = document.getElementById('budgetContainer');
const budgetRatio = document.getElementById('budgetRatio');
const budgetFill = document.getElementById('budgetFill');
const budgetAlertMsg = document.getElementById('budgetAlertMsg');

// Main Views
const dashboardView = document.getElementById('dashboard');
const analyticsView = document.getElementById('analytics');
const subscriptionsView = document.getElementById('subscriptions');
const navLinks = document.querySelectorAll('.nav-links li');

// Goal Elements
const goalTracker = document.getElementById('goalTracker');
const displayGoalName = document.getElementById('displayGoalName');
const displayGoalRatio = document.getElementById('displayGoalRatio');
const goalFill = document.getElementById('goalFill');
const goalCompleteMsg = document.getElementById('goalCompleteMsg');

// Social Sharing
const shareAppBtn = document.getElementById('shareAppBtn');
const shareCardBtn = document.getElementById('shareCardBtn');

// ATM Card 3D Effect
const cardContainer = document.getElementById('atmCard');
const cardMain = cardContainer.querySelector('.atm-card');
const cardGlare = cardMain.querySelector('.card-glare');

cardContainer.addEventListener('mousemove', (e) => {
    const rect = cardContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation (max 10 deg)
    const rotateX = (centerY - y) / 10;
    const rotateY = (x - centerX) / 10;
    
    cardContainer.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    
    // Dynamic Glare Position
    if (cardGlare) {
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        // Translate glare to follow mouse inverse
        cardGlare.style.transform = `translate(-${glareX}%, -${glareY}%) rotate(25deg)`;
        cardGlare.style.opacity = '1';
    }
});

cardContainer.addEventListener('mouseleave', () => {
    cardContainer.style.transform = `perspective(1000px) rotateX(0) rotateY(0)`;
    if (cardGlare) {
        cardGlare.style.transform = 'translate(-50%, -50%) rotate(25deg)';
        cardGlare.style.opacity = '0.5';
    }
});

// Category Icons Mapping
const categoryIcons = {
    'Food': { icon: 'fa-burger', class: 't-food' },
    'Transport': { icon: 'fa-car', class: 't-transport' },
    'Shopping': { icon: 'fa-bag-shopping', class: 't-shopping' },
    'Bills': { icon: 'fa-file-invoice-dollar', class: 't-bills' },
    'Entertainment': { icon: 'fa-film', class: 't-entertainment' },
    'Salary': { icon: 'fa-sack-dollar', class: 't-salary' },
    'Other': { icon: 'fa-star', class: 't-other' }
};

// Functions
function handleLoading() {
    const loader = document.getElementById('loadingScreen');
    const progress = document.getElementById('loadingProgress');
    
    if (!loader || !progress) return;

    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                loader.classList.add('fade-out');
                applyTheme();
                // Route: show auth if no account, else login screen
                initAuthScreen();
            }, 500);
        } else {
            const increment = Math.max(0.5, (100 - width) / 10);
            width += increment;
            if (width > 100) width = 100;
            progress.style.width = width + '%';
        }
    }, 50);
}

// =====================================================
// AUTH — LOGIN / SIGN UP
// =====================================================
const AUTH_KEY = 'epro_account';

function hashPassword(pw) {
    // Simple reversible obfuscation for local storage (not production crypto)
    return btoa(unescape(encodeURIComponent(pw + '_epro_salt')));
}

function getAccount() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}

function initAuthScreen() {
    const authScreen  = document.getElementById('authScreen');
    const appContainer = document.getElementById('appContainer');
    const account = getAccount();
    const isRemembered = localStorage.getItem('epro_remembered') === 'true';

    if (!authScreen) {
        initAuth(); updateUI();
        return;
    }

    if (account && isRemembered) {
        // Auto-login
        enterApp();
        return;
    }

    if (account) {
        switchAuthTab('login');
    } else {
        switchAuthTab('signup');
    }

    authScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function enterApp() {
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.style.display = 'none';
    registerDevice();  // always record this device on entry
    initAuth();   // handles PIN lock screen
    updateUI();
}

window.switchAuthTab = function(tab) {
    const loginForm   = document.getElementById('loginForm');
    const signupForm  = document.getElementById('signupForm');
    const loginTab    = document.getElementById('loginTab');
    const signupTab   = document.getElementById('signupTab');

    if (tab === 'login') {
        loginForm.style.display  = 'flex';
        signupForm.style.display = 'none';
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
    } else {
        loginForm.style.display  = 'none';
        signupForm.style.display = 'flex';
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
    }
};

window.handleLogin = function(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('loginUsername').value.trim().toLowerCase();
    const passwordInput = document.getElementById('loginPassword').value;
    const loginError    = document.getElementById('loginError');
    const account = getAccount();

    if (!account || account.username !== usernameInput || account.password !== hashPassword(passwordInput)) {
        loginError.style.display = 'flex';
        document.getElementById('loginPassword').value = '';
        // Shake animation
        const card = document.querySelector('.auth-card');
        card.style.animation = 'none';
        card.offsetHeight; // reflow
        card.style.animation = 'authShake 0.4s ease';
        setTimeout(() => card.style.animation = '', 500);
        return;
    }

    loginError.style.display = 'none';
    
    // Remember me logic
    const keepIn = document.getElementById('loginKeepIn').checked;
    localStorage.setItem('epro_remembered', keepIn);

    // Set userName so the app shows the right name
    userName = account.displayName || account.username;
    localStorage.setItem('userName', userName);
    registerDevice();
    enterApp();
};

window.handleSignup = function(e) {
    e.preventDefault();
    const displayName = document.getElementById('signupName').value.trim();
    const username    = document.getElementById('signupUsername').value.trim().toLowerCase();
    const password    = document.getElementById('signupPassword').value;
    const signupError = document.getElementById('signupError');

    if (!displayName || !username || !password) {
        signupError.style.display = 'block';
        signupError.textContent   = 'All fields are required.';
        return;
    }
    if (password.length < 6) {
        signupError.style.display = 'block';
        signupError.textContent   = 'Password must be at least 6 characters.';
        return;
    }

    const account = { displayName, username, password: hashPassword(password) };
    localStorage.setItem(AUTH_KEY, JSON.stringify(account));

    // Remember me logic
    const keepIn = document.getElementById('signupKeepIn').checked;
    localStorage.setItem('epro_remembered', keepIn);

    // Set user display name
    userName = displayName;
    localStorage.setItem('userName', userName);
    signupError.style.display = 'none';
    registerDevice();
    enterApp();
};

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
};

window.logoutUser = function() {
    if (!confirm('Log out of ExpensePro?')) return;
    localStorage.setItem('epro_remembered', 'false');
    const authScreen   = document.getElementById('authScreen');
    const appContainer = document.getElementById('appContainer');
    if (appContainer) appContainer.style.display = 'none';
    if (authScreen)   { authScreen.style.display = 'flex'; switchAuthTab('login'); }
};

// Initial Call
document.addEventListener('DOMContentLoaded', () => {
    restoreFromIndexedDB().then(() => {
        handleLoading();
    });

    if (toggleBalanceBtn) {
        // Initial setup
        if (isBalanceHidden) {
            if (balanceEyeIcon) balanceEyeIcon.className = 'fa-solid fa-eye-slash';
            setTimeout(() => {
                document.querySelectorAll('.sensitive-amount').forEach(el => el.classList.add('blur-balance'));
            }, 0);
        }

        toggleBalanceBtn.addEventListener('click', () => {
            isBalanceHidden = !isBalanceHidden;
            localStorage.setItem('isBalanceHidden', isBalanceHidden);
            
            document.querySelectorAll('.sensitive-amount').forEach(el => {
                if (isBalanceHidden) el.classList.add('blur-balance');
                else el.classList.remove('blur-balance');
            });

            if (balanceEyeIcon) {
                balanceEyeIcon.className = isBalanceHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
        });
    }

    // Live Date & Time on Dashboard
    const dashboardDate = document.getElementById('dashboardDate');
    function updateDashboardDate() {
        if (!dashboardDate) return;
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString(undefined, options);
        const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dashboardDate.textContent = `${dateStr} • ${timeStr}`;
    }
    updateDashboardDate();
    setInterval(updateDashboardDate, 1000);
});

function updateUI() {
    renderTransactions();
    updateBalance();
    updateChart();
    updateSplitAnalytics();
    
    if (userName) {
        if (displayUsername) displayUsername.innerText = userName;
        if (displayCardholder) displayCardholder.innerText = userName;
    }
    applyAvatar(customAvatarUrl);
    
    // Save to local storage
    localStorage.setItem('transactions', JSON.stringify(transactions));
    syncToIndexedDB(); // Mirror to IndexedDB
}

function updateBalance() {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);
        
    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);
        
    const total = income - expense;
    
    // Format to selected currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currentCurrency
        }).format(amount);
    };
    
    // Animate the balance update
    animateValue(totalBalanceEl, total, formatCurrency);
    animateValue(totalIncomeEl, income, formatCurrency);
    animateValue(totalExpenseEl, expense, formatCurrency);

    // Budget Logic
    if (monthlyBudget > 0) {
        if(budgetContainer) budgetContainer.style.display = 'block';
        if(budgetRatio) budgetRatio.innerText = `${formatCurrency(expense)} / ${formatCurrency(monthlyBudget)}`;
        
        let percentage = (expense / monthlyBudget) * 100;
        
        if (budgetFill) {
            budgetFill.style.width = `${Math.min(percentage, 100)}%`;
            budgetFill.className = 'budget-fill'; // reset
            
            if (percentage >= 100) {
                budgetFill.classList.add('danger');
                if(budgetAlertMsg) budgetAlertMsg.style.display = 'block';
                totalExpenseEl.style.color = 'var(--danger)';
            } else if (percentage >= 80) {
                budgetFill.classList.add('warning');
                if(budgetAlertMsg) budgetAlertMsg.style.display = 'none';
                totalExpenseEl.style.color = 'var(--text-primary)';
            } else {
                if(budgetAlertMsg) budgetAlertMsg.style.display = 'none';
                totalExpenseEl.style.color = 'var(--text-primary)';
            }
        }
    } else {
        if(budgetContainer) budgetContainer.style.display = 'none';
        totalExpenseEl.style.color = 'var(--text-primary)';
    }

    // Goal Logic
    if (goalAmount > 0 && goalName) {
        if(goalTracker) goalTracker.style.display = 'block';
        if(displayGoalName) displayGoalName.innerText = goalName;
        
        const safeTotal = total > 0 ? total : 0;
        if(displayGoalRatio) displayGoalRatio.innerText = `${formatCurrency(safeTotal)} / ${formatCurrency(goalAmount)}`;
        
        let percentage = (safeTotal / goalAmount) * 100;
        
        if (goalFill) {
            goalFill.style.width = `${Math.min(percentage, 100)}%`;
            if (percentage >= 100) {
                if(goalCompleteMsg && goalCompleteMsg.style.display === 'none') {
                    goalCompleteMsg.style.display = 'block';
                    triggerConfetti();
                }
                goalFill.style.backgroundColor = 'var(--success)';
            } else {
                if(goalCompleteMsg) goalCompleteMsg.style.display = 'none';
                goalFill.style.backgroundColor = 'var(--accent-color)';
            }
        }
    } else {
        if(goalTracker) goalTracker.style.display = 'none';
    }
}

// Advanced counter animation for numbers
function animateValue(obj, targetValue, formatter) {
    let startValue = parseFloat(obj.getAttribute('data-raw-val')) || 0;
    
    if (startValue === targetValue && obj.innerText !== '') {
        obj.style.transform = 'scale(1.05)';
        setTimeout(() => obj.style.transform = 'scale(1)', 150);
        return;
    }
    
    obj.setAttribute('data-raw-val', targetValue);
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const easeProgress = 1 - Math.pow(2, -10 * progress);
        const currentVal = startValue + (targetValue - startValue) * easeProgress;
        
        obj.innerText = formatter(currentVal);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            obj.innerText = formatter(targetValue);
            obj.style.transform = 'scale(1.05)';
            obj.style.transition = 'transform 0.15s ease';
            setTimeout(() => obj.style.transform = 'scale(1)', 150);
        }
    }
    requestAnimationFrame(update);
}

window.filterTransactions = function() {
    renderTransactions();
};

window.clearSearch = function() {
    const searchInput = document.getElementById('transactionSearch');
    if (searchInput) {
        searchInput.value = '';
        renderTransactions();
    }
};

function renderTransactions() {
    const searchTerm = document.getElementById('transactionSearch')?.value.toLowerCase() || '';
    transactionListEl.innerHTML = '';
    
    let filteredTransactions = transactions;
    if (searchTerm) {
        filteredTransactions = transactions.filter(t => 
            t.description.toLowerCase().includes(searchTerm) || 
            t.category.toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm)
        );
    }

    if (filteredTransactions.length === 0) {
        transactionListEl.innerHTML = searchTerm 
            ? '<div class="empty-state">No transactions match your search.</div>'
            : '<div class="empty-state">No transactions yet. Add one!</div>';
        return;
    }
    
    // Sort by date newest first
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Grouping logic
    const groups = {};
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

    sorted.forEach(t => {
        const date = new Date(t.date).toLocaleDateString();
        let groupLabel = date;
        if (date === today) groupLabel = 'Today';
        else if (date === yesterday) groupLabel = 'Yesterday';
        
        if (!groups[groupLabel]) groups[groupLabel] = [];
        groups[groupLabel].push(t);
    });

    // Calculate average for spike detection
    const expenses = transactions.filter(t => t.type === 'expense');
    const avgExpense = expenses.length > 0 ? expenses.reduce((acc, curr) => acc + curr.amount, 0) / expenses.length : 0;
    const now = new Date().getTime();

    Object.keys(groups).forEach(label => {
        // Add Date Header
        const header = document.createElement('div');
        header.className = 'date-group-header';
        header.innerHTML = `<span>${label}</span> <span class="date-group-count">${groups[label].length} items</span>`;
        transactionListEl.appendChild(header);

        groups[label].forEach(t => {
            const li = document.createElement('li');
            li.className = 'transaction-item';
            
            const isNew = (now - new Date(t.date).getTime()) < 3000;
            const isSpike = t.type === 'expense' && t.amount > (avgExpense * 1.5) && expenses.length >= 3;
            
            if (isNew) li.classList.add('highlight-new');
            if (isSpike) li.classList.add('spike');

            const catInfo = categoryIcons[t.category] || categoryIcons['Other'];
            const amountClass = t.type === 'income' ? 'income' : 'expense';
            const sign = t.type === 'income' ? '+' : '-';
            
            const timeStr = new Date(t.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            li.innerHTML = `
                <div class="t-icon ${catInfo.class}">
                    <i class="fa-solid ${catInfo.icon}"></i>
                </div>
                <div class="t-info">
                    <div class="t-title">${t.description} ${isSpike ? '<span class="spike-tag">Spike</span>' : ''}</div>
                    <div class="t-date">${timeStr} • ${t.category}${isFamilyMode ? ' • ' + (t.member || 'Me') : ''}</div>
                </div>
                <div class="t-amount ${amountClass}">
                    ${sign}${new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(t.amount)}
                </div>
                <div class="t-actions">
                    <button class="action-icon-btn edit-btn" onclick="openEditTransactionModal('${t.id}')" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-icon-btn split-btn" onclick="openSplitModal('${t.id}')" title="Split Record">
                        <i class="fa-solid fa-handshake-angle"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" onclick="deleteTransaction('${t.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            transactionListEl.appendChild(li);
        });
    });
}

function openEditTransactionModal(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    
    editingId = id;
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('active');
    
    document.getElementById('modalTitle').innerText = 'Edit Transaction';
    document.getElementById('saveBtn').innerText = 'Update Transaction';
    
    document.getElementById('amount').value = t.amount;
    document.getElementById('category').value = t.category;
    document.getElementById('description').value = t.description;
    
    if (t.type === 'income') {
        document.getElementById('typeIncome').checked = true;
    } else {
        document.getElementById('typeExpense').checked = true;
    }

    if (isFamilyMode && t.member) {
        memberSelector.value = t.member;
    }
    
    if (t.isRecurring) {
        isRecurringToggle.checked = true;
        recurringFrequencySelect.style.display = 'block';
        recurringFrequencySelect.value = t.frequency;
    } else {
        isRecurringToggle.checked = false;
        recurringFrequencySelect.style.display = 'none';
    }
}

// Modal Helper
function openModal() {
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('active');
    document.body.classList.add('modal-open');
    document.getElementById('modalTitle').innerText = 'Add New Record';
    document.getElementById('saveBtn').innerText = 'Save Transaction';
    editingId = null;
    transactionForm.reset();
}

function openEditModal(id) {
    openEditTransactionModal(id);
}

function deleteTransaction(id) {
    if (confirm("Are you sure you want to delete this? If this is a recurring subscription, all future automated entries will stop.")) {
        transactions = transactions.filter(t => t.id !== id);
        triggerHaptic(20);
        playSound('success');
        updateUI();
        if (subscriptionsView.style.display !== 'none') renderSubscriptions();
    }
}

function addTransaction(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    
    if (isNaN(amount) || amount <= 0) {
        playSound('error');
        alert("Please enter a valid amount");
        return;
    }
    
    // Fallback if description is empty
    const finalDescription = description.trim() || category;
    
    const saveBtn = document.getElementById('saveBtn');
    const originalHtml = saveBtn.innerHTML;
    saveBtn.classList.add('loading');

    setTimeout(() => {
        const addWithSplit = document.getElementById('addWithSplit')?.checked;
        const editingTransactionId = editingId; // Use existing editingId
        const selectedMember = isFamilyMode ? memberSelector.value : 'Me';
        const isRecurring = isRecurringToggle?.checked || false;
        const frequency = isRecurring ? recurringFrequencySelect.value : null;

        const newTransaction = {
            id: editingTransactionId || `t_${Date.now()}`,
            type,
            amount,
            category,
            description: finalDescription, // Use finalDescription
            member: selectedMember,
            isRecurring,
            frequency,
            lastProcessed: isRecurring ? new Date().toISOString() : null,
            date: new Date().toISOString()
        };

        if (editingTransactionId) {
            const index = transactions.findIndex(t => t.id === editingTransactionId);
            if (index !== -1) {
                transactions[index] = newTransaction;
            }
            editingId = null; // Clear editingId after update
        } else {
            // Duplicate Check (omitted for brevity in this chunk, keeping original logic)
            const isDuplicate = transactions.find(t => 
                t.description.toLowerCase() === finalDescription.toLowerCase() &&
                t.amount === amount &&
                t.type === type &&
                t.category === category &&
                (new Date() - new Date(t.date)) < 24 * 60 * 60 * 1000
            );

            if (isDuplicate) {
                const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(amount);
                if (!confirm(`Warning: A similar ${type} ("${finalDescription}" for ${formatted}) was already added in the last 24 hours. Add it anyway?`)) {
                    saveBtn.classList.remove('loading');
                    return;
                }
            }
            transactions.unshift(newTransaction); // Changed from push to unshift
        }
        
        showButtonSuccess(saveBtn, originalHtml);
        
        setTimeout(() => {
            transactionForm.reset();
            editingId = null;
            document.getElementById('typeExpense').checked = true;
            closeModal('modalOverlay');
            window.clearSearch();
            updateUI();
            if (subscriptionsView.style.display !== 'none') renderSubscriptions();

            if (addWithSplit) {
                setTimeout(() => openSplitModal(newTransaction.id), 500);
            }
        }, 500);
    }, 600);
}

window.cancelSubscription = function(id) {
    const s = transactions.find(t => t.id === id);
    if (!s) return;
    
    if (confirm(`Are you sure you want to cancel "${s.description}"? This will stop future recurring entries.`)) {
        const subItems = document.querySelectorAll('.transaction-item');
        subItems.forEach(item => {
            if (item.querySelector('.t-title')?.innerText.includes(s.description)) {
                item.classList.add('sub-item-cancelling');
            }
        });

        setTimeout(() => {
            transactions = transactions.filter(t => t.id !== id);
            triggerHaptic(50);
            playSound('success');
            updateUI();
            if (subscriptionsView.style.display !== 'none') renderSubscriptions();
        }, 600);
    }
}

// =====================================================
// USER FEEDBACK PRO
// =====================================================
window.openFeedbackModal = function() {
    const modal = document.getElementById('feedbackModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    triggerHaptic(20);
};

window.submitFeedback = function() {
    const category = document.getElementById('feedbackCategory').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    const btn = document.getElementById('submitFeedbackBtn');
    const formBody = document.querySelector('#feedbackModal .form-body');
    
    if (!message) {
        alert("Please enter a message");
        return;
    }
    
    btn.classList.add('loading');
    const originalHtml = btn.innerHTML;
    
    // Mocking submission
    setTimeout(() => {
        btn.classList.remove('loading');
        
        // Show Success State
        formBody.innerHTML = `
            <div class="feedback-success">
                <i class="fa-solid fa-circle-check"></i>
                <h3>Thank You!</h3>
                <p class="subtitle" style="margin-top:0.5rem;">Your ${category} has been sent successfully. We appreciate your input!</p>
                <button class="btn-primary" style="margin-top:2rem; width:100%; justify-content:center;" onclick="closeModal('feedbackModal'); resetFeedbackUI();">Close</button>
            </div>
        `;
        
        playSound('success');
        triggerHaptic(60);
        
        // Save to local for history if needed
        const feedbackHistory = JSON.parse(localStorage.getItem('epro_feedback')) || [];
        feedbackHistory.push({ category, message, time: new Date().toISOString() });
        localStorage.setItem('epro_feedback', JSON.stringify(feedbackHistory));
    }, 1500);
};

window.resetFeedbackUI = function() {
    // We'll hard-reload via render logic next time, but for now:
    setTimeout(() => location.reload(), 500); // Simple reset
};

// Character counter
document.getElementById('feedbackMessage')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    const countEl = document.getElementById('charCount');
    if (countEl) {
        countEl.innerText = `${count}/1000`;
        countEl.style.color = count > 900 ? 'var(--danger)' : 'var(--text-secondary)';
    }
});

window.toggleSubscriptionPause = function(id) {
    const s = transactions.find(t => t.id === id);
    if (!s) return;
    
    s.isPaused = !s.isPaused;
    triggerHaptic(30);
    playSound('success');
    renderSubscriptions();
};

/**
 * Creates a linear gradient for Chart.js
 */
function createChartGradient(ctx, color, opacityStart = 0.4, opacityEnd = 0) {
    if (!ctx) return color;
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color.replace('1)', `${opacityStart})`).replace('rgb', 'rgba'));
    gradient.addColorStop(1, color.replace('1)', `${opacityEnd})`).replace('rgb', 'rgba'));
    return gradient;
}

function updateChart() {
    const dashboardCtx = document.getElementById('spendingChart');
    const mainCtx = document.getElementById('mainSpendingChart');
    const memberCtx = document.getElementById('memberSpendingChart');
    if (!dashboardCtx && !mainCtx) return;
    
    // 1. Spending by Category
    const expensesByCategory = {};
    const expensesByMember = {};
    const now = new Date();
    const isWeek = typeof currentChartPeriod !== 'undefined' && currentChartPeriod === 'week';
    
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const tDate = new Date(t.date);
            let include = true;
            
            if (isWeek) {
                const diffTime = Math.abs(now - tDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 7) include = false;
            } else {
                // Default to current month
                if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) {
                    include = false;
                }
            }
            
            if (include) {
                expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
                if (isFamilyMode) {
                    const m = t.member || 'Me';
                    expensesByMember[m] = (expensesByMember[m] || 0) + t.amount;
                }
            }
        }
    });
    
    const labels = Object.keys(expensesByCategory);
    const data = Object.values(expensesByCategory);

    // Member chart logic
    if (isFamilyMode && memberCtx) {
        if (memberChartInstance) memberChartInstance.destroy();
        const mLabels = Object.keys(expensesByMember);
        const mData = Object.values(expensesByMember);
        const ctx = memberCtx.getContext('2d');
        const gradient = createChartGradient(ctx, 'rgba(99, 102, 241, 1)', 0.6, 0.1);
        
        memberChartInstance = new Chart(memberCtx, {
            type: 'bar',
            data: {
                labels: mLabels,
                datasets: [{
                    label: 'Spending per Member',
                    data: mData,
                    backgroundColor: gradient,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 2,
                    borderRadius: 12, // More rounded for premium feel
                    maxBarThickness: 45,
                    hoverBackgroundColor: 'rgba(99, 102, 241, 0.8)',
                    hoverBorderColor: '#fff',
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
                        ticks: { color: 'var(--text-secondary)', font: { family: 'Outfit', size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'var(--text-secondary)', font: { family: 'Outfit', size: 12 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                        bodyFont: { family: 'Outfit', size: 14 },
                        padding: 15,
                        cornerRadius: 15,
                        displayColors: false,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => ` Total: ${formatCurrency(context.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    // 4. Behavioral Intelligence
    updateBehavioralInsights();

    // Update Budget Status Badge
    const budgetStatus = document.getElementById('budgetStatus');
    if (budgetStatus) {
        const totalExp = data.reduce((a, b) => a + b, 0);
        if (monthlyBudget > 0) {
            const remaining = monthlyBudget - totalExp;
            budgetStatus.innerText = `Remaining: ${formatCurrency(remaining)}`;
            budgetStatus.className = remaining < 0 ? 'badge danger' : (remaining < monthlyBudget * 0.2 ? 'badge warning' : 'badge');
        } else {
            budgetStatus.innerText = 'Budget not set';
            budgetStatus.className = 'badge';
        }
    }
    
    // Generate Category Breakdown List (Dashboard & Analytics)
    const breakdownContainers = [
        document.getElementById('categoryBreakdown'),
        document.getElementById('analyticsCategoryBreakdown')
    ];
    
    breakdownContainers.forEach(el => {
        if (!el) return;
        el.innerHTML = '';
        const totalExp = data.reduce((a, b) => a + b, 0);
        
        labels.forEach((label, i) => {
            const amount = data[i];
            const pct = totalExp > 0 ? (amount / totalExp * 100).toFixed(0) : 0;
            const color = colors[i % colors.length];
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.setAttribute('role', 'button');
            item.setAttribute('title', `Click to filter tasks by ${label}`);
            item.onclick = () => filterByCategory(label);
            
            // Hover highlighting for chart
            item.onmouseenter = () => {
                if (chartInstance && targetCtx === mainCtx) {
                    chartInstance.setActiveElements([{ datasetIndex: 0, index: i }]);
                    chartInstance.update();
                }
            };
            item.onmouseleave = () => {
                if (chartInstance && targetCtx === mainCtx) {
                    chartInstance.setActiveElements([]);
                    chartInstance.update();
                }
            };

            item.innerHTML = `
                <div class="breakdown-info">
                    <span class="breakdown-name">${label}</span>
                    <span class="breakdown-value">${formatCurrency(amount)} (${pct}%)</span>
                </div>
                <div class="breakdown-bar-container">
                    <div class="breakdown-bar" style="width: ${pct}%; background: ${color}"></div>
                </div>
            `;
            el.appendChild(item);
        });
    });

    // Update Detailed Insight Report
    updateDetailedInsights(labels, data, totalExp);

    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Render on whichever is active
    const targetCtx = mainCtx && analyticsView.style.display !== 'none' ? mainCtx : dashboardCtx;
    if (!targetCtx) return;

    chartInstance = new Chart(targetCtx, {
        type: categoryChartType || 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? colors : ['#334155'],
                borderWidth: 0,
                hoverOffset: 15,
                weight: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateScale: true,
                animateRotate: true
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Outfit', size: 14 },
                    bodyFont: { family: 'Outfit', size: 14 },
                    padding: 15,
                    cornerRadius: 12,
                    displayColors: true,
                    boxPadding: 6
                }
            },
            cutout: '75%'
        }
    });

    // 5. Monthly Spending Trend (Line Chart)
    const trendCtxEl = document.getElementById('trendSpendingChart');
    if (trendCtxEl) {
        if (window.trendChartInstance) window.trendChartInstance.destroy();
        
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyData = new Array(daysInMonth).fill(0);
        
        transactions.forEach(t => {
            const d = new Date(t.date);
            if (t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                dailyData[d.getDate() - 1] += t.amount;
            }
        });

        let cumulative = 0;
        const cumulativeData = dailyData.map(val => {
            cumulative += val;
            return cumulative;
        });

        const ctxLine = trendCtxEl.getContext('2d');
        const lineGradient = createChartGradient(ctxLine, 'rgba(99, 102, 241, 1)', 0.4, 0.05);

        window.trendChartInstance = new Chart(trendCtxEl, {
            type: 'line',
            data: {
                labels: Array.from({length: daysInMonth}, (_, i) => i + 1),
                datasets: [{
                    label: 'Spent To Date',
                    data: cumulativeData,
                    borderColor: '#6366f1',
                    backgroundColor: lineGradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
                        ticks: { color: 'var(--text-secondary)', callback: (v) => formatCurrency(v) }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'var(--text-secondary)', autoSkip: true, maxTicksLimit: 10 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                        bodyFont: { family: 'Outfit', size: 14 },
                        padding: 15,
                        cornerRadius: 15,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => ` Cumulative: ${formatCurrency(ctx.parsed.y)}`
                        }
                    }
                }
            }
        });
    }
    
    updateAnalyticsStats();
}

// =====================================================
// SPLIT MONEY FEATURE
// =====================================================
let splitTransactionId = null;

window.openSplitModal = function(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    splitTransactionId = id;
    const modal = document.getElementById('splitModal');
    const totalEl = document.getElementById('splitTotalAmount');
    const titleEl = modal.querySelector('h2');
    
    titleEl.innerHTML = t.type === 'income' ? '<i class="fa-solid fa-handshake-angle"></i> Split This Income' : '<i class="fa-solid fa-handshake-angle"></i> Split This Bill';
    
    totalEl.innerText = new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: currentCurrency 
    }).format(t.amount);
    
    renderSplitMembersList(t.amount);
    modal.classList.add('active');
    triggerHaptic(15);
};

function renderSplitMembersList(totalAmount) {
    const container = document.getElementById('splitMembersList');
    if (!container) return;
    
    // Always include 'Me' as a participant
    const members = isFamilyMode ? ['Me', ...familyMembers] : ['Me'];
    // Filter out duplicates if 'Me' is in familyMembers
    const uniqueMembers = [...new Set(members)];
    
    container.innerHTML = uniqueMembers.map(m => `
        <label class="split-member-item">
            <input type="checkbox" name="splitMember" value="${m}" checked onchange="updateSplitCalc(${totalAmount})">
            <div class="split-member-info">
                <span class="split-member-name">${m}</span>
                <span class="split-member-share" data-member="${m}"></span>
            </div>
        </label>
    `).join('');
    
    updateSplitCalc(totalAmount);
}

window.updateSplitCalc = function(totalAmount) {
    const checked = document.querySelectorAll('input[name="splitMember"]:checked');
    const perPersonEl = document.getElementById('splitPerPerson');
    const shareEls = document.querySelectorAll('.split-member-share');
    
    if (checked.length === 0) {
        perPersonEl.innerText = '--';
        shareEls.forEach(el => el.innerText = '');
        return;
    }
    
    const share = totalAmount / checked.length;
    const formatted = new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: currentCurrency 
    }).format(share);
    
    perPersonEl.innerText = formatted;
    
    // Update individual share labels
    const checkedValues = Array.from(checked).map(c => c.value);
    shareEls.forEach(el => {
        const m = el.getAttribute('data-member');
        el.innerText = checkedValues.includes(m) ? `Share: ${formatted}` : '';
    });
};

window.selectAllSplitMembers = function() {
    const checkboxes = document.querySelectorAll('input[name="splitMember"]');
    checkboxes.forEach(c => c.checked = true);
    // Get total from existing modal state or original transaction
    const t = transactions.find(item => item.id === splitTransactionId);
    if (t) updateSplitCalc(t.amount);
};

window.closeSplitModal = function() {
    document.getElementById('splitModal').classList.remove('active');
    splitTransactionId = null;
};

// Bind close button
document.getElementById('closeSplitModalBtn')?.addEventListener('click', closeSplitModal);

document.getElementById('confirmSplitBtn')?.addEventListener('click', () => {
    const checked = document.querySelectorAll('input[name="splitMember"]:checked');
    if (checked.length === 0) {
        alert("Select at least one participant");
        return;
    }
    
    const tOriginal = transactions.find(t => t.id === splitTransactionId);
    if (!tOriginal) return;
    
    const participants = Array.from(checked).map(c => c.value);
    const count = participants.length;
    
    // Precision rounding: avoid floating point issues
    const totalCents = Math.round(tOriginal.amount * 100);
    const splitCents = Math.floor(totalCents / count);
    const remainderCents = totalCents % count;
    
    // Remove original and add splits
    transactions = transactions.filter(t => t.id !== splitTransactionId);
    
    participants.forEach((p, idx) => {
        // Add 1 cent to the first N participants where N is the remainder
        const currentAmountCents = splitCents + (idx < remainderCents ? 1 : 0);
        
        const splitTx = {
            ...tOriginal,
            id: `split_${Date.now()}_${idx}`,
            amount: currentAmountCents / 100,
            member: p,
            isSplitChild: true,
            splitParentId: splitTransactionId,
            splitParticipants: participants
        };
        transactions.push(splitTx);
    });
    
    playSound('success');
    triggerHaptic(40);
    closeSplitModal();
    updateUI();
    updateSplitAnalytics();
});

function updateSplitAnalytics() {
    const totalSplitEl = document.getElementById('totalSplitBadge');
    const topPartnerEl = document.getElementById('topSplitPartner');
    const avgSplitEl = document.getElementById('avgSplitAmount');
    const splitCountEl = document.getElementById('splitCount');
    
    if (!totalSplitEl) return;
    
    const splits = transactions.filter(t => t.isSplitChild);
    if (splits.length === 0) {
        totalSplitEl.innerText = 'Total Split: $0';
        topPartnerEl.innerText = '--';
        avgSplitEl.innerText = '$0';
        splitCountEl.innerText = '0';
        return;
    }
    
    const totalSum = splits.reduce((acc, t) => acc + t.amount, 0);
    const distinctSplits = new Set(splits.map(t => t.splitParentId)).size;
    
    // Partners (excluding 'Me')
    const partners = {};
    splits.forEach(t => {
        if (t.member !== 'Me') {
            partners[t.member] = (partners[t.member] || 0) + 1;
        }
    });
    
    let topPartner = '--';
    let maxCount = 0;
    for (const p in partners) {
        if (partners[p] > maxCount) {
            maxCount = partners[p];
            topPartner = p;
        }
    }
    
    const format = (val) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(val);
    
    totalSplitEl.innerText = `Total Split: ${format(totalSum)}`;
    topPartnerEl.innerText = topPartner;
    avgSplitEl.innerText = format(totalSum / (splits.length || 1));
    splitCountEl.innerText = distinctSplits;
}

// Ensure updateSplitAnalytics is called in updateUI
// (Directly integrated above)

/* Structure optimized above */

function updateDetailedInsights(labels, data, total) {
    const insightEl = document.getElementById('spendingInsight');
    if (!insightEl || labels.length === 0) return;

    const maxIdx = data.indexOf(Math.max(...data));
    const topCat = labels[maxIdx];
    const topPct = ((data[maxIdx] / total) * 100).toFixed(0);
    
    let advice = `Your top spending category is <strong>${topCat}</strong>, accounting for <strong>${topPct}%</strong> of your monthly expenses. `;
    
    if (topPct > 40) {
        advice += `This is a significant portion. Consider reviewing your ${topCat} habits to find potential savings. `;
    } else {
        advice += `Your spending is relatively well-distributed across categories. `;
    }

    if (monthlyBudget > 0) {
        const remaining = monthlyBudget - total;
        if (remaining > 0) {
            advice += `You have <strong>${formatCurrency(remaining)}</strong> left in your budget. `;
        } else {
            advice += `You are <strong>${formatCurrency(Math.abs(remaining))}</strong> over your budget. `;
        }
    }

    insightEl.innerHTML = advice;
}

let currentChartPeriod = 'month';

function setChartPeriod(period, btn) {
    currentChartPeriod = period;
    
    // Update UI
    const btns = btn.parentElement.querySelectorAll('.period-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    updateChart();
}

function filterByCategory(category) {
    const searchInput = document.getElementById('transactionSearch');
    if (searchInput) {
        searchInput.value = category;
        filterTransactions();
        // Scroll to transactions
        const tSection = document.querySelector('.transactions-section');
        if (tSection) tSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Updates the high-level stats in the Analytics view
 */
function updateAnalyticsStats() {
    const avgEl = document.getElementById('avgDailySpend');
    const usedPctEl = document.getElementById('budgetUsedPct');
    const projectedEl = document.getElementById('analyticsProjectedTotal');
    
    if (!avgEl || !usedPctEl || !projectedEl) return;

    const now = new Date();
    const currentMonthExpenses = transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const totalThisMonth = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Daily Average
    const avg = dayOfMonth > 0 ? totalThisMonth / dayOfMonth : 0;
    avgEl.innerText = formatCurrency(avg);

    // Budget Used %
    if (monthlyBudget > 0) {
        const pct = ((totalThisMonth / monthlyBudget) * 100).toFixed(0);
        usedPctEl.innerText = `${pct}%`;
        usedPctEl.style.color = pct > 100 ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--text-primary)');
    } else {
        usedPctEl.innerText = 'N/A';
    }

    // Projected Total
    const projected = dayOfMonth > 0 ? (totalThisMonth / dayOfMonth) * daysInMonth : 0;
    projectedEl.innerText = formatCurrency(projected);

    // DAILY SAFE SPEND (COOL FEATURE)
    const safeSpendEl = document.getElementById('dailySafeSpend');
    if (safeSpendEl) {
        const remainingDays = daysInMonth - dayOfMonth + 1;
        const remainingBudget = monthlyBudget - totalThisMonth;
        const dailyAllowance = remainingBudget > 0 ? remainingBudget / remainingDays : 0;
        safeSpendEl.innerText = formatCurrency(dailyAllowance);
        
        // Success Confetti if doing great!
        if (totalThisMonth < monthlyBudget * 0.5 && dayOfMonth > 15) {
            triggerSuccessConfetti();
        }
    }

    // Historical Comparisons
    updateComparisons(totalThisMonth, avg, projected);

    // Update Analytics View extra components
    renderSpendingHeatmap();
    renderTopExpenses();
    renderHealthGauge(totalThisMonth);
}

function triggerSuccessConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#10b981', '#f59e0b']
        });
    }
}

function updateComparisons(totalThis, avgThis, projectedThis) {
    const avgCompareEl = document.getElementById('avgCompare');
    const budgetCompareEl = document.getElementById('budgetCompare');
    const projectedCompareEl = document.getElementById('projectedCompare');
    
    if (!avgCompareEl) return;

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    });

    const totalLast = lastMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const daysLast = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate();
    const avgLast = totalLast / daysLast;

    const updateLabel = (el, valThis, valLast) => {
        if (valLast <= 0) {
            el.innerText = 'No data for last month';
            return;
        }
        const diff = ((valThis - valLast) / valLast) * 100;
        const absDiff = Math.abs(diff).toFixed(1);
        const icon = diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const colorClass = diff > 0 ? 'trend-up' : 'trend-down';
        
        el.className = `stat-compare ${colorClass}`;
        el.innerHTML = `<i class="fa-solid ${icon}"></i> ${absDiff}% vs last month`;
    };

    updateLabel(avgCompareEl, avgThis, avgLast);
    updateLabel(projectedCompareEl, projectedThis, totalLast);
    
    // Budget used compare is different (vs budget, not vs last month normally, but let's show vs last month total)
    if (totalLast > 0) {
        const diff = ((totalThis - totalLast) / totalLast) * 100;
        budgetCompareEl.className = `stat-compare ${diff > 0 ? 'trend-up' : 'trend-down'}`;
        budgetCompareEl.innerHTML = `<i class="fa-solid ${diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${Math.abs(diff).toFixed(1)}% spend change`;
    }
}

let categoryChartType = 'doughnut';
let healthChartInstance = null;

window.toggleCategoryChartType = function(type, btn) {
    categoryChartType = type;
    const btns = btn.parentElement.querySelectorAll('.period-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateChart();
}

function renderSpendingHeatmap() {
    const container = document.getElementById('spendingHeatmap');
    if (!container) return;
    container.innerHTML = '';
    
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Calculate daily totals for intensity mapping
    const dailyTotals = new Array(daysInMonth).fill(0);
    transactions.forEach(t => {
        const d = new Date(t.date);
        if (t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            dailyTotals[d.getDate() - 1] += t.amount;
        }
    });
    
    const maxDayTotal = Math.max(...dailyTotals, 1);
    
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.setAttribute('data-day', i);
        
        const dayTotal = dailyTotals[i - 1];
        const intensity = dayTotal / maxDayTotal;
        
        if (dayTotal > 0) {
            cell.style.background = `rgba(99, 102, 241, ${0.1 + intensity * 0.9})`;
            cell.title = `Day ${i}: ${formatCurrency(dayTotal)}`;
            if (intensity > 0.7) cell.style.boxShadow = `0 0 10px rgba(99, 102, 241, 0.4)`;
        }
        
        container.appendChild(cell);
    }
}

function renderTopExpenses() {
    const list = document.getElementById('topExpensesList');
    if (!list) return;
    
    const now = new Date();
    const monthExpenses = transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    const top5 = [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
    
    list.innerHTML = top5.map(t => `
        <tr>
            <td><span style="font-weight:500;">${t.description}</span></td>
            <td><span class="table-category-tag">${t.category}</span></td>
            <td><span class="table-amount">${formatCurrency(t.amount)}</span></td>
            <td><span style="color:var(--text-secondary);font-size:0.8rem;">${new Date(t.date).toLocaleDateString()}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-secondary);">No expenses recorded this month.</td></tr>';
}

function renderHealthGauge(spent) {
    const canvas = document.getElementById('healthScoreGauge');
    const valueEl = document.getElementById('healthScoreValue');
    if (!canvas || !valueEl) return;
    
    if (healthChartInstance) healthChartInstance.destroy();
    
    let score = 0;
    if (monthlyBudget > 0) {
        score = Math.max(0, Math.min(100, (1 - (spent / monthlyBudget)) * 100)).toFixed(0);
    } else {
        score = 100; // No budget = infinite health? Let's say 100.
    }
    
    valueEl.innerText = `${score}%`;
    const scoreColor = score > 70 ? '#10b981' : (score > 40 ? '#f59e0b' : '#ef4444');
    valueEl.style.color = scoreColor;

    healthChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [scoreColor, 'rgba(255,255,255,0.05)'],
                borderWidth: 0,
                circumference: 270,
                rotation: 225,
                cutout: '85%',
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// PIN Authentication Logic
function initAuth() {
    if (isPinEnabled && appPin) {
        if(lockScreen) lockScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        if(pinInput) pinInput.value = '';
    } else {
        if(lockScreen) lockScreen.style.display = 'none';
        appContainer.style.display = 'flex';
    }
}

window.appendPin = (num) => {
    if (pinInput.value.length < 4) {
        pinInput.value += num;
        pinError.style.display = 'none';
    }
    if (pinInput.value.length === 4) {
        submitPin();
    }
};

window.clearPin = () => {
    pinInput.value = pinInput.value.slice(0, -1);
    pinError.style.display = 'none';
};

window.submitPin = () => {
    if (pinInput.value === appPin) {
        lockScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        pinInput.value = '';
    } else {
        pinError.style.display = 'block';
        pinInput.value = '';
        const panel = document.querySelector('.lock-panel');
        if(panel) {
            panel.style.transform = 'translatex(10px)';
            setTimeout(() => panel.style.transform = 'translatex(-10px)', 50);
            setTimeout(() => panel.style.transform = 'translatex(10px)', 100);
            setTimeout(() => panel.style.transform = 'translatex(0)', 150);
        }
    }
};

// Settings Logic
function openSettings() {
    settingsModal.classList.add('active');
    settingsNameInput.value = userName || '';
    if(settingsBudgetInput) settingsBudgetInput.value = monthlyBudget > 0 ? monthlyBudget : '';
    if(settingsGoalName) settingsGoalName.value = goalName || '';
    if(settingsGoalAmount) settingsGoalAmount.value = goalAmount > 0 ? goalAmount : '';
    
    if(themeSelect) themeSelect.value = appTheme;
    if(oledToggle) {
        oledToggle.checked = isOledMode;
        oledToggle.closest('.setting-item').style.display = (appTheme === 'dark' || (appTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'flex' : 'none';
    }
    if(accentColorPicker) accentColorPicker.value = accentColor;
    if(familyToggle) familyToggle.checked = isFamilyMode;
    if(hapticToggle) hapticToggle.checked = isHapticsEnabled;
    if(soundToggle)  soundToggle.checked  = isSoundEnabled;
    renderMemberList();

    if(pinToggle) {
        pinToggle.checked = isPinEnabled;
        pinSetupArea.style.display = isPinEnabled ? 'block' : 'none';
        newPinInput.value = appPin || '';
    }

    // Sync avatar preview
    applyAvatar(customAvatarUrl);
}

if(pinToggle) {
    pinToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            pinSetupArea.style.display = 'block';
        } else {
            pinSetupArea.style.display = 'none';
            // Instantly disable the PIN if toggled off
            isPinEnabled = false;
            appPin = null;
            localStorage.setItem('isPinEnabled', 'false');
            localStorage.removeItem('appPin');
        }
    });
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        // Save Name
        const newName = settingsNameInput.value.trim();
        if (newName && newName !== userName) {
            userName = newName;
            localStorage.setItem('userName', userName);
        }

        // Save Budget
        if(settingsBudgetInput) {
            const parsedBudget = parseFloat(settingsBudgetInput.value);
            monthlyBudget = isNaN(parsedBudget) ? 0 : parsedBudget;
            localStorage.setItem('monthlyBudget', monthlyBudget);
        }

        // Save Goal
        if(settingsGoalName && settingsGoalAmount) {
            goalName = settingsGoalName.value.trim();
            const parsedGoal = parseFloat(settingsGoalAmount.value);
            goalAmount = isNaN(parsedGoal) ? 0 : parsedGoal;
            localStorage.setItem('goalName', goalName);
            localStorage.setItem('goalAmount', goalAmount);
        }

        updateUI();

        // Save PIN if enabled
        if (pinToggle && pinToggle.checked) {
            const pin = newPinInput.value;
            if (pin.length !== 4 || isNaN(pin)) {
                alert("Please enter a valid 4-digit numeric PIN.");
                return; // Do not close modal!
            }
            appPin = pin;
            isPinEnabled = true;
            localStorage.setItem('appPin', appPin);
            localStorage.setItem('isPinEnabled', 'true');
        }

        // Save Theme
        if (themeSelect) {
            appTheme = themeSelect.value;
            localStorage.setItem('appTheme', appTheme);
        }
        if (oledToggle) {
            isOledMode = oledToggle.checked;
            localStorage.setItem('isOledMode', isOledMode);
        }

        // Save Accent Color
        if (accentColorPicker) {
            accentColor = accentColorPicker.value;
            localStorage.setItem('accentColor', accentColor);
        }

        // Save Family Mode
        if (familyToggle) {
            isFamilyMode = familyToggle.checked;
            localStorage.setItem('isFamilyMode', isFamilyMode);
            localStorage.setItem('familyMembers', JSON.stringify(familyMembers));
        }

        const originalHtml = saveSettingsBtn.innerHTML;
        saveSettingsBtn.classList.add('loading');

        setTimeout(() => {
            // Save Feedback Settings
            if (hapticToggle) {
                isHapticsEnabled = hapticToggle.checked;
                localStorage.setItem('isHapticsEnabled', isHapticsEnabled);
            }
            if (soundToggle) {
                isSoundEnabled = soundToggle.checked;
                localStorage.setItem('isSoundEnabled', isSoundEnabled);
            }

            applyTheme();
            updateUI();
            
            showButtonSuccess(saveSettingsBtn, originalHtml);
            setTimeout(() => {
                closeModal('settingsModal');
            }, 500);
        }, 800);
    });
}

function applyTheme() {
    let activeTheme = appTheme;
    if (activeTheme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (activeTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('oled-theme');
    } else {
        document.body.classList.remove('light-theme');
        if (isOledMode) {
            document.body.classList.add('oled-theme');
        } else {
            document.body.classList.remove('oled-theme');
        }
    }
    
    // Apply Accent Color
    document.documentElement.style.setProperty('--accent-color', accentColor);
    // Dynamic glow calculation (simple version)
    document.documentElement.style.setProperty('--accent-glow', `${accentColor}4D`); // 30% alpha
}

openSettingsBtn.addEventListener('click', openSettings);
if (userProfileBtn) userProfileBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

// Event Listeners
closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Close modal when clicking outside
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

transactionForm.addEventListener('submit', addTransaction);

// Make functions globally available for inline onclick
window.deleteTransaction = deleteTransaction;

// Reset Profile
const resetAppBtn = document.getElementById('resetAppBtn');
if (resetAppBtn) {
    resetAppBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to completely remove your profile ('Aaron') and erase all data? This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
}
// =======================================================
// VOICE EXPENSE ENGINE
// =======================================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const floatingVoiceBtn  = document.getElementById('floatingVoiceBtn');
const voicePanel        = document.getElementById('voicePanel');
const voicePanelTitle   = document.getElementById('voicePanelTitle');
const voiceTranscript   = document.getElementById('voiceTranscript');
const voiceStatusIcon   = document.getElementById('voiceStatusIcon');
const voiceParsedResult = document.getElementById('voiceParsedResult');
const vpAmount          = document.getElementById('vpAmount');
const vpType            = document.getElementById('vpType');
const vpCategory        = document.getElementById('vpCategory');
const vpNote            = document.getElementById('vpNote');
const vpConfirmBtn      = document.getElementById('vpConfirmBtn');
const vpRetryBtn        = document.getElementById('vpRetryBtn');
const voicePanelClose   = document.getElementById('voicePanelClose');

// Also keep the in-modal button hidden (already exists in HTML)
if (voiceAddBtn) voiceAddBtn.style.display = 'none';

// Parsed state holder
let voiceParsedData = null;

// ---- Smart NLP Parser ----
function parseVoiceTranscript(text) {
    const t = text.toLowerCase().trim();

    // 1. Extract amount — handles "50", "50.5", "fifty" (simple word-to-num)
    const wordNumbers = {
        'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,
        'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,
        'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,
        'nineteen':19,'twenty':20,'thirty':30,'forty':40,'fifty':50,
        'sixty':60,'seventy':70,'eighty':80,'ninety':90,'hundred':100,
        'thousand':1000
    };
    let amount = null;

    // Try numeric first
    const numMatch = t.match(/\b(\d+(?:\.\d+)?)\b/);
    if (numMatch) {
        amount = parseFloat(numMatch[1]);
    } else {
        // Try word numbers
        let total = 0;
        t.split(/\s+/).forEach(w => {
            if (wordNumbers[w] !== undefined) total += wordNumbers[w];
        });
        if (total > 0) amount = total;
    }

    // 2. Determine transaction type
    const incomeKeywords = ['income', 'salary', 'earned', 'received', 'paid me', 'wage', 'bonus', 'freelance'];
    const isIncome = incomeKeywords.some(kw => t.includes(kw));
    const type = isIncome ? 'income' : 'expense';

    // 3. Determine category
    const categoryMap = [
        { cat: 'Food',          words: ['food','lunch','dinner','breakfast','coffee','tea','groceries','grocery','restaurant','pizza','burger','snack','drink','cafe', 'meal'] },
        { cat: 'Transport',     words: ['transport','uber','taxi','bus','train','metro','petrol','gas','fuel','cab','auto','ride','fare','travel'] },
        { cat: 'Shopping',      words: ['shopping','clothes','shirt','shoes','dress','bag','mall','amazon','flipkart','store','buy','bought','purchased'] },
        { cat: 'Bills',         words: ['bill','rent','electricity','water','internet','wifi','phone','mobile','recharge','utility','emi','loan','insurance'] },
        { cat: 'Entertainment', words: ['movie','film','netflix','spotify','game','entertainment','concert','show','ticket','theatre','pub','party'] },
        { cat: 'Salary',        words: ['salary','wage','paycheck','stipend','bonus'] },
    ];

    let category = 'Other';
    for (const entry of categoryMap) {
        if (entry.words.some(w => t.includes(w))) {
            category = entry.cat;
            break;
        }
    }
    if (isIncome && category === 'Other') category = 'Salary';

    // 4. Build description — strip numbers and keywords, use rest as note
    let note = t
        .replace(/\b\d+(?:\.\d+)?\b/g, '')
        .replace(/\b(spent|spend|paid|pay|for|on|in|at|a|the|my|i|me|to|rupees?|dollars?|bucks?|rs\.?|usd|inr)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!note) note = category;
    note = note.charAt(0).toUpperCase() + note.slice(1);

    return { amount, type, category, note, raw: text };
}

// ---- Voice Panel UI helpers ----
function showVoiceListening() {
    voicePanel.style.display = 'block';
    voiceParsedResult.style.display = 'none';
    voiceStatusIcon.className = 'voice-status-icon listening';
    voiceStatusIcon.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat"></i>';
    voicePanelTitle.textContent = 'Listening...';
    voiceTranscript.textContent = 'Speak now — e.g. "Spent 50 on food" or "Salary 25000"';
    floatingVoiceBtn.classList.add('active');
}

function showVoiceParsed(data) {
    voiceParsedResult.style.display = 'block';
    voiceStatusIcon.className = 'voice-status-icon success';
    voiceStatusIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    voicePanelTitle.textContent = 'Got it! Review below:';
    voiceTranscript.textContent = `"${data.raw}"`;

    const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(n);
    vpAmount.textContent   = data.amount !== null ? fmt(data.amount) : '—';
    vpType.textContent     = data.type.charAt(0).toUpperCase() + data.type.slice(1);
    vpType.style.color     = data.type === 'income' ? 'var(--success)' : 'var(--danger)';
    vpCategory.textContent = data.category;
    vpNote.textContent     = data.note;
    floatingVoiceBtn.classList.remove('active');
}

function showVoiceError(msg) {
    voiceStatusIcon.className = 'voice-status-icon error';
    voiceStatusIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    voicePanelTitle.textContent = 'Could not understand';
    voiceTranscript.textContent = msg || 'Please try again.';
    floatingVoiceBtn.classList.remove('active');
}

function closeVoicePanel() {
    voicePanel.style.display = 'none';
    voiceParsedResult.style.display = 'none';
    voiceParsedData = null;
    floatingVoiceBtn.classList.remove('active');
}

// ---- Core Recognition ----
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous  = false;
    recognition.lang        = 'en-US';
    recognition.interimResults = false;
    let isListening = false;

    function startListening() {
        if (isListening) { recognition.stop(); return; }
        showVoiceListening();
        try {
            recognition.start();
            isListening = true;
        } catch(e) {
            showVoiceError('Microphone access denied or unavailable.');
        }
    }

    floatingVoiceBtn.addEventListener('click', startListening);
    if (vpRetryBtn) vpRetryBtn.addEventListener('click', startListening);

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const parsed = parseVoiceTranscript(transcript);

        if (!parsed.amount || parsed.amount <= 0) {
            showVoiceError(`Heard: "${transcript}" — couldn't find an amount. Try "50 for coffee".`);
            return;
        }

        voiceParsedData = parsed;
        showVoiceParsed(parsed);
    };

    recognition.onerror = (event) => {
        let msg = 'An error occurred. Please try again.';
        if (event.error === 'no-speech') msg = 'No speech detected. Tap mic and speak clearly.';
        if (event.error === 'not-allowed') msg = 'Microphone access denied. Please allow microphone.';
        showVoiceError(msg);
    };

    recognition.onend = () => { isListening = false; };

    // Confirm → save transaction directly
    if (vpConfirmBtn) {
        vpConfirmBtn.addEventListener('click', () => {
            if (!voiceParsedData || !voiceParsedData.amount) return;
            const d = voiceParsedData;
            const newTransaction = {
                id: Date.now().toString(),
                type: d.type,
                amount: d.amount,
                category: d.category,
                description: d.note,
                member: isFamilyMode ? (familyMembers[0] || 'Me') : 'Me',
                isRecurring: false,
                frequency: null,
                lastProcessed: null,
                date: new Date().toISOString()
            };
            const originalHtml = vpConfirmBtn.innerHTML;
            vpConfirmBtn.classList.add('loading');
            
            setTimeout(() => {
                transactions.push(newTransaction);
                updateUI();

                // Success feedback
                voiceStatusIcon.className = 'voice-status-icon success';
                voiceStatusIcon.innerHTML = '<i class="fa-solid fa-check-double"></i>';
                voicePanelTitle.textContent = 'Saved!';
                
                showButtonSuccess(vpConfirmBtn, originalHtml);

                setTimeout(closeVoicePanel, 1500);
            }, 600);
        });
    }

    if (voicePanelClose) voicePanelClose.addEventListener('click', closeVoicePanel);
    
    window.closeDevicesModal = () => closeModal('devicesModal');
    window.openDevicesModal = () => {
        document.getElementById('devicesModal').style.display = 'block';
        document.getElementById('devicesModal').classList.add('active');
        document.body.classList.add('modal-open');
    };

} else {
    // Browser doesn't support speech — hide button
    if (floatingVoiceBtn) floatingVoiceBtn.style.display = 'none';
}

// View Switching Logic
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const target = link.getAttribute('data-target');
        if (!target) return;
        
        // Update Nav
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Update View with transition
        const views = [dashboardView, analyticsView, subscriptionsView];
        views.forEach(v => {
            if(v) {
                if (v.id === target) {
                    v.style.display = 'flex';
                    v.classList.add('fadeInUp');
                } else {
                    v.style.display = 'none';
                }
            }
        });

        if (target === 'analytics') {
            updateChart();
        }
        if (target === 'subscriptions') {
            renderSubscriptions();
        }
    });
});

function renderSubscriptions() {
    const list = document.getElementById('subscriptionList');
    if (!list) return;
    list.innerHTML = '';
    
    const subs = transactions.filter(t => t.isRecurring);
    if (subs.length === 0) {
        list.innerHTML = '<div class="empty-state">No active subscriptions.</div>';
        return;
    }
    
    subs.forEach(s => {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        li.style.padding = '0.5rem 0';
        li.innerHTML = `
            <div class="t-info">
                <div class="t-title">${s.description}</div>
                <div class="t-date">Next due based on ${s.frequency} cycle</div>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
                <div class="t-amount expense">
                    ${new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(s.amount)}
                    <p style="font-size: 0.7rem; color: var(--text-secondary); text-align: right;">${s.frequency}</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-text" onclick="openEditModal('${s.id}')" style="color: var(--accent-color); padding: 0.5rem;"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-text" onclick="deleteTransaction('${s.id}')" style="color: var(--danger); padding: 0.5rem;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });
}

function processRecurringExpenses() {
    const now = new Date();
    let updated = false;
    
    transactions.forEach(t => {
        if (t.isRecurring && t.lastProcessed) {
            const last = new Date(t.lastProcessed);
            let shouldAdd = false;
            
            // Check if a new period has started since last processed
            if (t.frequency === 'weekly') {
                if ((now - last) > 6 * 24 * 60 * 60 * 1000) shouldAdd = true;
            } else if (t.frequency === 'monthly') {
                // If it's a new month and we haven't processed this month yet
                if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
                    shouldAdd = true;
                }
            } else if (t.frequency === 'yearly') {
                if (now.getFullYear() !== last.getFullYear()) shouldAdd = true;
            }
            
            if (shouldAdd) {
                const newT = { ...t, id: Date.now().toString(), date: now.toISOString(), isRecurring: false };
                transactions.push(newT);
                t.lastProcessed = now.toISOString();
                updated = true;
                
                // Show a toast or log
                console.log(`Auto-added recurring expense: ${t.description}`);
            }
        }
    });
    
    if (updated) {
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateUI();
    }
}

function addTemplate(name, amount, category) {
    const newTransaction = {
        id: Date.now().toString(),
        type: 'expense',
        amount,
        category,
        description: name,
        member: isFamilyMode ? 'Me' : 'Me',
        isRecurring: true,
        frequency: 'monthly',
        lastProcessed: new Date().toISOString(),
        date: new Date().toISOString()
    };
    
    transactions.push(newTransaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateUI();
    renderSubscriptions();
    
    // Switch to Subscriptions view if needed
    triggerConfetti(); // Little celebration for automation setup
}

function clearSubscriptions() {
    if (confirm("Are you sure you want to delete ALL active subscriptions? Past transactions will NOT be affected, but no new ones will be auto-added.")) {
        transactions = transactions.filter(t => !t.isRecurring);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateUI();
        renderSubscriptions();
        
        // Visual feedback
        triggerConfetti(); // Or a toast if we had one
    }
}

function checkAppConnection(appName) {
    const cardId = `app-${appName.toLowerCase().replace(' ', '')}`;
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const statusText = card.querySelector('.app-status');
    const originalContent = statusText.innerHTML;
    
    // Start "checking" state
    statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    card.style.borderColor = 'var(--accent-color)';
    
    setTimeout(() => {
        if (appName === 'PayPal' || appName === 'Google Pay') {
            statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected & Secure <button class="btn-text" onclick="launchApp('${appName}', event)" style="font-size: 0.65rem; color: var(--accent-color); margin-left: 0.5rem; text-decoration: underline;">Open App</button>`;
            statusText.style.color = 'var(--success)';
            card.style.borderColor = 'var(--success)';
        } else {
            statusText.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Handshake Failed';
            statusText.style.color = 'var(--danger)';
            card.style.borderColor = 'var(--danger)';
            
            if (confirm(`${appName} is not linked. Would you like to connect it now?`)) {
                alert(`Redirecting to ${appName} secure login... (Simulated)`);
                setTimeout(() => {
                    statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected <button class="btn-text" onclick="launchApp('${appName}', event)" style="font-size: 0.65rem; color: var(--accent-color); margin-left: 0.5rem; text-decoration: underline;">Open</button>`;
                    statusText.style.color = 'var(--success)';
                    card.style.borderColor = 'var(--success)';
                    card.style.opacity = '1';
                    card.style.filter = 'none';
                }, 2000);
            }
        }
    }, 1500);
}

function launchApp(appName, event) {
    if (event) event.stopPropagation(); // Don't re-trigger the check
    
    const urls = {
        'PayPal': 'https://www.paypal.com',
        'Google Pay': 'https://pay.google.com',
        'Apple Pay': 'https://www.apple.com/apple-pay/',
        'Amazon Pay': 'https://pay.amazon.com'
    };
    
    if (confirm(`User Consent Required: You are now leaving ExpensePro to open ${appName}. ExpensePro does not handle your external login credentials. Proceed to ${appName}?`)) {
        window.open(urls[appName] || '#', '_blank');
    }
}

// Behavioral Intelligence
function updateBehavioralInsights() {
    const recurringEls = document.querySelectorAll('.recurring-value');
    const trendEls = document.querySelectorAll('.trend-value');
    const projectionEls = document.querySelectorAll('.projection-value');
    const advisorText = document.getElementById('advisorTipText');

    if (transactions.length < 3) {
        if (advisorText) advisorText.innerText = "Add at least 3 transactions to see your personalized advisor tips!";
        return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const expenses = transactions.filter(t => t.type === 'expense');
    const monthExpenses = expenses.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // 1. Smart Tips Engine
    let tips = [];
    
    // Category Balance Check
    const catTotals = {};
    monthExpenses.forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.amount);
    const sortedCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
    
    if (sortedCats.length > 0) {
        const topCat = sortedCats[0];
        tips.push(`Professional Tip: Your <strong>${topCat[0]}</strong> spending is the highest this month. Try to optimize this category first.`);
    }

    // Budget Health Pro Tip
    if (monthlyBudget > 0) {
        const spentVal = monthExpenses.reduce((s,t) => s+t.amount, 0);
        const usedPct = (spentVal / monthlyBudget) * 100;
        const dayPct = (now.getDate() / new Date(currentYear, currentMonth + 1, 0).getDate()) * 100;
        
        if (usedPct > dayPct + 10) {
            tips.push(`Strategic Insight: You're spending faster than usual. Slow down on non-essentials to reach your end-of-month target.`);
        } else if (usedPct < dayPct - 10) {
            tips.push(`Great work! You're currently ${ (dayPct - usedPct).toFixed(0) }% below your expected spending curve.`);
        }
    }

    // Savings Momentum
    if (goalAmount > 0) {
        const inc = transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
        const exp = transactions.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
        const bal = inc - exp;
        if (bal > goalAmount * 0.9) {
            tips.push("High Momentum: You're in the 'Last Mile' of your savings goal! Avoid any impulse buys this week.");
        }
    }

    if (advisorText && tips.length > 0) {
        // Rotate tips every 10 seconds or show primary
        const index = Math.floor(now.getTime() / 10000) % tips.length;
        advisorText.innerHTML = tips[index];
    }

    // 2. Spending Velocity
    const last7 = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const prev14 = now.getTime() - (14 * 24 * 60 * 60 * 1000);

    const spendLast7 = expenses.filter(t => new Date(t.date).getTime() > last7).reduce((a,b) => a+b.amount, 0);
    const spendPrev7 = expenses.filter(t => {
        const d = new Date(t.date).getTime();
        return d > prev14 && d <= last7;
    }).reduce((a,b) => a+b.amount, 0);

    if (trendEls.length > 0) {
        if (spendPrev7 === 0) {
            updateAll(trendEls, "Analyzing your weekly trend...");
        } else {
            const diff = ((spendLast7 - spendPrev7) / spendPrev7) * 100;
            updateAll(trendEls, `You've spent <strong>${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'more' : 'less'}</strong> this week compared to last week.`);
        }
    }

    // 3. Projections & Budget Advice
    if (projectionEls.length > 0) {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const currentDay = now.getDate();
        const totalThisMonth = monthExpenses.reduce((a,b) => a+b.amount, 0);

        if (currentDay > 1) {
            const projected = (totalThisMonth / currentDay) * daysInMonth;
            let msg = `Projected: <strong>${formatCurrency(projected)}</strong> by month end.`;
            
            if (monthlyBudget > 0) {
                const remaining = monthlyBudget - totalThisMonth;
                const remainingDays = daysInMonth - currentDay;
                if (remainingDays > 0) {
                    const dailyLimit = Math.max(0, remaining / remainingDays);
                    msg += `<br>Safely spend <strong>${formatCurrency(dailyLimit)}</strong> daily to stay on track.`;
                }
            }
            updateAll(projectionEls, msg);
        }
    }
}

// PDF Export Logic
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const target = document.getElementById('analytics');
        
        downloadPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        downloadPdfBtn.disabled = true;

        try {
            const canvas = await html2canvas(target, {
                scale: 2,
                useCORS: true,
                backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
                windowWidth: target.scrollWidth,
                windowHeight: target.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`ExpensePro_Monthly_Report_${new Date().getMonth() + 1}_${new Date().getFullYear()}.pdf`);
        } catch (error) {
            console.error('PDF Generation Failed:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            downloadPdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export PDF Report';
            downloadPdfBtn.disabled = false;
        }
    });
}

// Family Members Logic
if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
        const name = newMemberInput.value.trim();
        if (name && !familyMembers.includes(name)) {
            const originalHtml = addMemberBtn.innerHTML;
            addMemberBtn.classList.add('loading');
            
            setTimeout(() => {
                familyMembers.push(name);
                newMemberInput.value = '';
                renderMemberList();
                updateMemberSelector();
                showButtonSuccess(addMemberBtn, originalHtml);
            }, 500);
        } else {
            playSound('error');
            triggerHaptic(40);
        }
    });
}

function renderMemberList() {
    if (!memberListUI) return;
    memberListUI.innerHTML = '';
    familyMembers.forEach(member => {
        const li = document.createElement('li');
        li.className = 'setting-item';
        li.style.padding = '0.5rem 0';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        li.innerHTML = `
            <span>${member}</span>
            <button class="btn-text" style="color: var(--danger); font-size: 0.8rem;" onclick="removeMember('${member}')">Remove</button>
        `;
        memberListUI.appendChild(li);
    });
}

function removeMember(name) {
    if (name === 'Me') return; // Cannot remove self
    familyMembers = familyMembers.filter(m => m !== name);
    renderMemberList();
    updateMemberSelector();
}

function updateMemberSelector() {
    if (!memberSelector) return;
    memberSelector.innerHTML = '';
    familyMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member;
        option.innerText = member;
        memberSelector.appendChild(option);
    });
}

const originalUpdateUI = updateUI;
updateUI = function() {
    originalUpdateUI();
    
    // Handle Family Visibility
    if (familyMemberManager) familyMemberManager.style.display = isFamilyMode ? 'block' : 'none';
    if (memberSelectorGroup)    memberSelectorGroup.style.display = isFamilyMode ? 'block' : 'none';
    const splitToggleGroup = document.getElementById('splitToggleGroup');
    if (splitToggleGroup) splitToggleGroup.style.display = isFamilyMode ? 'flex' : 'none';
    
    const memberAnalytics = document.getElementById('memberAnalytics');
    if (memberAnalytics) memberAnalytics.style.display = isFamilyMode ? 'block' : 'none';
    
    // NEW: Dashboard Professionals
    updateDashboardKPIs();
    updateSavingsGoalUI();
    checkFinancialAlerts(); // NEW notification checks
    
    updateMemberSelector();
};

// =====================================================
// NOTIFICATION CENTER PRO
// =====================================================
let notifications = JSON.parse(localStorage.getItem('epro_notifications')) || [];

window.addNotification = function(title, message, type = 'info') {
    const newNoti = {
        id: `noti_${Date.now()}`,
        title,
        message,
        type,
        time: new Date().toISOString(),
        read: false
    };
    notifications.unshift(newNoti);
    if (notifications.length > 50) notifications.pop(); // Cap at 50
    localStorage.setItem('epro_notifications', JSON.stringify(notifications));
    
    // Play subtle sound if important
    if (type === 'warning' || type === 'success') {
        playSound('notification'); // We'll need a notification sound or reuse success
        triggerHaptic(30);
    }
    
    renderNotifications();
};

function renderNotifications() {
    const notiList = document.getElementById('notiList');
    const badge = document.getElementById('notiBadge');
    if (!notiList || !badge) return;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    
    if (notifications.length === 0) {
        notiList.innerHTML = '<div class="empty-noti">No new notifications</div>';
        return;
    }
    
    notiList.innerHTML = notifications.map(n => {
        let icon = 'fa-bell';
        let bg = 'rgba(99, 102, 241, 0.1)';
        let color = 'var(--accent-color)';
        
        if (n.type === 'warning') { icon = 'fa-triangle-exclamation'; bg = 'rgba(239, 68, 68, 0.1)'; color = 'var(--danger)'; }
        if (n.type === 'success') { icon = 'fa-circle-check'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'var(--success)'; }
        if (n.type === 'budget') { icon = 'fa-wallet'; bg = 'rgba(245, 158, 11, 0.1)'; color = 'var(--warning)'; }

        return `
            <div class="noti-item ${n.read ? '' : 'unread'}" onclick="markAsRead('${n.id}')">
                <div class="noti-icon" style="background: ${bg}; color: ${color};">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="noti-content">
                    <div class="noti-title">${n.title}</div>
                    <div class="noti-msg">${n.message}</div>
                    <div class="noti-time">${formatTimeAgo(n.time)}</div>
                </div>
            </div>
        `;
    }).join('');
}

window.markAsRead = function(id) {
    const n = notifications.find(noti => noti.id === id);
    if (n) {
        n.read = true;
        localStorage.setItem('epro_notifications', JSON.stringify(notifications));
        renderNotifications();
    }
};

window.clearAllNotifications = function() {
    notifications = [];
    localStorage.setItem('epro_notifications', JSON.stringify(notifications));
    renderNotifications();
};

function formatTimeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
}

function checkFinancialAlerts() {
    // Budget Alert
    if (monthlyBudget > 0) {
        const expenses = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.amount, 0);
        const pct = (expenses / monthlyBudget) * 100;
        
        if (pct >= 80 && !localStorage.getItem(`alert_budget_80_${new Date().getMonth()}`)) {
            addNotification('Budget Critical', `You have used ${pct.toFixed(0)}% of your monthly budget.`, 'warning');
            localStorage.setItem(`alert_budget_80_${new Date().getMonth()}`, 'true');
        }
    }
}

// Bind Notification Dropdown Toggle
document.getElementById('notiBellBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notiDropdown').classList.toggle('active');
    triggerHaptic(15);
});

document.addEventListener('click', () => {
    document.getElementById('notiDropdown')?.classList.remove('active');
});

document.getElementById('notiDropdown')?.addEventListener('click', (e) => e.stopPropagation());

// Initial Render
setTimeout(renderNotifications, 1000);

// Social Sharing Logic
if (shareAppBtn) {
    shareAppBtn.addEventListener('click', async () => {
        const shareData = {
            title: 'ExpensePro',
            text: `Hey! I'm using ExpensePro to track my daily spending. It has a super cool 3D ATM card and voice tracking!`,
            url: window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback for browsers that don't support Web Share API
                alert("Sharing is only supported on mobile devices and secure (HTTPS) browsers. \n\nCopy this link to share: " + window.location.href);
            }
        } catch (err) {
            console.log('Error sharing:', err);
        }
    });
}

if (shareCardBtn) {
    shareCardBtn.addEventListener('click', async () => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const total = income - expense;
        const currencySymbol = new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(0).replace(/\d/g, '').trim();

        const shareData = {
            title: 'My Financial Status',
            text: `My current balance on ExpensePro is ${new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(total)}! Check out my premium ATM card.`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                alert("Check my balance: " + new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(total));
            }
        } catch (err) {
            console.log('Error sharing:', err);
        }
    });
}

// Init
const currencySelector = document.getElementById('currencySelector');
if (currencySelector) {
    currencySelector.value = currentCurrency;
}
processRecurringExpenses();
initGlareEffect();

/**
 * NEW: Professional Dashboard KPIs
 */
function updateDashboardKPIs() {
    const netMonthlyEl = document.getElementById('netMonthlyEl');
    const netTrendEl = document.getElementById('netTrendEl');
    const summaryGoalPct = document.getElementById('summaryGoalPct');
    const summaryGoalBar = document.getElementById('summaryGoalBar');
    const budgetHealthStatus = document.getElementById('budgetHealthStatus');
    const budgetUsageTag = document.getElementById('budgetUsageTag');
    const nextMajorBill = document.getElementById('nextMajorBill');
    const daysToBill = document.getElementById('daysToBill');

    if (!netMonthlyEl) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Net Monthly
    const monthTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const incomeSum = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseSum = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = incomeSum - expenseSum;

    netMonthlyEl.innerText = formatCurrency(net);
    netMonthlyEl.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';

    // 2. Goal Progress (Mini)
    if (goalAmount > 0) {
        const pct = Math.min(100, Math.max(0, (totalBalance / goalAmount) * 100)).toFixed(0);
        summaryGoalPct.innerText = `${pct}%`;
        if (summaryGoalBar) summaryGoalBar.style.width = `${pct}%`;
    }

    // 3. Budget Health
    if (monthlyBudget > 0) {
        const usedPct = (expenseSum / monthlyBudget) * 100;
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const expectedPct = (dayOfMonth / daysInMonth) * 100;

        if (budgetUsageTag) budgetUsageTag.innerText = `${usedPct.toFixed(0)}% Used`;
        
        if (usedPct > 100) {
            budgetHealthStatus.innerText = 'Over Budget';
            budgetHealthStatus.style.color = 'var(--danger)';
        } else if (usedPct > expectedPct + 15) {
            budgetHealthStatus.innerText = 'Warning';
            budgetHealthStatus.style.color = 'var(--warning)';
        } else {
            budgetHealthStatus.innerText = 'Healthy';
            budgetHealthStatus.style.color = 'var(--success)';
        }
    }

    // 4. Next Major Bill
    const recurring = transactions.filter(t => t.isRecurring && t.type === 'expense');
    if (recurring.length > 0) {
        const topBill = [...recurring].sort((a, b) => b.amount - a.amount)[0];
        nextMajorBill.innerText = topBill.description;
        daysToBill.innerText = formatCurrency(topBill.amount);
    } else {
        nextMajorBill.innerText = 'None';
        daysToBill.innerText = 'N/A';
    }
    
    updateSubscriptionInsights();
}

function updateSubscriptionInsights() {
    const totalBurnEl = document.getElementById('totalBurnAmount');
    const yearlyProjectedEl = document.getElementById('yearlyProjectedAmount');
    const activeSubsCountEl = document.getElementById('activeSubsCount');

    const recurring = transactions.filter(t => t.isRecurring && t.type === 'expense');
    const monthlyTotal = recurring.reduce((sum, t) => sum + t.amount, 0);

    if (totalBurnEl) totalBurnEl.innerText = formatCurrency(monthlyTotal);
    if (yearlyProjectedEl) yearlyProjectedEl.innerText = formatCurrency(monthlyTotal * 12);
    if (activeSubsCountEl) activeSubsCountEl.innerText = recurring.length;

    // Update the list with countdowns
    renderSubscriptionsListWithCountdowns(recurring);
}

function renderSubscriptionsListWithCountdowns(recurring) {
    const subsList = document.getElementById('subsList');
    if (!subsList) return;
    
    // Clear list but keep logic mostly same as original renderSubscriptions
    subsList.innerHTML = '';
    recurring.forEach(s => {
        const li = document.createElement('li');
        li.className = 'transaction-item glass-panel';
        li.style.marginBottom = '0.75rem';
        
        // Calculate days until next occurrence (simplified)
        const d = new Date(s.date);
        const today = new Date();
        const nextDate = new Date(today.getFullYear(), today.getMonth(), d.getDate());
        if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
        const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

        li.innerHTML = `
            <div class="t-info">
                <div class="t-title">${s.description} ${s.isPaused ? '<span class="paused-tag">Paused</span>' : ''}</div>
                <div class="t-date">${s.isPaused ? 'Recurrence paused' : 'Next payment in ' + diffDays + ' days'}</div>
            </div>
            <div class="t-amount-wrapper" style="text-align: right;">
                <div class="t-amount text-red" style="opacity: ${s.isPaused ? 0.5 : 1}">-${formatCurrency(s.amount)}</div>
                <div class="sub-actions" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="action-icon-btn" onclick="toggleSubscriptionPause('${s.id}')" title="${s.isPaused ? 'Resume' : 'Pause'}">
                        <i class="fa-solid ${s.isPaused ? 'fa-play' : 'fa-pause'}"></i>
                    </button>
                    <button class="action-icon-btn" onclick="openEditTransactionModal('${s.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" onclick="cancelSubscription('${s.id}')" title="Cancel Subscription">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        subsList.appendChild(li);
    });
}

function updateSavingsGoalUI() {
    const ring = document.getElementById('goalProgressRing');
    const pctText = document.getElementById('goalPercentText');
    const targetEl = document.getElementById('goalTargetDisplay');
    const remainingEl = document.getElementById('goalRemainingDisplay');
    const nameEl = document.getElementById('goalNameDisplay');

    if (!ring) return;

    if (nameEl) nameEl.innerText = goalName || 'Total Savings';
    if (targetEl) targetEl.innerText = formatCurrency(goalAmount);
    
    if (goalAmount > 0) {
        const pct = Math.min(100, Math.max(0, (totalBalance / goalAmount) * 100));
        if (pctText) pctText.innerText = `${pct.toFixed(0)}%`;
        
        // Circular progress SVG logic
        const radius = 44;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (pct / 100) * circumference;
        ring.style.strokeDasharray = `${circumference} ${circumference}`;
        ring.style.strokeDashoffset = offset;
        
        if (remainingEl) remainingEl.innerText = formatCurrency(Math.max(0, goalAmount - totalBalance));
    } else {
        if (pctText) pctText.innerText = '0%';
        ring.style.strokeDashoffset = 2 * Math.PI * 44;
        if (remainingEl) remainingEl.innerText = '--';
    }
}

function initGlareEffect() {
    document.addEventListener('mousemove', (e) => {
        const panels = document.querySelectorAll('.glass-panel');
        panels.forEach(panel => {
            const rect = panel.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            panel.style.setProperty('--mouse-x', `${x}%`);
            panel.style.setProperty('--mouse-y', `${y}%`);
        });
    });
}
