// Document ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize navigation
    initNavigation();
    
    // Initialize sidebar
    initSidebar();
    
    // Initialize endpoints
    initEndpoints();
    
    // Initialize copy buttons
    initCopyButtons();
    
    // Initialize smooth scrolling
    initSmoothScrolling();
    
    // Initialize responsive features
    initResponsive();
    
    // Initialize search functionality
    initSearch();
    
    // Initialize tooltips
    initTooltips();
}

// Navigation functionality
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    
    // Update active nav link on scroll
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
    
    // Handle nav link clicks
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Sidebar functionality
function initSidebar() {
    const sidebarLinks = document.querySelectorAll('.sidebar a');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Close sidebar on mobile
                if (window.innerWidth <= 1024) {
                    document.querySelector('.sidebar').classList.remove('active');
                }
            }
        });
    });
}

// Endpoint expansion functionality
function initEndpoints() {
    const endpoints = document.querySelectorAll('.endpoint');
    
    endpoints.forEach(endpoint => {
        const header = endpoint.querySelector('.endpoint-header');
        
        header.addEventListener('click', () => {
            // Toggle current endpoint
            endpoint.classList.toggle('active');
            
            // Close other endpoints (optional - for accordion behavior)
            // endpoints.forEach(otherEndpoint => {
            //     if (otherEndpoint !== endpoint) {
            //         otherEndpoint.classList.remove('active');
            //     }
            // });
        });
    });
    
    // Auto-expand first endpoint in each group
    const apiGroups = document.querySelectorAll('.api-group');
    apiGroups.forEach(group => {
        const firstEndpoint = group.querySelector('.endpoint');
        if (firstEndpoint) {
            firstEndpoint.classList.add('active');
        }
    });
}

// Copy to clipboard functionality
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            copyCode(button);
        });
    });
}

function copyCode(button) {
    const codeContainer = button.closest('.code-container') || button.closest('.code-block');
    const code = codeContainer.querySelector('code, pre');
    const text = code.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('success');
        
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.classList.remove('success');
        }, 1500);
        
        // Show toast notification
        showToast('Code copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy code', 'error');
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy', 'error');
    });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 100; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Responsive functionality
function initResponsive() {
    const navToggle = document.querySelector('.nav-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !navToggle.contains(e.target)) {
                sidebar.classList.remove('active');
                navToggle.classList.remove('active');
            }
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('active');
            navToggle.classList.remove('active');
        }
    });
}

// Search functionality
function initSearch() {
    // Create search input
    const searchContainer = createSearchContainer();
    const navbar = document.querySelector('.nav-container');
    
    if (navbar && searchContainer) {
        navbar.insertBefore(searchContainer, navbar.querySelector('.nav-links'));
    }
}

function createSearchContainer() {
    const container = document.createElement('div');
    container.className = 'search-container';
    container.innerHTML = `
        <div class="search-input-wrapper">
            <input type="text" class="search-input" placeholder="Search documentation...">
            <i class="fas fa-search search-icon"></i>
            <div class="search-results"></div>
        </div>
    `;
    
    const searchInput = container.querySelector('.search-input');
    const searchResults = container.querySelector('.search-results');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length > 2) {
            performSearch(query, searchResults);
        } else {
            searchResults.style.display = 'none';
        }
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    return container;
}

function performSearch(query, resultsContainer) {
    const searchableElements = [
        ...document.querySelectorAll('h1, h2, h3, h4, .endpoint-header, .path, .description'),
        ...document.querySelectorAll('.api-group-title, .card-header h3')
    ];
    
    const results = [];
    
    searchableElements.forEach(element => {
        const text = element.textContent.toLowerCase();
        if (text.includes(query)) {
            const section = element.closest('.section, .api-group, .endpoint');
            if (section) {
                const id = section.id || element.id;
                const title = element.textContent.trim();
                const type = getElementType(element);
                
                if (id && !results.find(r => r.id === id)) {
                    results.push({ id, title, type, element });
                }
            }
        }
    });
    
    displaySearchResults(results, resultsContainer);
}

function getElementType(element) {
    if (element.classList.contains('endpoint-header')) return 'Endpoint';
    if (element.classList.contains('api-group-title')) return 'API Group';
    if (element.tagName === 'H2') return 'Section';
    if (element.tagName === 'H3') return 'Subsection';
    return 'Content';
}

function displaySearchResults(results, container) {
    if (results.length === 0) {
        container.innerHTML = '<div class="search-no-results">No results found</div>';
    } else {
        container.innerHTML = results.map(result => `
            <div class="search-result-item" onclick="navigateToResult('${result.id}')">
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-type">${result.type}</div>
            </div>
        `).join('');
    }
    
    container.style.display = 'block';
}

function navigateToResult(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Hide search results
        document.querySelector('.search-results').style.display = 'none';
        
        // Clear search input
        document.querySelector('.search-input').value = '';
        
        // Highlight the element briefly
        element.style.background = 'rgba(59, 130, 246, 0.1)';
        setTimeout(() => {
            element.style.background = '';
        }, 2000);
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Initialize tooltips
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(e) {
    const text = e.target.getAttribute('data-tooltip');
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    
    setTimeout(() => tooltip.classList.add('show'), 10);
}

function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
        setTimeout(() => document.body.removeChild(tooltip), 200);
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Add search styles
const searchStyles = `
.search-container {
    position: relative;
    margin: 0 1rem;
}

.search-input-wrapper {
    position: relative;
}

.search-input {
    width: 300px;
    padding: 0.5rem 1rem 0.5rem 2.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--background-color);
    font-size: 0.875rem;
    transition: all 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.875rem;
}

.search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    display: none;
}

.search-result-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.2s ease;
}

.search-result-item:hover {
    background: var(--background-color);
}

.search-result-item:last-child {
    border-bottom: none;
}

.search-result-title {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.search-result-type {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.search-no-results {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
}

.toast {
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
}

.toast.show {
    transform: translateX(0);
}

.toast-content {
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.toast-success {
    border-left: 4px solid var(--success-color);
}

.toast-error {
    border-left: 4px solid var(--error-color);
}

.toast-warning {
    border-left: 4px solid var(--warning-color);
}

.toast-info {
    border-left: 4px solid var(--primary-color);
}

.tooltip {
    position: absolute;
    background: var(--text-primary);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    z-index: 10000;
    opacity: 0;
    transform: translateY(5px);
    transition: all 0.2s ease;
    pointer-events: none;
}

.tooltip.show {
    opacity: 1;
    transform: translateY(0);
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--text-primary);
}

@media (max-width: 768px) {
    .search-input {
        width: 200px;
    }
    
    .search-container {
        margin: 0 0.5rem;
    }
    
    .toast {
        right: 1rem;
        left: 1rem;
        top: 1rem;
    }
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = searchStyles;
document.head.appendChild(styleSheet);

// Export functions for global use
window.copyCode = copyCode;
window.copyToClipboard = copyToClipboard;
window.navigateToResult = navigateToResult;