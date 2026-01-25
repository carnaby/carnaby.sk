/**
 * Post Detail Page Logic
 */

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

    try {
        const response = await fetch(`/api/posts/${slug}`);
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

    // Update Meta Description
    if (post.meta_description || post.excerpt) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = post.meta_description || post.excerpt;
    }

    // Set Content
    document.getElementById('post-title').textContent = post.title;

    // Date
    const date = new Date(post.published_at || post.created_at);
    document.getElementById('post-date').textContent = date.toLocaleDateString('sk-SK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Category
    const categorySpan = document.getElementById('post-category');
    if (post.categories && post.categories.length > 0) {
        categorySpan.textContent = post.categories[0].name;
    } else {
        categorySpan.style.display = 'none';
    }

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
