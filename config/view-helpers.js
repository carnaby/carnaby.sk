/**
 * View Helpers & Constants for EJS Rendering
 */

const translations = {
    en: {
        navAbout: "About",
        navDev: "DevLog",
        navMusic: "Music",
        btnContact: "Contact",
        aboutLabel: "ABOUT ME",
        aboutIntro: "The world of coding and the world of music are closer than they seem. Both are about finding harmony, logic, and rhythm. My journey began behind a mixing console and at rock radio Rebeca, but today it is defined by lines of code and the possibilities of artificial intelligence.",
        aboutIntro2: "As a full-stack developer, I build digital solutions, while as a music enthusiast, I seek space for true human emotion within technology.",
        descDevLog: "Here I step out civilly as Jozef. I write about developing in React and TypeScript, taming AI models, and the 'making of' this web. A space for experiments and a peek behind the scenes of my work with Antigravity technology.",
        descDodo: "Dodo is my quieter, more deliberate side. Music for peaceful mornings and long car rides. Acoustic folk, ballads, and storytelling Americana about hope, missed trains, and unexpected joy.",
        descCarnaby: "A return to DJ roots. Pure energy, carefree euro-disco, and the neon atmosphere of the 80s. While Dodo tells stories, Carnaby creates a vibe. Dance rhythm and retro nostalgia.",
        aiMusicNote: "Music: AI (Suno)",
        humanLyricsNote: "Lyrics & Stories: Human (Original)",
        footerGithub: "GitHub",
        footerYoutube: "YouTube",
        readMore: "Read More"
    },
    sk: {
        navAbout: "O mne",
        navDev: "DevLog",
        navMusic: "Hudba",
        btnContact: "Kontakt",
        aboutLabel: "O MNE",
        aboutIntro: "Svet kódovania a svet hudby majú k sebe bližšie, než sa na prvý pohľad zdá. Obe sú o hľadaní harmónie, logiky a rytmu. Moja cesta začala za mixpultom a v rockovom rádiu Rebeca, no dnes ju definujú riadky kódu a možnosti umelej inteligencie.",
        aboutIntro2: "Ako full-stack vývojár staviam digitálne riešenia, zatiaľ čo ako nadšenec do hudby hľadám v technológiách priestor pre skutočnú ľudskú emóciu.",
        descDevLog: "Tu vystupujem civilne ako Jozef. Píšem o tom, ako vyvíjam v Reacte a TypeScripte, ako krotím AI modely a čo všetko obnáša 'making of' tohto webu. Priestor pre experimenty a pohľad do zákulisia mojej práce s technológiou Antigravity.",
        descDodo: "Dodo je moja tichšia, rozvážnejšia stránka. Hudba pre pokojné rána a dlhé cesty autom. Akustický folk, balady a storytellingová Americana o nádeji, zmeškaných vlakoch a nečakanej radosti.",
        descCarnaby: "Návrat k DJ koreňom. Čistá energia, bezstarostné euro-disco a neónová atmosféra 80. rokov. Kým Dodo rozpráva príbehy, Carnaby vytvára vibe. Tanečný rytmus a retro nostalgia.",
        aiMusicNote: "Hudba: AI (Suno)",
        humanLyricsNote: "Texty & Príbehy: Human (Original)",
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
        slug: "devlog",
        desc: {
            sk: "Tech svet, kódovanie, experimenty s AI a 'making of' tohto webu.",
            en: "Tech world, coding, AI experiments, and the 'making of' this site."
        }
    },
    'dodo': {
        title: "Dodo",
        icon: "lucide:guitar",
        color: "var(--amber)",
        slug: "dodo",
        desc: {
            sk: "Akustický folk, storyteller balady a južanský rock.",
            en: "Acoustic folk, storyteller ballads, and southern rock."
        }
    },
    'carnaby': {
        title: "Carnaby",
        icon: "lucide:music-2",
        color: "var(--purple)",
        slug: "carnaby",
        desc: {
            sk: "Retro synth-pop a bezstarostné euro-disco.",
            en: "Retro synth-pop and carefree euro-disco."
        }
    },
    'uncategorized': {
        title: "Other",
        icon: "lucide:hash",
        color: "var(--text-primary)",
        slug: "uncategorized",
        desc: { sk: "", en: "" }
    }
};

module.exports = {
    translations,
    categoryMeta
};
