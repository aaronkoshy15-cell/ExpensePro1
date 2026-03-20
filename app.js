// State Management
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentCurrency = localStorage.getItem('currency') || 'USD';
let userName = localStorage.getItem('userName') || 'User';
let appPin = localStorage.getItem('appPin') || null;
let isPinEnabled = localStorage.getItem('isPinEnabled') === 'true';
let monthlyBudget = parseFloat(localStorage.getItem('monthlyBudget')) || 0;
let goalName = localStorage.getItem('goalName') || '';
let goalAmount = parseFloat(localStorage.getItem('goalAmount')) || 0;
let isDarkMode = localStorage.getItem('isDarkMode') !== 'false';
let isFamilyMode = localStorage.getItem('isFamilyMode') === 'true';
let familyMembers = JSON.parse(localStorage.getItem('familyMembers')) || ['Me'];
let accentColor = localStorage.getItem('accentColor') || '#6366f1';
let chartInstance = null;
let memberChartInstance = null;
let editingId = null;

// Currency Selection
function changeCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('currency', currentCurrency);
    updateUI();
}

// DOM Elements
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const transactionListEl = document.getElementById('transactionList');

// Modal Elements
const closeModalBtn = document.getElementById('closeModalBtn');
const modalOverlay = document.getElementById('addTransactionModal');
const transactionForm = document.getElementById('transactionForm');
const voiceAddBtn = document.getElementById('voiceAddBtn');

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
const themeToggle = document.getElementById('themeToggle');
const accentColorPicker = document.getElementById('accentColorPicker');
const familyToggle = document.getElementById('familyToggle');
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
                // Initialize Auth after loading
                initAuth();
                updateUI();
                applyTheme();
            }, 500);
        } else {
            // Faster at beginning, slower at end for natural feel
            const increment = Math.max(0.5, (100 - width) / 10);
            width += increment;
            if (width > 100) width = 100;
            progress.style.width = width + '%';
        }
    }, 50);
}

// Initial Call
document.addEventListener('DOMContentLoaded', () => {
    handleLoading();
});

function updateUI() {
    renderTransactions();
    updateBalance();
    updateChart();
    
    if (userName && displayUsername && displayCardholder && displayAvatar) {
        displayUsername.innerText = userName;
        displayCardholder.innerText = userName;
        displayAvatar.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(userName)}`;
    }
    
    // Save to local storage
    localStorage.setItem('transactions', JSON.stringify(transactions));
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

function renderTransactions() {
    transactionListEl.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionListEl.innerHTML = '<div class="empty-state">No transactions yet. Add one!</div>';
        return;
    }
    
    // Sort by date newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate average for spike detection
    const expenses = transactions.filter(t => t.type === 'expense');
    const avgExpense = expenses.length > 0 ? expenses.reduce((acc, curr) => acc + curr.amount, 0) / expenses.length : 0;
    const now = new Date().getTime();

    sorted.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        
        // Smart Highlights
        const isNew = (now - new Date(t.date).getTime()) < 3000;
        const isSpike = t.type === 'expense' && t.amount > (avgExpense * 1.5) && expenses.length >= 3;
        
        if (isNew) li.classList.add('highlight-new');
        if (isSpike) li.classList.add('spike');

        const catInfo = categoryIcons[t.category] || categoryIcons['Other'];
        const amountClass = t.type === 'income' ? 'income' : 'expense';
        const sign = t.type === 'income' ? '+' : '-';
        
        const dateStr = new Date(t.date).toLocaleDateString();
        
        li.innerHTML = `
            <div class="t-icon ${catInfo.class}">
                <i class="fa-solid ${catInfo.icon}"></i>
            </div>
            <div class="t-info">
                <div class="t-title">${t.description} ${isSpike ? '<span class="spike-tag">Spike</span>' : ''}</div>
                <div class="t-date">${dateStr} • ${t.category}${isFamilyMode ? ' • ' + (t.member || 'Me') : ''}</div>
            </div>
            <div class="t-amount ${amountClass}">
                ${sign} ${new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).format(t.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${t.id}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        transactionListEl.appendChild(li);
    });
}

// Modal Helper
function openModal() {
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('active');
    document.getElementById('modalTitle').innerText = 'Add New Record';
    document.getElementById('saveBtn').innerText = 'Save Transaction';
    editingId = null;
    transactionForm.reset();
}

function openEditModal(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    
    editingId = id;
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('active');
    
    document.getElementById('modalTitle').innerText = 'Edit Subscription';
    document.getElementById('saveBtn').innerText = 'Update Changes';
    
    document.getElementById('amount').value = t.amount;
    document.getElementById('category').value = t.category;
    document.getElementById('description').value = t.description;
    
    if (t.isRecurring) {
        isRecurringToggle.checked = true;
        recurringFrequencySelect.style.display = 'block';
        recurringFrequencySelect.value = t.frequency;
    } else {
        isRecurringToggle.checked = false;
        recurringFrequencySelect.style.display = 'none';
    }
}

function deleteTransaction(id) {
    if (confirm("Are you sure you want to delete this? If this is a recurring subscription, all future automated entries will stop.")) {
        transactions = transactions.filter(t => t.id !== id);
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
        alert("Please enter a valid amount");
        return;
    }
    
    // Fallback if description is empty
    const finalDescription = description.trim() || category;
    
    if (editingId) {
        const index = transactions.findIndex(t => t.id === editingId);
        if (index !== -1) {
            transactions[index] = {
                ...transactions[index],
                type,
                amount,
                category,
                description: finalDescription,
                isRecurring: isRecurringToggle?.checked || false,
                frequency: isRecurringToggle?.checked ? recurringFrequencySelect.value : null
            };
        }
    } else {
        // Duplicate Check
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
                return;
            }
        }

        const newTransaction = {
            id: Date.now().toString(),
            type,
            amount,
            category,
            description: finalDescription,
            member: isFamilyMode ? memberSelector.value : 'Me',
            isRecurring: isRecurringToggle?.checked || false,
            frequency: isRecurringToggle?.checked ? recurringFrequencySelect.value : null,
            lastProcessed: isRecurringToggle?.checked ? new Date().toISOString() : null,
            date: new Date().toISOString()
        };
        transactions.push(newTransaction);
    }
    
    // Reset form and close modal
    transactionForm.reset();
    editingId = null;
    document.getElementById('typeExpense').checked = true; // reset to expense default
    closeModalBtn.click();
    
    updateUI();
    if (subscriptionsView.style.display !== 'none') renderSubscriptions();
}

function updateChart() {
    const dashboardCtx = document.getElementById('spendingChart');
    const mainCtx = document.getElementById('mainSpendingChart');
    const memberCtx = document.getElementById('memberSpendingChart');
    if (!dashboardCtx && !mainCtx) return;
    
    // 1. Spending by Category
    const expensesByCategory = {};
    const expensesByMember = {};
    
    transactions.forEach(t => {
        if (t.type === 'expense') {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
            if (isFamilyMode) {
                const m = t.member || 'Me';
                expensesByMember[m] = (expensesByMember[m] || 0) + t.amount;
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
        
        memberChartInstance = new Chart(memberCtx, {
            type: 'bar',
            data: {
                labels: mLabels,
                datasets: [{
                    label: 'Spending per Member',
                    data: mData,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'var(--accent-color)',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'var(--text-secondary)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'var(--text-secondary)' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // 4. Behavioral Intelligence
    updateBehavioralInsights();

    // Generate Insights
    const insightEl = document.getElementById('spendingInsight');
    if (insightEl) {
        if (labels.length === 0) {
            insightEl.innerText = "No data yet. Start tracking to see your financial health here!";
        } else {
            const maxVal = Math.max(...data);
            const topCategory = labels[data.indexOf(maxVal)];
            const totalExp = data.reduce((a, b) => a + b, 0);
            const percentage = ((maxVal / totalExp) * 100).toFixed(1);
            
            insightEl.innerHTML = `Your biggest expense is <strong>${topCategory}</strong>, which makes up <strong>${percentage}%</strong> of your monthly spending. ${percentage > 50 ? "Consider reviewing this category to save more." : "Your spending is relatively balanced across categories."}`;
        }
    }

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
    
    // Render on whichever is active
    const targetCtx = mainCtx && analyticsView.style.display !== 'none' ? mainCtx : dashboardCtx;
    if (!targetCtx) return;

    chartInstance = new Chart(targetCtx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? colors : ['#334155'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#e2e8f0', font: { family: 'Outfit' } }
                }
            },
            cutout: '70%'
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
    
    if(themeToggle) themeToggle.checked = isDarkMode;
    if(accentColorPicker) accentColorPicker.value = accentColor;
    if(familyToggle) familyToggle.checked = isFamilyMode;
    renderMemberList();

    if(pinToggle) {
        pinToggle.checked = isPinEnabled;
        pinSetupArea.style.display = isPinEnabled ? 'block' : 'none';
        newPinInput.value = appPin || '';
    }
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
        if (themeToggle) {
            isDarkMode = themeToggle.checked;
            localStorage.setItem('isDarkMode', isDarkMode);
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

        applyTheme();
        updateUI();
        settingsModal.classList.remove('active');
    });
}

function applyTheme() {
    if (isDarkMode) {
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
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

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition && voiceAddBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    let isListening = false;

    voiceAddBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }
        
        voiceAddBtn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat"></i> Listening...';
        voiceAddBtn.style.background = 'var(--accent-color)';
        
        try {
            recognition.start();
            isListening = true;
        } catch(e) {
            console.error(e);
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        
        // 1. Extract Number (Amount) using foolproof regex
        const match = transcript.match(/[0-9]+(\\.[0-9]+)?/);
        if (match) {
            document.getElementById('amount').value = match[0];
        }
        
        // 2. Determine Category
        const categorySelect = document.getElementById('category');
        if (transcript.includes('food') || transcript.includes('lunch') || transcript.includes('coffee') || transcript.includes('dinner') || transcript.includes('grocery')) {
            categorySelect.value = 'Food';
        } else if (transcript.includes('transport') || transcript.includes('uber') || transcript.includes('taxi') || transcript.includes('gas') || transcript.includes('bus')) {
            categorySelect.value = 'Transport';
        } else if (transcript.includes('shopping') || transcript.includes('shirt') || transcript.includes('clothes') || transcript.includes('shoes')) {
            categorySelect.value = 'Shopping';
        } else if (transcript.includes('bill') || transcript.includes('rent') || transcript.includes('electric') || transcript.includes('internet') || transcript.includes('water')) {
            categorySelect.value = 'Bills';
        } else if (transcript.includes('movie') || transcript.includes('ticket') || transcript.includes('game') || transcript.includes('entertainment')) {
            categorySelect.value = 'Entertainment';
        } else if (transcript.includes('salary') || transcript.includes('pay') || transcript.includes('wage')) {
            categorySelect.value = 'Salary';
            document.getElementById('typeIncome').checked = true;
        } else {
            categorySelect.value = 'Other';
        }
        
        if (!transcript.includes('salary') && !transcript.includes('pay') && !transcript.includes('wage')) {
            document.getElementById('typeExpense').checked = true;
        }
        
        // 3. Set Description
        document.getElementById('description').value = transcript.charAt(0).toUpperCase() + transcript.slice(1);
        
        voiceAddBtn.innerHTML = '<i class="fa-solid fa-check"></i> Processed!';
        voiceAddBtn.style.background = 'var(--success)';
        
        setTimeout(() => {
            voiceAddBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Tap & Speak (e.g. "25 for Food")';
            voiceAddBtn.style.background = 'rgba(255,255,255,0.1)';
        }, 3000);
    };

    recognition.onerror = (event) => {
        voiceAddBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error listening';
        voiceAddBtn.style.background = 'var(--danger)';
        setTimeout(() => {
            voiceAddBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Tap & Speak (e.g. "25 for Food")';
            voiceAddBtn.style.background = 'rgba(255,255,255,0.1)';
        }, 3000);
    };

    recognition.onend = () => {
        isListening = false;
    };
} else if (voiceAddBtn) {
    voiceAddBtn.style.display = 'none';
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
    const recurringEl = document.querySelector('#recurringInsight p');
    const trendEl = document.querySelector('#trendInsight p');
    const projectionEl = document.querySelector('#projectionInsight p');

    if (transactions.length < 3) return;

    const expenses = transactions.filter(t => t.type === 'expense');

    // 1. Recurring Detection (Heuristic: same desc + approx same amount in diff months)
    const patterns = {};
    expenses.forEach(t => {
        const key = t.description.toLowerCase();
        if (!patterns[key]) patterns[key] = [];
        patterns[key].push(t);
    });

    let recurringFound = [];
    for (const desc in patterns) {
        if (patterns[desc].length >= 2) {
            recurringFound.push(`<strong>${desc}</strong> looks like a recurring monthly bill.`);
        }
    }
    if (recurringEl) recurringEl.innerHTML = recurringFound.length > 0 ? recurringFound.join('<br>') : "No repeating cycles detected yet.";

    // 2. Spending Velocity (Last 7 days vs Previous 7 days)
    const now = new Date();
    const last7 = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const prev14 = now.getTime() - (14 * 24 * 60 * 60 * 1000);

    const spendLast7 = expenses.filter(t => new Date(t.date).getTime() > last7).reduce((a,b) => a+b.amount, 0);
    const spendPrev7 = expenses.filter(t => {
        const d = new Date(t.date).getTime();
        return d > prev14 && d <= last7;
    }).reduce((a,b) => a+b.amount, 0);

    if (trendEl) {
        if (spendPrev7 === 0) {
            trendEl.innerText = "Insufficient historical data for velocity comparison.";
        } else {
            const diff = ((spendLast7 - spendPrev7) / spendPrev7) * 100;
            trendEl.innerHTML = `You've spent <strong>${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'more' : 'less'}</strong> this week compared to last week.`;
        }
    }

    // 3. Projections
    if (projectionEl) {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();
        const totalThisMonth = expenses.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((a,b) => a+b.amount, 0);

        if (currentDay > 2) {
            const projected = (totalThisMonth / currentDay) * daysInMonth;
            projectionEl.innerHTML = `At your current rate, you will spend <strong>${formatCurrency(projected)}</strong> by the end of the month.`;
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
            familyMembers.push(name);
            newMemberInput.value = '';
            renderMemberList();
            updateMemberSelector();
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
    if (memberSelectorGroup) memberSelectorGroup.style.display = isFamilyMode ? 'block' : 'none';
    
    const memberAnalytics = document.getElementById('memberAnalytics');
    if (memberAnalytics) memberAnalytics.style.display = isFamilyMode ? 'block' : 'none';
    
    updateMemberSelector();
};

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
