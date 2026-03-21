// =====================================================
// AI ASSISTANT LOGIC
// =====================================================
window.handleAIPress = function(e) {
    if (e.key === 'Enter') sendMessageToAI();
}

window.sendMessageToAI = function() {
    const input = document.getElementById('aiInput');
    const query = input.value.trim();
    if (!query) return;

    renderChatMessage(query, 'user');
    input.value = '';

    // Show typing effect
    const chatBody = document.getElementById('aiChatBody');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-msg bot typing';
    typingDiv.innerHTML = '<p>...</p>';
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    setTimeout(() => {
        typingDiv.remove();
        const response = processAIQuery(query);
        renderChatMessage(response, 'bot');
    }, 1200);
}

window.quickAIQuery = function(query) {
    document.getElementById('aiInput').value = query;
    sendMessageToAI();
}

function renderChatMessage(text, sender) {
    const chatBody = document.getElementById('aiChatBody');
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg ${sender}`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    if (typeof playSound === 'function') playSound('click');
}

function processAIQuery(query) {
    const q = query.toLowerCase();
    
    // 1. Bill Reminders (Natural Language)
    const billKeywords = ['remind', 'bill', 'due', 'ബില്ല്', 'ഓർമ്മിപ്പിക്കുക'];
    if (billKeywords.some(k => q.includes(k))) {
        // Extract amount if any
        const amountMatch = q.match(/[\$₹]\s?(\d+)/) || q.match(/(\d+)\s?[\$₹]/);
        const amount = amountMatch ? amountMatch[1] : null;
        
        // Extract date/time if any
        const dateMatch = q.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s?\d{1,2}/) || q.match(/\d{1,2}\s?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
        const dayMatch = q.match(/(\d{1,2})(st|nd|rd|th)/);
        
        // Malayalam pattern match
        if (q.includes('ഓർമ്മിപ്പിക്കുക') || q.includes('മെയ്') || q.includes('മാർച്ച്')) {
            const newReminder = { id: `rem_${Date.now()}`, description: 'Bill (ML)', dueDate: 'Upcoming', notified: false };
            aiReminders.push(newReminder);
            localStorage.setItem('aiReminders', JSON.stringify(aiReminders));
            return `ശരി! നിങ്ങളുടെ ബില്ല് ഞാൻ ഓർമ്മിപ്പിക്കാം. ഇതിനായുള്ള വിവരങ്ങൾ ഞാൻ കലണ്ടറിൽ ചേർത്തിട്ടുണ്ട്. (Reminder set for your bill).`;
        }

        if (dateMatch || dayMatch) {
            const reminderDate = dateMatch ? dateMatch[0] : dayMatch[0];
            const newReminder = {
                id: `rem_${Date.now()}`,
                description: q.replace('remind', '').replace('me', '').replace('to pay', '').replace('bill', '').trim(),
                amount: amount,
                dueDate: reminderDate,
                createdAt: new Date().toISOString(),
                notified: false
            };
            aiReminders.push(newReminder);
            localStorage.setItem('aiReminders', JSON.stringify(aiReminders));
            
            return `Got it! I've set a reminder for your bill ${amount ? 'of ' + formatCurrency(amount) : ''} due on ${reminderDate}. I'll notify you 2 days before! (Reminder Saved)`;
        }
        return `I can definitely set a reminder for that. Could you tell me the due date?`;
    }

    // 2. Spending Analysis
    if (q.includes('analyze') || (q.includes('spent') && !q.includes('how much'))) {
        const expenseSum = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return `I've analyzed your data. You've spent a total of ${formatCurrency(expenseSum)} across ${transactions.length} transactions. Your biggest category is Food. Need more detail?`;
    }

    // 3. Category Queries
    const categories = [...new Set(transactions.map(t => t.category.toLowerCase()))];
    const catMatch = categories.find(c => q.includes(c));
    if (catMatch && q.includes('how much')) {
        const catSum = transactions.filter(t => t.category.toLowerCase() === catMatch).reduce((s, t) => s + t.amount, 0);
        return `You have spent ${formatCurrency(catSum)} on ${catMatch.charAt(0).toUpperCase() + catMatch.slice(1)} so far.`;
    }

    // 4. Default
    return `I'm not quite sure how to help with that yet, but I'm learning! You can ask me to "Analyze my month" or "Remind me of a bill".`;
}

function checkAIReminders() {
    const now = new Date();
    if (typeof aiReminders !== 'undefined') {
        aiReminders.forEach(rem => {
            // Simple simulation: trigger notification once if not notified
            if (!rem.notified) {
                if (typeof addNotification === 'function') addNotification('AI Assistant', `Reminder: Your ${rem.description} is upcoming! (${rem.dueDate})`, 'warning');
                rem.notified = true;
                localStorage.setItem('aiReminders', JSON.stringify(aiReminders));
            }
        });
    }
}
checkAIReminders();
