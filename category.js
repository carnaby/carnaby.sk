/**
 * Category Page Script
 */

const translations = {
    en: {
        navAbout: "About",
        navDev: "DevLog",
        navMusic: "Music",
        catDiff: "Difficulty",
        footerGithub: "GitHub",
        footerYoutube: "YouTube",
        readMore: "Read More"
    },
    sk: {
        navAbout: "O mne",
        navDev: "DevLog",
        navMusic: "Hudba",
        catDiff: "Náročnosť",
        footerGithub: "GitHub",
        footerYoutube: "YouTube",
        readMore: "Čítať viac"
    }
};

const categoryMeta = {
    'devlog': {
        title: "DevLog",
        icon: "lucide:terminal",
        color: "var(--emerald)",
        desc: {
            sk: "Tech svet, kódovanie, experimenty s AI a 'making of' tohto webu.",
            en: "Tech world, coding, AI experiments, and the 'making of' this site."
        }
    },
    'dodo': {
        title: "Dodo",
        icon: "lucide:guitar",
        color: "var(--amber)",
        desc: {
            sk: "Akustický folk, storyteller balady a južanský rock.",
            en: "Acoustic folk, storyteller ballads, and southern rock."
        }
    },
    'carnaby': {
        title: "Carnaby",
        icon: "lucide:music-2",
        color: "var(--purple)",
        desc: {
            sk: "Retro synth-pop a bezstarostné euro-disco.",
            en: "Retro synth-pop and carefree euro-disco."
        }
    },
    'music': {
        title: "Music",
        icon: "lucide:music",
        color: "var(--amber)",
        desc: {
            sk: "Všetky hudobné projekty (Dodo & Carnaby).",
            en: "All music projects (Dodo & Carnaby)."
        }
    }
};

let currentLang = localStorage.getItem('preferredLanguage') || 'sk';
// Extract slug from URL: /category/xyz
const slug = window.location.pathname.split('/').pop();

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguage();

    // SSR Hydration Check
    if (window.initialPosts) {
        // SSR already rendered Title, Icon, Posts
        console.log('⚡ SSR Content active (Category)');
    } else {
        setupCategory();
        loadPosts();
    }

    checkAuth();
});

function setupCategory() {
    const meta = categoryMeta[slug] || { title: slug, icon: 'lucide:hash', color: 'var(--text-primary)', desc: { sk: '', en: '' } };

    document.title = `${meta.title} - Jozef Sokol`;

    const iconBox = document.getElementById('cat-icon');
    iconBox.innerHTML = `<iconify-icon icon="${meta.icon}"></iconify-icon>`;
    iconBox.style.color = meta.color;
    iconBox.style.borderColor = meta.color;
    iconBox.style.background = `color-mix(in srgb, ${meta.color} 10%, transparent)`;

    document.getElementById('cat-title').textContent = meta.title;
    // Apply gradient text for title
    const titleEl = document.getElementById('cat-title');
    titleEl.style.background = `linear-gradient(to right, ${meta.color}, var(--text-primary))`;
    titleEl.style.webkitBackgroundClip = 'text';
    titleEl.style.backgroundClip = 'text';
    titleEl.style.color = 'transparent'; // Fallback needs check if supported, but usually fine
    // Or just simple color: titleEl.style.color = meta.color;

    document.getElementById('cat-desc').textContent = meta.desc[currentLang] || '';
}

function initLanguage() {
    setLanguage(currentLang);
    updateLangButton();
}

function switchLanguage(lang) {
    if (currentLang === lang) return;
    currentLang = lang;
    localStorage.setItem('preferredLanguage', lang);
    setLanguage(lang);
    setupCategory(); // Update desc
    loadPosts(); // Reload posts
    updateLangButton();
}

function setLanguage(lang) {
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
}

function updateLangButton() {
    const btn = document.querySelector('#current-lang');
    if (btn) btn.textContent = currentLang.toUpperCase();
}

function initTheme() {
    const savedTheme = localStorage.getItem('preferredTheme') || 'dark';
    applyTheme(savedTheme);
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('preferredTheme', theme);
}

async function loadPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = `
        <div class="loading-state">
            <iconify-icon icon="lucide:loader-2" class="spin" style="font-size: 2rem;"></iconify-icon>
        </div>
    `;

    try {
        let apiUrl = `/api/posts?language=${currentLang}`;

        // Handle "Music" as combination or special key
        // For now, pass strict slug. If 'music' isn't a category in DB, backend returns empty.
        // If we want Dodo + Carnaby for 'music', we might need multiple calls or backend support.
        // Assuming user has a 'Music' category or we filter client side?
        // Let's rely on standard category filtering first.

        // Backend expects slug (e.g. 'devlog'), which is typically lowercase.
        // We should send the slug exactly as it is (or ensure it's lowercased if URL came in uppercase).
        // Our categories in DB (from generateSlug) are lowercase.

        // Map legacy shortcodes if used, but map to SLUGS (lowercase)
        let catFilter = slug.toLowerCase();
        if (catFilter === 'dev') catFilter = 'devlog';

        apiUrl += `&category=${catFilter}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.success) {
            renderPosts(data.data);
        } else {
            container.innerHTML = `<div class="loading-state">Failed to load posts.</div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="loading-state">Error connecting to server.</div>`;
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = `<div class="loading-state" style="opacity:0.6">No posts found.</div>`;
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('a');
        card.href = `/posts/${post.slug}`;
        card.className = 'post-card-horizontal animate-slide-up';

        let imageHtml = '';
        if (post.thumbnail_path) {
            const filename = post.thumbnail_path.split('/').pop();
            const imageUrl = `/images/600/${filename}`;
            imageHtml = `
                <div class="pch-image">
                    <img src="${imageUrl}" alt="${post.title}" loading="lazy" onerror="this.src='/thumbnails/originals/${filename}'">
                </div>
            `;
        } else if (post.youtube_id) {
            imageHtml = `
                <div class="pch-image">
                    <img src="https://img.youtube.com/vi/${post.youtube_id}/hqdefault.jpg" alt="${post.title}">
                </div>
            `;
        } else {
            imageHtml = `
                <div class="pch-image" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">
                    <iconify-icon icon="lucide:image-off" style="font-size:2rem; opacity:0.3"></iconify-icon>
                </div>
            `;
        }

        // Categories with Color
        let catHtml = '';
        if (post.categories && post.categories.length > 0) {
            catHtml = post.categories.map(c => {
                const cSlug = c.slug || c.name.toLowerCase();
                // Lookup color in global categoryMeta or default
                const meta = categoryMeta[cSlug] || { color: 'var(--text-primary)' };
                return `<span style="color: ${meta.color}; font-weight:600;">${c.name}</span>`;
            }).join(', ');
        }

        const date = new Date(post.published_at || post.created_at).toLocaleDateString(currentLang);

        card.innerHTML = `
            <div class="pch-content">
                <div class="pch-header">
                     <span class="pch-category">${catHtml}</span>
                     <span class="pch-date">${date}</span>
                </div>
                <h3 class="pch-title">${post.title}</h3>
                <p class="pch-excerpt">${post.excerpt || ''}</p>
            </div>
            ${imageHtml}
        `;

        container.appendChild(card);
    });
}

async function checkAuth() {
    const authSection = document.getElementById('auth-section');
    try {
        const res = await fetch('/auth/user');
        const data = await res.json();
        if (data.authenticated) {
            const avatarUrl = data.user.avatarUrl || 'images/default-avatar.png';
            authSection.innerHTML = `
                <div class="lang-dropdown">
                    <button class="control-btn" style="padding: 2px;">
                        <img src="${avatarUrl}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--glass-border);">
                    </button>
                    <div class="lang-menu" style="width: 140px; right: 0;">
                        <div style="padding: 8px; font-size: 0.75rem; border-bottom: 1px solid var(--glass-border); margin-bottom: 4px; color: var(--text-primary);">
                            ${data.user.displayName}
                        </div>
                        ${data.user.role === 'admin' ? '<a href="/admin" style="display:block; padding:8px; font-size:0.8rem; border-radius:4px; margin-bottom:2px;">Admin Panel</a>' : ''}
                        <button onclick="window.location.href='/auth/logout'" style="text-align:left; color: var(--rose);">Logout</button>
                    </div>
                </div>
            `;
        }
    } catch (e) { console.warn(e); }
}
