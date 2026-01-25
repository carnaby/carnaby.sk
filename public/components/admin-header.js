class AdminHeader extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const title = this.getAttribute('title') || 'Administrácia';
        const icon = this.getAttribute('icon') || '⚙️';
        const backLink = this.getAttribute('back-href'); // If null, defaults to /admin behavior or hidden? 
        // User logic: "Back" should be present everywhere except Dashboard (where it is Web).
        // Actually user said: "v pravo tlacitka spet(okrem dashboardu tam bude len web)"

        // Let's make it flexible.
        // back-href: URL for "Späť" button.
        // show-web: Boolean to show "Web" button.

        const showWeb = this.hasAttribute('show-web');
        const showBack = this.hasAttribute('back-href');
        const backText = this.getAttribute('back-text') || 'Späť';

        this.innerHTML = `
            <div class="admin-header-component">
                <div class="header-left">
                    <h1>${icon} ${title}</h1>
                </div>
                <div class="header-right">
                    <div class="header-nav">
                        ${showBack ? `<a href="${this.getAttribute('back-href')}" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> ${backText}</a>` : ''}
                        ${showWeb ? `<a href="/" class="btn btn-secondary"><i class="fas fa-external-link-alt"></i> Web</a>` : ''}
                    </div>
                    <div class="header-actions">
                        <!-- Custom actions injected here -->
                    </div>
                </div>
            </div>
        `;

        // Move children (buttons) into .header-actions
        // This is a "Light DOM" approach so styles work easily
        // We verify if there are children to move
        const actionsContainer = this.querySelector('.header-actions');

        // We need to capture original children before overwriting innerHTML?
        // Wait, current implementation overwrites innerHTML immediately.
        // Standard WebComponent pattern:
        // Use Shadow DOM with <slot> OR don't overwrite formatting if slots aren't used.
        // But for Light DOM "slotting", we can just act as a wrapper.
        // Let's use a simpler approach: The user writes the buttons INSIDE the tag, and we wrap headers AROUND them.
    }
}

// Improved implementation preserving content:
class AdminHeaderV2 extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || 'Administrácia';
        const icon = this.getAttribute('icon') || '⚙️';
        const backHref = this.getAttribute('back-href');
        const webBtn = this.hasAttribute('web-btn'); // Attribute to show Web button

        // Save existing children (action buttons)
        const children = Array.from(this.childNodes);

        // Clear and rebuild
        this.innerHTML = `
            <div class="admin-header-container">
                <div class="header-left">
                    <h1><span class="header-icon">${icon}</span> ${title}</h1>
                </div>
                <div class="header-right">
                    ${backHref ? `<a href="${backHref}" class="btn btn-secondary btn-back"><i class="fas fa-arrow-left"></i> Späť</a>` : ''}
                    ${webBtn ? `<a href="/" class="btn btn-secondary btn-web"><i class="fas fa-globe"></i> Web</a>` : ''}
                    <div class="header-custom-actions"></div>
                </div>
            </div>
        `;

        // Re-append custom buttons
        const customActions = this.querySelector('.header-custom-actions');
        children.forEach(child => customActions.appendChild(child));

        // Apply styles to host to ensure block display, but let CSS handle the rest
        this.style.display = 'block';
    }
}

customElements.define('admin-header', AdminHeaderV2);
