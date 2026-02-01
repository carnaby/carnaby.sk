/**
 * Dodo's Portfolio Script
 * Handles I18n, Theme, Posts fetching, and Auth
 */

// --- State ---
let currentLang = localStorage.getItem('preferredLanguage') || 'sk'; // Default SK for local vibes
let currentCategory = 'all';

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguage();
    loadPosts();
    checkAuth();
    updateFooterYear(); // Dynamic year
});

function updateFooterYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// --- Translations ---
const translations = {
    en: {
        navAbout: "About",
        navDev: "DevLog",
        navMusic: "Music",

        heroTitle: "Songs for the Journey",

        aboutLabel: "ABOUT ME",
        aboutIntro: "The worlds of coding and music are closer than they appear. Both are about finding harmony, logic, and rhythm. My journey began behind a mixing console and at rock radio Rebeca, but today it is defined by lines of code and the possibilities of artificial intelligence.",
        aboutIntro2: "As a full-stack developer, I build digital solutions, while as a music enthusiast, I seek space within technology for genuine human emotion.",

        descDevLog: "Here I step out as Jozef. I write about developing in React and TypeScript, taming AI models, and the 'making of' this site. A space for technical insights, experiments, and a candid look behind the scenes of my work with Antigravity technology.",
        descDodo: "Dodo is my quieter, more reflective side. Music for peaceful mornings and long drives. Acoustic folk, ballads, and storytelling Americana about hope, missed trains, and unexpected joy.",
        descCarnaby: "A return to my DJ roots. Pure energy, carefree Euro-disco, and the neon atmosphere of the 80s. While Dodo tells stories, Carnaby creates a vibe. Dance rhythms, electronic soundscapes, and retro nostalgia.",

        aiMusicNote: "Music: AI (Suno)",
        humanLyricsNote: "Lyrics & Stories: Human (Original)",

        feedTitle: "FEED",

        footerGithub: "GitHub",
        footerYoutube: "YouTube",
    },
    sk: {
        navAbout: "O mne",
        navDev: "DevLog",
        navMusic: "Hudba",

        heroTitle: "Songs for the Journey",

        aboutLabel: "O MNE",
        aboutIntro: "Svet kódovania a svet hudby majú k sebe bližšie, než sa na prvý pohľad zdá. Obe sú o hľadaní harmónie, logiky a rytmu. Moja cesta začala za mixpultom a v rockovom rádiu Rebeca, no dnes ju definujú riadky kódu a možnosti umelej inteligencie.",
        aboutIntro2: "Ako full-stack vývojár staviam digitálne riešenia, zatiaľ čo ako nadšenec do hudby hľadám v technológiách priestor pre skutočnú ľudskú emóciu.",

        descDevLog: "Tu vystupujem civilne ako Jozef. Píšem o tom, ako vyvíjam v Reacte a TypeScripte, ako krotím AI modely a čo všetko obnáša 'making of' tohto webu. Priestor pre experimenty a pohľad do zákulisia mojej práce s technológiou Antigravity.",
        descDodo: "Dodo je moja tichšia, rozvážnejšia stránka. Hudba pre pokojné rána a dlhé cesty autom. Akustický folk, balady a storytellingová Americana o nádeji, zmeškaných vlakoch a nečakanej radosti.",
        descCarnaby: "Návrat k DJ koreňom. Čistá energia, bezstarostné euro-disco a neónová atmosféra 80. rokov. Kým Dodo rozpráva príbehy, Carnaby vytvára vibe. Tanečný rytmus a retro nostalgia.",

        aiMusicNote: "Hudba: AI (Suno)",
        humanLyricsNote: "Texty & Príbehy: Human (Original)",

        feedTitle: "PRÍSPEVKY",

        footerGithub: "GitHub",
        footerYoutube: "YouTube",
    }
};

// ... (existing state and i18n/theme functions unchanged) ...

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = `<div class="loading-state" style="opacity:0.6">No posts found for this category.</div>`;
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('a');
        card.href = `/posts/${post.slug}`;
        // Using horizontal card class but with injected style for height/layout
        card.className = 'post-card-horizontal animate-slide-up';
        card.style.minHeight = '180px'; // Taller as requested

        // Image logic
        let imageHtml = '';
        if (post.thumbnail_path) {
            const filename = post.thumbnail_path.split('/').pop();
            const imageUrl = `/images/600/${filename}`;

            imageHtml = `
                <div class="pch-image">
                    <img src="${imageUrl}" alt="${post.title}" loading="lazy" 
                        onerror="this.src='/thumbnails/originals/${filename}'">
                </div>
            `;
        } else if (post.youtube_id) {
            imageHtml = `
                <div class="pch-image">
                    <img src="https://img.youtube.com/vi/${post.youtube_id}/hqdefault.jpg" alt="${post.title}" loading="lazy">
                    <div class="play-icon-overlay">▶</div>
                </div>
            `;
        }

        // Categories logic
        let catText = '';
        if (post.categories && post.categories.length > 0) {
            catText = post.categories.map(c => c.name).join(', ');
        }

        const date = new Date(post.published_at || post.created_at).toLocaleDateString(currentLang);

        card.innerHTML = `
            <div class="pch-content">
                <div class="pch-header">
                     <span class="pch-category" style="color:var(--emerald); opacity:0.8;">${catText}</span>
                     <span class="pch-date">${date}</span>
                </div>
                
                <h3 class="pch-title" style="font-size:1.4rem; margin-bottom:12px;">${post.title}</h3>
                <p class="pch-excerpt" style="font-size:0.95rem; -webkit-line-clamp: unset; display: block;">${post.excerpt || ''}</p>
            </div>
            ${imageHtml}
        `;

        container.appendChild(card);
    });
}

// --- I18n ---
function initLanguage() {
    // Set initial
    setLanguage(currentLang);

    // Update dropdown text
    updateLangButton();
}

function switchLanguage(lang) {
    if (currentLang === lang) return;
    currentLang = lang;
    localStorage.setItem('preferredLanguage', lang);
    setLanguage(lang);
    loadPosts(); // Reload posts to get translated content
    updateLangButton();
}

function setLanguage(lang) {
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.documentElement.lang = lang;
}

function updateLangButton() {
    const btn = document.querySelector('#current-lang');
    if (btn) btn.textContent = currentLang.toUpperCase();
}

// --- Theme ---
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

// --- Posts ---
async function loadPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = `
        <div class="loading-state">
            <iconify-icon icon="lucide:loader-2" class="spin" style="font-size: 2rem;"></iconify-icon>
        </div>
    `;

    try {
        // Fetch with language param
        // User requested ONLY featured posts on homepage
        let url = `/api/posts?language=${currentLang}&featured=true`;

        // Legacy category support (though categories now have own pages)
        if (currentCategory && currentCategory !== 'all') {
            url += `&category=${currentCategory}`;
        }

        const res = await fetch(url);
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

function filterPosts(category) {
    currentCategory = category;

    // Scroll to feed
    document.querySelector('.feed-divider').scrollIntoView({ behavior: 'smooth' });

    loadPosts();
}



// --- Auth ---
async function checkAuth() {
    const authSection = document.getElementById('auth-section');
    try {
        const res = await fetch('/auth/user');
        const data = await res.json();

        if (data.authenticated) {
            // Show avatar instead of login icon
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
    } catch (e) {
        console.warn('Auth check failed', e);
    }
}
