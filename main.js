const input = document.querySelector('#link-input');
const display = document.querySelector('#shared-link');

// Load current link
async function loadLink() {
    const res = await fetch('/api/link');
    if (res.ok) {
        const data = await res.json();
        display.innerHTML = `<a href="${data.link}" target="_blank">${data.link}</a>`;
    }
}

// Share new link
document.querySelector('#share-btn').onclick = async () => {
    await fetch('/api/link', {
        method: 'POST',
        body: JSON.stringify({ link: input.value })
    });
    loadLink(); // Refresh UI
};

loadLink();
