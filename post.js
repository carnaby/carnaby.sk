/**
 * Post Detail Page Logic
 */

// Make loadPostDetail available globally for language switcher
window.loadPosts = loadPostDetail;

document.addEventListener('DOMContentLoaded', () => {
    loadPostDetail();
});

async function loadPostDetail() {
    // Get slug from URL
    const pathname = window.location.pathname;
    const slug = pathname.split('/').pop();

    if (!slug) {
        showError();
        return;
    }

    // Get current language
    const currentLang = localStorage.getItem('preferredLanguage') || 'sk';

    try {
        const response = await fetch(`/api/posts/${slug}?language=${currentLang}`);
        const result = await response.json();

        if (!result.success || !result.data) {
            throw new Error('Post not found');
        }

        renderPost(result.data);
    } catch (error) {
        console.error('Error loading post:', error);
        showError();
    }
}

function renderPost(post) {
    // Hide skeleton, show content
    document.getElementById('loading-skeleton').style.display = 'none';
    document.getElementById('post-content-wrapper').style.display = 'block';

    // Update Page Title
    document.title = `${post.title} - Dodo`;

    // Date
    const currentLang = localStorage.getItem('preferredLanguage') || 'sk';
    const date = new Date(post.published_at || post.created_at);
    document.getElementById('post-date').textContent = date.toLocaleDateString(currentLang === 'sk' ? 'sk-SK' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Category & Header Logic
    const categoryBadge = document.getElementById('category-badge');
    const backToCatBtn = document.getElementById('back-to-category');
    const footerBackBtn = document.getElementById('footer-back-to-category');

    // Default icons map
    const catIcons = {
        'devlog': 'lucide:code-2',
        'dodo': 'lucide:music',
        'carnaby': 'lucide:disc-2'
    };

    // Default colors map (for inline styles or classes)
    const catColors = {
        'devlog': 'var(--emerald)',
        'dodo': 'var(--amber)',
        'carnaby': 'var(--purple)'
    };

    if (post.categories && post.categories.length > 0) {
        const cat = post.categories[0];
        const slug = (cat.slug || cat.name).toLowerCase();

        // Setup Category Badge
        const icon = catIcons[slug] || 'lucide:folder';
        const color = catColors[slug] || 'var(--text-primary)';

        categoryBadge.innerHTML = `<iconify-icon icon="${icon}"></iconify-icon> ${cat.name}`;
        categoryBadge.href = `/category/${slug}`;
        categoryBadge.style.borderColor = color;
        categoryBadge.style.color = color;
        // Add subtle background tint
        categoryBadge.style.background = `color-mix(in srgb, ${color} 10%, transparent)`;

        // Setup Back to Category Button (Top)
        backToCatBtn.href = `/category/${slug}`;
        backToCatBtn.style.display = 'flex'; // show it
        backToCatBtn.style.color = color;
        backToCatBtn.style.borderColor = `color-mix(in srgb, ${color} 30%, transparent)`;

        // Setup Back to Category Button (Footer)
        if (footerBackBtn) {
            footerBackBtn.href = `/category/${slug}`;
            footerBackBtn.style.display = 'flex';
            footerBackBtn.style.color = color;
            footerBackBtn.style.borderColor = `color-mix(in srgb, ${color} 30%, transparent)`;
        }

    } else {
        categoryBadge.style.display = 'none';
        backToCatBtn.style.display = 'none';
        if (footerBackBtn) footerBackBtn.style.display = 'none';
    }

    // Post Title (now separate h1)
    document.getElementById('post-title').textContent = post.title;

    // Media (YouTube or Image)
    const mediaContainer = document.getElementById('post-media');
    if (post.youtube_id) {
        mediaContainer.innerHTML = `
            <div class="video-container">
                <iframe 
                    src="https://www.youtube.com/embed/${post.youtube_id}?autoplay=1" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
        `;
    } else if (post.thumbnail_path) {
        const originalFilename = post.thumbnail_path.split('/').pop();
        mediaContainer.innerHTML = `
            <img 
                src="/images/1200/${originalFilename}" 
                alt="${post.title}"
                onerror="this.onerror=null;this.src='/thumbnails/originals/${originalFilename}'"
            >
        `;
    } else {
        mediaContainer.style.display = 'none';
    }

    // Body Content (Markdown -> HTML)
    const contentDiv = document.getElementById('post-body');
    if (post.content) {
        contentDiv.innerHTML = marked.parse(post.content);
    } else if (post.excerpt) {
        contentDiv.innerHTML = `<p>${post.excerpt}</p>`;
    } else {
        contentDiv.innerHTML = '<p><em>Tento príspevok zatiaľ nemá text.</em></p>';
    }


}

function showError() {
    document.getElementById('loading-skeleton').style.display = 'none';
    document.getElementById('post-content-wrapper').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
}
