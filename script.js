// Language translations
const translations = {
    en: {
        // Navigation
        navAbout: "About",
        navSongs: "Posts",

        // Hero
        heroTitle: "DODO",
        heroTagline: "Songs for the Journey",

        // About section
        aboutTitle: "About",
        aboutP1: "This space is about songs that emerge from silence, memories, and the present moment. My journey to music led through rock radio Rebeca, years behind the mixing desk as a DJ. Today, as a programmer, I combine this human experience with the possibilities of technology.",
        aboutP2: "You'll find two faces of my work here:",

        // Music styles
        stylesDodoTitle: "Dodo",
        stylesDodoDesc: "Acoustic folk, storyteller ballads, and southern rock (Americana). Music for quiet mornings and journeys home.",
        stylesCarnabyTitle: "Carnaby",
        stylesCarnabyDesc: "Return to my DJ roots, retro synth-pop and carefree euro-disco inspired by the sound of the 80s and 90s.",

        aboutP3: "Music here is not about trends or perfection. It's about the journey, peace, and moments in between. All compositions are created without pressure and ambition to prove anything – they are made for the joy of creation.",

        noteAI: "🎶 Created with AI assistance (Suno), but guided by personal story.",
        noteLyrics: "✍️ All lyrics are original and written for these songs.",

        // Songs section
        songsTitle: "Posts",
        songsSubtitle: "If you're looking for music that doesn't push anywhere and allows you to be quiet, you're in the right place.",

        // CTA
        ctaButton: "See more on YouTube",

        // Category tabs
        tabAll: "All",

        // Footer
        footerCopyright: "©",
        footerCopyrightText: "Dodo – Songs for the Journey",
        aiExperiment: "🤖 This website is an AI experiment created using",
        aiAnd: "&",
        aiJourney: "Documentation of our journey together is on",
        themeToggle: "Toggle theme",

        // Loading
        loadingVideos: "Loading posts...",
        errorLoadingVideos: "Error loading posts. Please refresh the page.",
        noVideosFound: "No posts found.",

        // Authentication
        signInWithGoogle: "Sign in with Google",
        logout: "Logout",
        adminPanel: "Administration"
    },
    sk: {
        // Navigation
        navAbout: "O mne",
        navSongs: "Príspevky",
        navAbout: "O mne",

        // Hero
        heroTitle: "DODO",
        heroTagline: "Songs for the Journey",

        // About section
        aboutTitle: "O mne",
        aboutP1: "Tento priestor je o piesňach, ktoré vznikajú z ticha, spomienok a prítomného momentu. Moja cesta k hudbe viedla cez rockové rádio Rebeca, roky za mixpultom ako DJ. Dnes, ako programátor, spájam túto ľudskú skúsenosť s možnosťami technológií.",
        aboutP2: "Nájdete tu dve tváre mojej tvorby:",

        // Music styles
        stylesDodoTitle: "Dodo",
        stylesDodoDesc: "Akustický folk, storyteller balady a južanský rock (Americana). Hudba pre pokojné rána a cesty domov.",
        stylesCarnabyTitle: "Carnaby",
        stylesCarnabyDesc: "Návrat k mojim DJ koreňom, retro synth-pop a bezstarostné euro-disco inšpirované zvukom 80. a 90. rokov.",

        aboutP3: "Hudba tu nie je o trendoch ani o dokonalosti. Je o ceste, pokoji a chvíľach medzi tým. Všetky skladby vznikajú bez tlaku a ambícií niečo dokazovať – sú robené pre radosť z tvorby.",

        noteAI: "🎶 Vytvorené s pomocou AI (Suno), ale vedené osobným príbehom.",
        noteLyrics: "✍️ Všetky texty sú originálne a napísané pre tieto skladby.",

        // Songs section
        songsTitle: "Príspevky",
        songsSubtitle: "Ak hľadáš hudbu, ktorá nikam netlačí a dovolí ti byť ticho, si na správnom mieste.",

        // CTA
        ctaButton: "Pozri viac na YouTube",

        // Category tabs
        tabAll: "Všetky",

        // Footer
        footerCopyright: "©",
        footerCopyrightText: "Dodo – Songs for the Journey",
        aiExperiment: "🤖 Tento web je AI experiment vytvorený pomocou",
        aiAnd: "&",
        aiJourney: "Dokumentácia našej spoločnej cesty je na",
        themeToggle: "Prepnúť tému",

        // Loading
        loadingVideos: "Načítavam príspevky...",
        errorLoadingVideos: "Nepodarilo sa načítať príspevky",
        noVideosFound: "Nenašli sa žiadne príspevky",

        // Authentication
        signInWithGoogle: "Prihlásiť sa cez Google",
        logout: "Odhlásiť sa",
        adminPanel: "Administrácia"
    }
};

// Detect user's preferred language
function detectLanguage() {
    // Check if language is already saved in localStorage
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
        return savedLang;
    }

    // Get browser language
    const browserLang = navigator.language || navigator.userLanguage;

    // Check if it's Slovak or Czech
    if (browserLang.startsWith('sk') || browserLang.startsWith('cs')) {
        return 'sk';
    }

    // Default to English
    return 'en';
}

// Apply translations to the page
function applyTranslations(lang) {
    const t = translations[lang];

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (t[key]) {
            element.textContent = t[key];
        }
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Save preference
    localStorage.setItem('preferredLanguage', lang);

    // Update active state on language switcher
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        }
    });
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentLang = detectLanguage();
    applyTranslations(currentLang);

    // Add click handlers to language switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            applyTranslations(lang);
        });
    });

    // Set dynamic copyright year
    const copyrightYear = document.getElementById('copyrightYear');
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear() + ' ';
    }

    // Load videos from API
    loadVideos();

    // Initialize theme
    initTheme();

    // Check authentication status
    checkAuth();
});

// Check if user is admin and show admin menu
async function checkAdminAccess() {
    try {
        const response = await fetch('/admin/api/check');
        const data = await response.json();

        if (data.isAdmin) {
            const adminMenuItem = document.getElementById('admin-menu-item');
            if (adminMenuItem) {
                adminMenuItem.style.display = 'flex';
            }
        }
    } catch (error) {
        // Not admin or not logged in - menu stays hidden
        console.log('Admin check:', error.message);
    }
}

// Global variable to store videos by category
let videosByCategory = {};

// Load videos from API
async function loadVideos() {
    const songsGrid = document.getElementById('songsGrid');
    const currentLang = localStorage.getItem('preferredLanguage') || detectLanguage();
    const t = translations[currentLang];

    try {
        const response = await fetch('/api/videos');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to load videos');
        }

        // Store videos by category
        videosByCategory = result.data;

        // Render all videos by default
        renderVideos('all');

        // Add tab click handlers
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');

                // Update active state
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Render filtered videos
                renderVideos(category);
            });
        });

    } catch (error) {
        console.error('Error loading videos:', error);
        songsGrid.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${t.errorLoadingVideos}</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// Render videos based on selected category
function renderVideos(category) {
    const songsGrid = document.getElementById('songsGrid');
    const currentLang = localStorage.getItem('preferredLanguage') || detectLanguage();
    const t = translations[currentLang];

    // Clear grid
    songsGrid.innerHTML = '';

    // Collect videos to display
    let videosToShow = [];
    if (category === 'all') {
        // Show all videos from all categories
        for (const cat in videosByCategory) {
            videosToShow.push(...videosByCategory[cat]);
        }
    } else {
        // Show videos from selected category
        videosToShow = videosByCategory[category] || [];
    }

    if (videosToShow.length === 0) {
        songsGrid.innerHTML = `<div class="error-message"><p>⚠️ ${t.noVideosFound}</p></div>`;
        return;
    }

    // Create video cards
    videosToShow.forEach(post => {
        const postCard = createPostCard(post);
        songsGrid.appendChild(postCard);
    });
}

// Create post card element
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'song-card';

    // Link wrapper
    const link = document.createElement('a');
    link.href = `/posts/${post.slug}`;
    link.className = 'card-link';
    link.style.textDecoration = 'none';
    link.style.color = 'inherit';
    link.style.display = 'block';

    // Highlight featured posts
    if (post.isFeatured) {
        card.classList.add('featured-post');
        card.style.border = '1px solid var(--accent-gold)';
        card.style.position = 'relative'; // Ensure positioning context
    }

    // Thumbnail / Video Wrapper
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'video-wrapper';
    mediaWrapper.style.position = 'relative';
    mediaWrapper.style.overflow = 'hidden';

    // Featured Badge
    if (post.isFeatured) {
        const badge = document.createElement('div');
        badge.className = 'featured-badge';
        badge.textContent = '⭐'; // Simple star icon
        badge.title = 'Top Príspevok';
        badge.style.position = 'absolute';
        badge.style.top = '10px';
        badge.style.right = '10px';
        badge.style.zIndex = '5';
        badge.style.background = 'rgba(0,0,0,0.6)';
        badge.style.backdropFilter = 'blur(4px)';
        badge.style.padding = '5px';
        badge.style.borderRadius = '50%';
        badge.style.border = '1px solid var(--accent-gold)';
        mediaWrapper.appendChild(badge);
    }

    // Image
    const img = document.createElement('img');

    // Handle image source
    if (post.thumbnail) {
        // Extract filename from path (works for /thumbnails/file.jpg or /thumbnails/originals/file.jpg)
        const filename = post.thumbnail.split('/').pop().replace(/\.[^/.]+$/, "") + ".webp"; // always requests webp
        // Wait, routes/images.js takes filename as input (with extension?)
        // routes/images.js: const filename = req.params.filename; 
        // It looks for invalid widths.
        // It constructs cachedFilename = parse(filename).name + .webp
        // It looks for SOURCE called filename.
        // So we must pass the ORIGINAL extension in the URL request if we want to find the source?
        // NO, the route parameter :filename is what we pass.
        // If we pass thumb.jpg, it looks for thumb.jpg in originals.
        // It saves as thumb.webp.
        // So we should pass the ORIGINAL filename.

        const originalFilename = post.thumbnail.split('/').pop();

        img.src = `/images/600/${originalFilename}`;
        img.srcset = `/images/300/${originalFilename} 300w, /images/600/${originalFilename} 600w`;
        img.sizes = "(max-width: 768px) 100vw, 50vw";
        // Fallback for error?
        img.onerror = function () {
            this.onerror = null; // Prevent infinite loop
            this.srcset = '';
            // Try to load from originals since we moved them there
            this.src = `/thumbnails/originals/${originalFilename}`;
        };
    } else if (post.url) {
        img.src = `https://img.youtube.com/vi/${post.url}/hqdefault.jpg`;
    } else {
        // Fallback placeholder
        img.src = 'images/baner.webp';
    }

    img.alt = post.title;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.transition = 'transform 0.3s ease';

    // Play icon overlay to indicate video
    const playIcon = document.createElement('div');
    playIcon.className = 'play-icon-overlay';
    playIcon.innerHTML = '▶';
    playIcon.style.position = 'absolute';
    playIcon.style.top = '50%';
    playIcon.style.left = '50%';
    playIcon.style.transform = 'translate(-50%, -50%)';
    playIcon.style.fontSize = '3rem';
    playIcon.style.color = 'white';
    playIcon.style.opacity = '0.8';
    playIcon.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';

    mediaWrapper.appendChild(img);
    if (post.url && post.url.trim() !== '') {
        mediaWrapper.appendChild(playIcon);
    }

    // Content container
    const content = document.createElement('div');
    content.className = 'card-content';
    content.style.padding = '1rem';

    // Title
    const title = document.createElement('h3');
    title.textContent = post.title;
    title.style.margin = '0 0 0.5rem 0';
    title.style.fontSize = '1.1rem';

    content.appendChild(title);

    link.appendChild(mediaWrapper);
    link.appendChild(content);
    card.appendChild(link);

    // Hover effect using JS (or should be CSS)
    card.addEventListener('mouseenter', () => {
        img.style.transform = 'scale(1.05)';
        playIcon.style.opacity = '1';
    });
    card.addEventListener('mouseleave', () => {
        img.style.transform = 'scale(1)';
        playIcon.style.opacity = '0.8';
    });

    return card;
}

// Theme management
function detectTheme() {
    // Check if theme is already saved in localStorage
    const savedTheme = localStorage.getItem('preferredTheme');
    if (savedTheme) {
        return savedTheme;
    }

    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }

    // Default to dark
    return 'dark';
}

function applyTheme(theme) {
    const html = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = themeToggleBtn?.querySelector('.icon');

    if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        html.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }

    // Save preference
    localStorage.setItem('preferredTheme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function initTheme() {
    const theme = detectTheme();
    applyTheme(theme);

    // Add click handler to theme toggle button
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('preferredTheme')) {
                applyTheme(e.matches ? 'light' : 'dark');
            }
        });
    }
}

// Authentication management
async function checkAuth() {
    const authLoading = document.getElementById('auth-loading');
    const authLogin = document.getElementById('auth-login');
    const authUser = document.getElementById('auth-user');

    authLoading.style.display = 'block';

    try {
        const response = await fetch('/auth/user');
        const data = await response.json();

        if (data.authenticated) {
            // User is logged in
            const avatarImg = document.getElementById('user-avatar');
            const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d4a574"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';

            avatarImg.src = data.user.avatarUrl || defaultAvatar;
            avatarImg.onerror = function () {
                this.src = defaultAvatar;
            };

            // Set user name in dropdown
            document.getElementById('user-name-dropdown').textContent = data.user.displayName;
            authUser.style.display = 'block';

            // Check if user is admin and show admin menu
            checkAdminAccess();

            // Add logout handler
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn && !logoutBtn.hasAttribute('data-listener')) {
                logoutBtn.setAttribute('data-listener', 'true');
                logoutBtn.addEventListener('click', () => {
                    window.location.href = '/auth/logout';
                });
            }
        } else {
            // User is not logged in
            authLogin.style.display = 'block';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        authLogin.style.display = 'block';
    } finally {
        authLoading.style.display = 'none';
    }
}
