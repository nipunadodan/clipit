const input = document.querySelector('#clip-input');
const pasteBtn = document.querySelector('#paste-btn');
const saveBtn = document.querySelector('#save-btn');
const clearBtn = document.querySelector('#clear-btn');
const refreshBtn = document.querySelector('#refresh-btn');
const themeBtn = document.querySelector('#theme-btn');
const logoutBtn = document.querySelector('#logout-btn');
const entriesList = document.querySelector('#entries');
const loginShell = document.querySelector('#login-shell');
const appShell = document.querySelector('#app-shell');
const passkeyInput = document.querySelector('#passkey-input');
const loginBtn = document.querySelector('#login-btn');
const loginError = document.querySelector('#login-error');

document.querySelector('#app-version').textContent = `v${__APP_VERSION__}`;
let isFetching = false;
const AUTH_STORAGE_KEY = 'clipit.authenticated';

const AUTH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function isAuthenticated() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    try {
        const {expiry} = JSON.parse(raw);
        if (Date.now() > expiry) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return false;
        }
        return true;
    } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return false;
    }
}

function setAuthenticated(value) {
    if (value) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({expiry: Date.now() + AUTH_EXPIRY_MS}));
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
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

async function clipitFetch(url, method = 'GET', data = null, options = {}) {
    setFetching(true);
    const isGet = method === 'GET';
    return await fetch(url, {
        method,
        ...(!isGet && {
            headers: {'Content-Type': 'application/json'},
            ...(data != null && {body: JSON.stringify(data)}),
        }),
        ...options,
    })
        .then(res => {
            if (res.status === 401) {
                handleUnauthorized();
                return res;
            }
            return res;
        })
        .catch(e => {
            console.error('Fetch error:', e);
        })
        .finally(() => setFetching(false));
}

function handleUnauthorized() {
    setAuthenticated(false);
    toggleShells(false);
    passkeyInput.focus();
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
const PIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;

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
        entriesList.innerHTML = '<li class="empty muted text-center">No entries yet</li>';
        return;
    }
    entriesList.innerHTML = entries.map(entry => `
        <li class="entry flex items-center rounded${entry.pinned ? ' pinned' : ''}" data-id="${entry.id}" data-pinned="${entry.pinned}">
            <span class="entry-text flex-1 min-w-0">${escHtml(entry.text)}</span>
            ${isUrl(entry.text) ? `<a class="link-btn icon-btn sm" href="${escHtml(entry.text)}" target="_blank" rel="noopener noreferrer" aria-label="Open link">${LINK_ICON}</a>` : ''}
            <button class="pin-btn icon-btn sm${entry.pinned ? ' active' : ''}" aria-label="${entry.pinned ? 'Unpin' : 'Pin'}">${PIN_ICON}</button>
            <button class="copy-btn icon-btn sm" aria-label="Copy">${COPY_ICON}</button>
            <button class="delete-btn icon-btn sm" aria-label="Delete">${DELETE_ICON}</button>
        </li>
    `).join('');
}

function storeEntries(entries) {
    if (entries !== undefined) {
        try {
            localStorage.setItem('clipit.entries', JSON.stringify(entries));
        } catch (e) {
            console.error('Failed to save entries to localStorage:', e);
        }
    }

    const stored = localStorage.getItem('clipit.entries');
    if (stored) {
        try {
            return JSON.parse(stored) || [];
        } catch (e) {
            console.error('Failed to parse entries from localStorage:', e);
            return [];
        }
    }
    return [];
}

async function loadEntries() {
    const res = await clipitFetch('api.php');

    if (res && res.ok) {
        try {
            const entries = await res.json();
            storeEntries(entries);
        } catch (e) {
            console.error('Failed to parse entries from response:', e);
        }
    }

    const entriesToRender = storeEntries();
    render(entriesToRender);
}

async function login() {
    const passkey = passkeyInput.value.trim();
    if (!passkey) return;

    loginError.textContent = '';
    const res = await clipitFetch('api.php', 'POST', {passkey});

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

    const pendingShare = sessionStorage.getItem('clipit.pendingShare');
    if (pendingShare) {
        sessionStorage.removeItem('clipit.pendingShare');
        showShareConfirm(JSON.parse(pendingShare));
    }

    input.focus();
}

pasteBtn.addEventListener('click', async () => {
    try {
        input.value = await navigator.clipboard.readText();
    } catch {
    }
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

    const res = await clipitFetch('api.php', 'POST', {text});
    if (res.ok) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        const entries = await res.json();
        // Persist returned entries and render from localStorage
        storeEntries(entries);
        render(storeEntries());
    }
});

input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBtn.click();
});

entriesList.addEventListener('click', async e => {
    const pinBtn = e.target.closest('.pin-btn');
    if (pinBtn) {
        const li = pinBtn.closest('.entry');
        const id = Number(li.dataset.id);
        const currentlyPinned = li.dataset.pinned === '1';
        await togglePin(id, !currentlyPinned);
        return;
    }

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
        const res = await clipitFetch('api.php', 'DELETE', {id});
        if (res.ok) {
            const entries = await res.json();
            storeEntries(entries);
            render(storeEntries());
        }
    }
});

clearBtn.addEventListener('click', async () => {
    const ok = await confirm('Clear all entries?');
    if (!ok) return;
    const res = await clipitFetch('api.php', 'DELETE');
    if (res.ok) {
        const entries = await res.json();
        storeEntries(entries);
        render(storeEntries());
    }
});

async function togglePin(id, pinned) {
    const res = await clipitFetch('api.php', 'PATCH', {id, pinned});
    if (res && res.ok) {
        const entries = await res.json();
        storeEntries(entries);
        render(storeEntries());
    }
}

// ── Web Share Target ────────────────────────────────────────
const shareConfirm    = document.querySelector('#share-confirm');
const shareFields     = document.querySelector('#share-fields');
const shareSaveBtn    = document.querySelector('#share-save-btn');
const shareDismissBtn = document.querySelector('#share-dismiss-btn');

function getShareParams() {
    const params = new URLSearchParams(window.location.search);
    let title = params.get('title')?.trim() || null;
    let text  = params.get('text')?.trim()  || null;
    let url   = params.get('url')?.trim()   || null;

    // Android Chrome packs: text = '"Page Title" https://...'
    if (text && !url) {
        const m = text.match(/^"([\s\S]+?)"\s+(https?:\/\/\S+)$/);
        if (m) {
            url = m[2];
            const quoted = m[1].trim();
            if (!title)              { title = quoted; text = null; }
            else if (quoted === title) { text = null; }
            else                     { text = quoted; }
        }
    }

    // Some share sources put the URL inside `text` and leave `url` empty
    if (!url && text && isUrl(text)) { url = text; text = null; }

    // Deduplicate: if text and url are identical, keep only url
    if (url && text === url) text = null;

    if (!title && !text && !url) return null;
    return {title, text, url};
}

function showShareConfirm(params) {
    shareFields.innerHTML = Object.entries(params)
        .filter(([, v]) => v)
        .map(([k, v]) => `
            <label class="share-field flex items-center gap-2 rounded">
                <input type="checkbox" class="share-checkbox" value="${escHtml(v)}" checked>
                <span class="share-field-key">${k}</span>
                <span class="share-field-val flex-1 min-w-0">${escHtml(v)}</span>
            </label>
        `).join('');
    shareConfirm.classList.remove('hidden');
}

shareSaveBtn.addEventListener('click', async () => {
    const checked = [...shareFields.querySelectorAll('.share-checkbox:checked')].map(c => c.value);
    shareConfirm.classList.add('hidden');
    if (checked.length) await saveSharedText(checked.join(' '));
});

shareDismissBtn.addEventListener('click', () => shareConfirm.classList.add('hidden'));

async function saveSharedText(text) {
    const res = await clipitFetch('api.php', 'POST', {text});
    if (res.ok) {
        const entries = await res.json();
        storeEntries(entries);
        render(storeEntries());
    }
}


function clearShareParams() {
    const url = new URL(window.location);
    url.searchParams.delete('title');
    url.searchParams.delete('text');
    url.searchParams.delete('url');
    history.replaceState(null, '', url.pathname + (url.search !== '?' ? url.search : ''));
}

// ────────────────────────────────────────────────────────────

if (isAuthenticated()) {
    toggleShells(true);
    const shareParams = getShareParams();
    if (shareParams) {
        clearShareParams();
        loadEntries().then(() => showShareConfirm(shareParams));
    } else {
        loadEntries();
    }
} else {
    const shareParams = getShareParams();
    if (shareParams) {
        clearShareParams();
        sessionStorage.setItem('clipit.pendingShare', JSON.stringify(shareParams));
    }
    toggleShells(false);
    passkeyInput.focus();
}

logoutBtn.addEventListener('click', async () => {
    await clipitFetch('api.php', 'POST', {logout: true});
    handleUnauthorized();
});

refreshBtn.addEventListener('click', async () => {
    await loadEntries();
    refreshBtn.classList.remove('spinning');
});

// ── Confirm modal ──────────────────────────────────────────
const confirmModal = document.querySelector('#confirm-modal');
const confirmTitle = document.querySelector('#confirm-title');
const confirmOkBtn = document.querySelector('#confirm-ok');
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

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = e => {
            if (e.target === confirmModal) cleanup(false);
        };
        const onKey = e => {
            if (e.key === 'Escape') cleanup(false);
        };

        confirmOkBtn.addEventListener('click', onOk);
        confirmCancelBtn.addEventListener('click', onCancel);
        confirmModal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
    });
}

// ───────────────────────────────────────────────────────────

const offlineNotice = document.querySelector('#offline-notice');
const useOfflineBtn = document.querySelector('#use-offline-btn');
let offlineDismissed = false;

function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineDismissed = false;
    }
    offlineNotice.classList.toggle('visible', !navigator.onLine && !offlineDismissed);
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
useOfflineBtn.addEventListener('click', () => {
    offlineDismissed = true;
    offlineNotice.classList.remove('visible');
});
updateOnlineStatus();
updateButtonStates();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
    });
}

// ── Theme toggle ────────────────────────────────────────────
const THEME_KEY = 'clipit.theme';

function applyTheme(theme) {
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

// Restore saved theme on load (initial state already handled by inline script in <head>)
const _savedTheme = localStorage.getItem(THEME_KEY);
if (_savedTheme) applyTheme(_savedTheme);

themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Determine effective current mode
    const isDark = current === 'dark' || (!current && systemDark);
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
});
// ────────────────────────────────────────────────────────────

