const input = document.querySelector('#clip-input');
const pasteBtn = document.querySelector('#paste-btn');
const saveBtn = document.querySelector('#save-btn');
const clearBtn = document.querySelector('#clear-btn');
const refreshBtn = document.querySelector('#refresh-btn');
const entriesList = document.querySelector('#entries');
const loginShell = document.querySelector('#login-shell');
const appShell = document.querySelector('#app-shell');
const passkeyInput = document.querySelector('#passkey-input');
const loginBtn = document.querySelector('#login-btn');
const loginError = document.querySelector('#login-error');

document.querySelector('#app-version').textContent = `v${__APP_VERSION__}`;
let isFetching = false;
const AUTH_STORAGE_KEY = 'clipit.authenticated';

function isAuthenticated() {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === '1';
}

function setAuthenticated(value) {
    if (value) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, '1');
    } else {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
}

function toggleShells(authenticated) {
    loginShell.classList.toggle('hidden', authenticated);
    loginShell.setAttribute('aria-hidden', authenticated ? 'true' : 'false');
    appShell.classList.toggle('hidden', !authenticated);
    appShell.setAttribute('aria-hidden', authenticated ? 'false' : 'true');
}

function updateLoginState() {
    const empty = !passkeyInput.value.trim();
    loginBtn.disabled = empty || isFetching;
}

function setFetching(val) {
    isFetching = val;
    updateButtonStates();
}

async function linkFetch(...args) {
    setFetching(true);
    try {
        return await fetch(...args);
    } /*catch (e) {
        return new Response(null, {status: 500});
    }*/ finally {
        setFetching(false);
    }
}

function updateButtonStates() {
    const empty = !input.value.trim();
    saveBtn.disabled = empty || isFetching;
    clearBtn.disabled = isFetching;
    updateLoginState();
}

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function isUrl(s) {
    try {
        return /^https?:\/\//i.test(new URL(s).href);
    } catch {
        return false;
    }
}

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
    entriesList.innerHTML = entries.map(entry => `
        <li class="entry" data-id="${entry.id}">
            <span class="entry-text">${escHtml(entry.text)}</span>
            ${isUrl(entry.text) ? `<a class="link-btn icon-btn sm" href="${escHtml(entry.text)}" target="_blank" rel="noopener noreferrer" aria-label="Open link">${LINK_ICON}</a>` : ''}
            <button class="copy-btn icon-btn sm" aria-label="Copy">${COPY_ICON}</button>
            <button class="delete-btn icon-btn sm" aria-label="Delete">${DELETE_ICON}</button>
        </li>
    `).join('');
}

async function loadEntries() {
    const res = await linkFetch('api.php');
    const entries = res.ok ? await res.json() : [];
    render(entries);
}

async function login() {
    const passkey = passkeyInput.value.trim();
    if (!passkey) return;

    loginError.textContent = '';
    const res = await linkFetch('api.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({passkey}),
    });

    const data = res.ok ? await res.json().catch(() => ({})) : {};

    if (!res.ok || data.authenticated !== true) {
        loginError.textContent = data.error || 'Invalid passkey';
        passkeyInput.select();
        return;
    }

    setAuthenticated(true);
    passkeyInput.value = '';
    toggleShells(true);
    await loadEntries();
    input.focus();
}

pasteBtn.addEventListener('click', async () => {
    try {
        input.value = await navigator.clipboard.readText();
    } catch {}
    input.dispatchEvent(new Event('input'));
    input.focus();
});

input.addEventListener('input', updateButtonStates);
passkeyInput.addEventListener('input', updateLoginState);

loginBtn.addEventListener('click', login);

passkeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginBtn.click();
});

saveBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;

    const res = await linkFetch('api.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text}),
    });
    if (res.ok) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        const entries = await res.json();
        render(entries);
    }
});

input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBtn.click();
});

entriesList.addEventListener('click', async e => {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
        const text = copyBtn.closest('.entry').querySelector('.entry-text').textContent;
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.innerHTML = CHECK_ICON;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = COPY_ICON;
                copyBtn.classList.remove('copied');
            }, 1500);
        } catch {
            // clipboard write failed silently
        }
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const li = deleteBtn.closest('.entry');
        const id = Number(li.dataset.id);
        const text = li.querySelector('.entry-text').textContent;
        const short = text.length > 48 ? text.slice(0, 48) + '…' : text;
        const ok = await confirm(`Delete "${short}"?`);
        if (!ok) return;
        const res = await linkFetch('api.php', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id}),
        });
        if (res.ok) {
            const entries = await res.json();
            render(entries);
        }
    }
});

clearBtn.addEventListener('click', async () => {
    const ok = await confirm('Clear all entries?');
    if (!ok) return;
    const res = await linkFetch('api.php', {method: 'DELETE'});
    if (res.ok) render([]);
});

if (isAuthenticated()) {
    toggleShells(true);
    loadEntries();
} else {
    toggleShells(false);
    passkeyInput.focus();
}

refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    await loadEntries();
    refreshBtn.classList.remove('spinning');
});

// ── Confirm modal ──────────────────────────────────────────
const confirmModal   = document.querySelector('#confirm-modal');
const confirmTitle   = document.querySelector('#confirm-title');
const confirmOkBtn   = document.querySelector('#confirm-ok');
const confirmCancelBtn = document.querySelector('#confirm-cancel');

function confirm(message) {
    return new Promise(resolve => {
        confirmTitle.textContent = message;
        confirmModal.classList.add('visible');
        confirmOkBtn.focus();

        function cleanup(result) {
            confirmModal.classList.remove('visible');
            confirmOkBtn.removeEventListener('click', onOk);
            confirmCancelBtn.removeEventListener('click', onCancel);
            confirmModal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        }

        const onOk      = () => cleanup(true);
        const onCancel  = () => cleanup(false);
        const onBackdrop = e => { if (e.target === confirmModal) cleanup(false); };
        const onKey     = e => { if (e.key === 'Escape') cleanup(false); };

        confirmOkBtn.addEventListener('click', onOk);
        confirmCancelBtn.addEventListener('click', onCancel);
        confirmModal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
    });
}
// ───────────────────────────────────────────────────────────

const offlineNotice = document.querySelector('#offline-notice');
function updateOnlineStatus() {
    offlineNotice.classList.toggle('visible', !navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
updateButtonStates();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

