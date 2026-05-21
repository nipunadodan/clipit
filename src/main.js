const input = document.querySelector('#clip-input');
const pasteBtn = document.querySelector('#paste-btn');
const saveBtn = document.querySelector('#save-btn');
const entriesList = document.querySelector('#entries');

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function escHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function render(entries) {
    if (!entries.length) {
        entriesList.innerHTML = '<li class="empty">No entries yet</li>';
        return;
    }
    entriesList.innerHTML = entries.map(text => `
        <li class="entry">
            <span class="entry-text">${escHtml(text)}</span>
            <button class="copy-btn" aria-label="Copy">${COPY_ICON}</button>
        </li>
    `).join('');
}

async function loadEntries() {
    const res = await fetch('/api/link');
    const entries = res.ok ? await res.json() : [];
    render(entries);
}

pasteBtn.addEventListener('click', async () => {
    try {
        input.value = await navigator.clipboard.readText();
        input.focus();
    } catch {
        input.focus();
    }
});

saveBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;

    //https://accounts.nipunadodan.com/accounts-api/google/
    const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    if (res.ok) {
        input.value = '';
        const entries = await res.json();
        render(entries);
    }
});

input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBtn.click();
});

entriesList.addEventListener('click', async e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const text = btn.closest('.entry').querySelector('.entry-text').textContent;
    try {
        await navigator.clipboard.writeText(text);
        btn.innerHTML = CHECK_ICON;
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = COPY_ICON;
            btn.classList.remove('copied');
        }, 1500);
    } catch {
        // clipboard write failed silently
    }
});

loadEntries();
