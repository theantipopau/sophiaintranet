/**
 * Critical Fixes for Sophia College Systems
 * This file provides essential classes and utilities that must load before other scripts
 */

// Global Error Handler System
class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.isInitialized = false;
        this.ignoredErrors = [
            'Script error',
            'ResizeObserver loop limit exceeded',
            'Non-Error promise rejection captured',
            'Network request failed',
            'Loading chunk',
            'ChunkLoadError'
        ];
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        window.addEventListener('error', (event) => {
            if (this.shouldIgnoreError(event.error || event.message)) return;
            if (this.isCriticalError(event.error)) {
                this.handleError(event.error, 'JavaScript Error', {
                    filename: event.filename,
                    line: event.lineno,
                    column: event.colno
                });
            } else {
                console.warn('⚠️ Non-critical error:', event.error);
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            if (this.shouldIgnoreError(event.reason)) return;
            if (this.isCriticalError(event.reason)) {
                this.handleError(event.reason, 'Unhandled Promise Rejection');
            } else {
                console.warn('⚠️ Non-critical promise rejection:', event.reason);
            }
            event.preventDefault();
        });
    }

    shouldIgnoreError(error) {
        if (!error) return true;
        const errorMessage = error.message || error.toString();
        return this.ignoredErrors.some(ignored =>
            errorMessage.toLowerCase().includes(ignored.toLowerCase())
        );
    }

    isCriticalError(error) {
        if (!error) return false;
        const errorMessage = error.message || error.toString();
        const criticalPatterns = [
            'Permission denied',
            'Authentication failed',
            'Network error',
            'Failed to fetch',
            'CSV parsing failed',
            'Database connection'
        ];
        return criticalPatterns.some(pattern =>
            errorMessage.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    handleError(error, type, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type,
            message: error.message || error,
            stack: error.stack,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        this.logError(errorInfo);
        this.showUserFriendlyError(error, type);
    }

    showUserFriendlyError(error, type = 'Error') {
        const errorMessage = error.message || error.toString();
        let friendlyMessage = 'An error occurred. Please try again.';

        if (errorMessage.toLowerCase().includes('permission denied')) {
            friendlyMessage = 'Access denied. Please check your permissions.';
        } else if (errorMessage.toLowerCase().includes('network')) {
            friendlyMessage = 'Connection problem. Please check your internet and try again.';
        } else if (errorMessage.toLowerCase().includes('fetch')) {
            friendlyMessage = 'Failed to load data. Please refresh the page.';
        } else if (errorMessage.toLowerCase().includes('csv')) {
            friendlyMessage = 'Data loading failed. Please refresh the page.';
        } else if (errorMessage.toLowerCase().includes('authentication')) {
            friendlyMessage = 'Authentication failed. Please try logging in again.';
        }

        if (window.UnifiedToast) {
            window.UnifiedToast.show(friendlyMessage, 'error');
        } else {
            console.error(`${type}: ${friendlyMessage}`);
        }
    }

    logError(errorInfo) {
        console.error('🚨 Error logged:', errorInfo);
        // In a real implementation, you might send this to a logging service
    }

    static async safeAsync(asyncFn, fallback = null, context = 'Operation') {
        try {
            return await asyncFn();
        } catch (error) {
            console.error(`❌ ${context} failed:`, error);
            if (window.ErrorHandler) {
                window.ErrorHandler.showUserFriendlyError(error, context);
            }
            return fallback;
        }
    }

    static safe(fn, fallback = null, context = 'Operation') {
        try {
            return fn();
        } catch (error) {
            console.error(`❌ ${context} failed:`, error);
            if (window.ErrorHandler) {
                window.ErrorHandler.showUserFriendlyError(error, context);
            }
            return fallback;
        }
    }
}

// Unified Toast Notification System
class UnifiedToast {
    constructor() {
        this.toasts = new Map();
        this.maxToasts = 3;
        this.defaultDuration = 4000;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const id = Date.now() + Math.random();
        const toast = this.createToast(id, message, type, duration);
        
        this._limitToasts();
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        
        return id;
    }

    createToast(id, message, type, duration) {
        const colors = {
            success: '#059669',
            error: '#dc2626',
            warning: '#d97706',
            info: '#0284c7'
        };

        const toast = document.createElement('div');
        toast.id = `toast-${id}`;
        toast.style.cssText = `
            background: white;
            border: 1px solid #e2e8f0;
            border-left: 4px solid ${colors[type] || colors.info};
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            word-wrap: break-word;
            transform: translateX(450px);
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        `;

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        messageSpan.style.flex = '1';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            opacity: 0.7;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.onclick = () => this.remove(id);

        toast.appendChild(messageSpan);
        toast.appendChild(closeButton);

        this.toasts.set(id, {
            element: toast,
            type,
            timestamp: Date.now()
        });

        return toast;
    }

    remove(id) {
        const toast = this.toasts.get(id);
        if (!toast) return;

        toast.element.style.transform = 'translateX(450px)';
        toast.element.style.opacity = '0';
        
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.toasts.delete(id);
        }, 300);
    }

    _limitToasts() {
        if (this.toasts.size >= this.maxToasts) {
            const oldest = Array.from(this.toasts.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            this.remove(oldest[0]);
        }
    }

    clear() {
        this.toasts.forEach((_, id) => this.remove(id));
    }

    static show(message, type = 'info', duration = 4000) {
        if (!window.unifiedToastInstance) {
            window.unifiedToastInstance = new UnifiedToast();
        }
        return window.unifiedToastInstance.show(message, type, duration);
    }

    static init() {
        if (!window.unifiedToastInstance) {
            window.unifiedToastInstance = new UnifiedToast();
        }
    }
}

// Unified Form Validator
class UnifiedFormValidator {
    constructor(formId) {
        this.formId = formId;
        this.validators = {};
        this.isReady = false;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('🔧 Setting up form validator for:', this.formId);
        
        this.validators = {
            student: {
                validate: () => {
                    const value = document.getElementById('selectedStudentId')?.value;
                    console.log('🔍 Validating student field, value:', value);
                    return !!value;
                },
                message: 'Please select a student',
                element: 'searchInput'
            },
            reason: {
                validate: () => {
                    const value = document.getElementById('reasonSelect')?.value;
                    console.log('🔍 Validating reason field, value:', value);
                    return !!value;
                },
                message: 'Please select a reason',
                element: 'reasonSelect'
            }
        };
        
        this.setupValidation();
        this.isReady = true;
        
        // Initial validation
        this.validateForm();
    }

    setupValidation() {
        // Real-time validation for all form inputs
        const elements = ['searchInput', 'selectedStudentId', 'reasonSelect'];
        
        elements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                const handler = () => {
                    console.log('🔄 Field changed:', elementId);
                    this.validateForm();
                };
                element.addEventListener('input', handler);
                element.addEventListener('change', handler);
            }
        });
    }

    validateField(key, validator) {
        const isValid = validator.validate();
        const element = document.getElementById(validator.element);
        
        if (element) {
            element.classList.toggle('valid', isValid);
            element.classList.toggle('invalid', !isValid);
            this.updateFieldMessage(validator.element, isValid ? null : validator.message);
        }
        
        console.log(`Field ${key} validation result:`, isValid);
        return isValid;
    }

    validateForm() {
        if (!this.isReady) {
            console.log('⏳ Form validation not ready yet');
            return false;
        }
        
        console.log('🔍 Validating entire form...');
        
        let isFormValid = true;
        
        for (const [key, validator] of Object.entries(this.validators)) {
            const fieldValid = this.validateField(key, validator);
            if (!fieldValid) {
                isFormValid = false;
            }
        }
        
        console.log('📋 Form validation result:', isFormValid);
        this.updateSubmitButton(isFormValid);
        return isFormValid;
    }

    updateFieldMessage(fieldId, message) {
        const messageId = `${fieldId}-validation`;
        let messageElement = document.getElementById(messageId);
        
        if (message) {
            if (!messageElement) {
                messageElement = document.createElement('div');
                messageElement.id = messageId;
                messageElement.className = 'validation-message error';
                
                const field = document.getElementById(fieldId);
                if (field && field.parentNode) {
                    field.parentNode.insertBefore(messageElement, field.nextSibling);
                }
            }
            messageElement.textContent = message;
            messageElement.style.display = 'block';
        } else if (messageElement) {
            messageElement.style.display = 'none';
        }
    }

    updateSubmitButton(isValid) {
        const submitBtn = document.getElementById('logBtn');
        if (!submitBtn) return;
        
        const btnText = submitBtn.querySelector('.btn-text');
        
        if (isValid) {
            submitBtn.disabled = false;
            if (btnText) btnText.textContent = '📝 Log Movement';
            submitBtn.style.background = 'linear-gradient(135deg, var(--accent) 0%, #880000 100%)';
        } else {
            submitBtn.disabled = true;
            if (btnText) btnText.textContent = 'Complete Form to Continue';
            submitBtn.style.background = 'var(--text-muted)';
        }
    }

    addRule(fieldId, validator, message) {
        // For backward compatibility
        console.log('Adding validation rule for:', fieldId);
    }
}

// Performance Optimizer
class PerformanceOptimizer {
    static addCriticalCSS() {
        // Add critical CSS for above-the-fold content
        const criticalCSS = `
            .loading-state { 
                will-change: opacity, transform; 
                backface-visibility: hidden; 
            }
            .nav-bar { 
                will-change: transform; 
                transform: translateZ(0); 
            }
            .card, .section { 
                will-change: transform; 
                backface-visibility: hidden; 
            }
            .fade-in { 
                opacity: 0; 
                animation: fadeIn 0.6s ease forwards; 
            }
            @keyframes fadeIn { 
                to { opacity: 1; } 
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.appendChild(style);
    }

    static debounce(func, wait) {
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

    static throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function(...args) {
            if (!lastRan) {
                func.apply(this, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(this, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    static preloadImages(urls) {
        urls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    static lazy(fn, delay = 100) {
        return setTimeout(fn, delay);
    }
}

// Connection Status Monitor
class ConnectionMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = new Set();
        this.init();
    }

    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notify('online');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notify('offline');
        });
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notify(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status, this.isOnline);
            } catch (error) {
                console.error('Connection listener error:', error);
            }
        });
    }

    getStatus() {
        return {
            online: this.isOnline,
            timestamp: Date.now()
        };
    }
}

// Global utility functions that were referenced in the HTML
window.showToast = function(message, type = 'info', duration = 4000) {
    return UnifiedToast.show(message, type, duration);
};

window.hideToast = function() {
    if (window.unifiedToastInstance) {
        window.unifiedToastInstance.clear();
    }
};

// Initialize global instances
window.ErrorHandler = new ErrorHandler();
window.UnifiedToast = UnifiedToast;
window.PerformanceOptimizer = PerformanceOptimizer;
window.ConnectionMonitor = new ConnectionMonitor();

// Legacy support functions
window.navigateToPage = function(page) {
    window.location.href = page;
};

console.log('✅ Critical fixes loaded successfully');