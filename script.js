// Language translations
const translations = {
    en: {
        // Navigation
        navAbout: "About",
        navSongs: "Songs",

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
        songsTitle: "Songs",
        songsSubtitle: "If you're looking for music that doesn't push anywhere and allows you to be quiet, you're in the right place.",

        // CTA
        ctaButton: "See more on YouTube",

        // Footer
        footerCopyright: "© 2025 Dodo – Songs for the Journey",
        aiExperiment: "🤖 This website is an AI experiment created using",
        aiAnd: "&",
        themeToggle: "Toggle theme"
    },
    sk: {
        // Navigation
        navAbout: "O mne",
        navSongs: "Piesne",

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
        songsTitle: "Piesne",
        songsSubtitle: "Ak hľadáš hudbu, ktorá nikam netlačí a dovolí ti byť ticho, si na správnom mieste.",

        // CTA
        ctaButton: "Pozri viac na YouTube",

        // Footer
        footerCopyright: "© 2025 Dodo – Songs for the Journey",
        aiExperiment: "🤖 Tento web je AI experiment vytvorený pomocou",
        aiAnd: "&",
        themeToggle: "Prepnúť tému"
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

    // Initialize theme
    initTheme();
});

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
