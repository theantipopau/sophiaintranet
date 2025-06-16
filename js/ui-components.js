/**
 * UI Components Module
 * Handles all user interface interactions, form validation, and visual feedback
 */

class UIManager {
  constructor() {
    this.toastQueue = [];
    this.loadingStates = new Set();
    this.validationRules = new Map();
    this.debounceTimers = new Map();
  }

  // Enhanced toast notifications with queue management
  showToast(message, type = 'success', duration = 5000, priority = 'normal') {
    const toast = {
      id: Date.now() + Math.random(),
      message,
      type,
      duration,
      priority
    };

    if (priority === 'high') {
      this.toastQueue.unshift(toast);
    } else {
      this.toastQueue.push(toast);
    }

    this._processToastQueue();
  }

  _processToastQueue() {
    if (this.toastQueue.length === 0) return;

    const currentToast = document.getElementById('toast');
    if (currentToast.classList.contains('show')) {
      // Wait for current toast to finish
      setTimeout(() => this._processToastQueue(), 1000);
      return;
    }

    const toast = this.toastQueue.shift();
    this._displayToast(toast);
  }

  _displayToast(toast) {
    const toastElement = document.getElementById('toast');
    if (!toastElement) return;

    toastElement.textContent = toast.message;
    toastElement.className = `toast ${toast.type} show`;

    setTimeout(() => {
      toastElement.classList.remove('show');
      setTimeout(() => this._processToastQueue(), 300);
    }, toast.duration);
  }

  // Enhanced loading states with progress tracking
  showLoading(elementId, message = 'Loading...', showProgress = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    this.loadingStates.add(elementId);

    const loadingHTML = `
      <div class="loading-container" data-loading="${elementId}">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
        ${showProgress ? '<div class="loading-progress"><div class="loading-progress-bar"></div></div>' : ''}
      </div>
    `;

    element.innerHTML = loadingHTML;
    element.classList.add('loading-state');
  }

  updateLoadingProgress(elementId, progress, message = null) {
    const container = document.querySelector(`[data-loading="${elementId}"]`);
    if (!container) return;

    const progressBar = container.querySelector('.loading-progress-bar');
    const messageElement = container.querySelector('.loading-message');

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    if (message && messageElement) {
      messageElement.textContent = message;
    }
  }

  hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    this.loadingStates.delete(elementId);
    element.classList.remove('loading-state');

    const loadingContainer = element.querySelector(`[data-loading="${elementId}"]`);
    if (loadingContainer) {
      loadingContainer.remove();
    }
  }

  // Enhanced form validation with real-time feedback
  setupFormValidation(formId, rules) {
    const form = document.getElementById(formId);
    if (!form) return;

    this.validationRules.set(formId, rules);

    // Add real-time validation listeners
    Object.keys(rules).forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
      if (!field) return;

      // Debounced validation on input
      field.addEventListener('input', () => {
        this._debounce(`validate_${fieldName}`, () => {
          this.validateField(fieldName, field.value, rules[fieldName]);
        }, 300);
      });

      // Immediate validation on blur
      field.addEventListener('blur', () => {
        this.validateField(fieldName, field.value, rules[fieldName]);
      });
    });

    // Form submission validation
    form.addEventListener('submit', (e) => {
      if (!this.validateForm(formId)) {
        e.preventDefault();
        this.showToast('Please fix the errors before submitting', 'error');
      }
    });
  }

  validateField(fieldName, value, rules) {
    const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (!field) return true;

    const errors = [];

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      errors.push('This field is required');
    }

    // Length validation
    if (value && rules.minLength && value.length < rules.minLength) {
      errors.push(`Minimum ${rules.minLength} characters required`);
    }

    if (value && rules.maxLength && value.length > rules.maxLength) {
      errors.push(`Maximum ${rules.maxLength} characters allowed`);
    }

    // Pattern validation
    if (value && rules.pattern && !rules.pattern.test(value)) {
      errors.push(rules.patternMessage || 'Invalid format');
    }

    // Custom validation
    if (value && rules.custom) {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push(customResult);
      }
    }

    this._displayFieldValidation(field, errors);
    return errors.length === 0;
  }

  validateForm(formId) {
    const rules = this.validationRules.get(formId);
    if (!rules) return true;

    let isValid = true;

    Object.keys(rules).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
      if (field) {
        const fieldValid = this.validateField(fieldName, field.value, rules[fieldName]);
        if (!fieldValid) isValid = false;
      }
    });

    return isValid;
  }

  _displayFieldValidation(field, errors) {
    // Remove existing validation
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }

    field.classList.remove('field-valid', 'field-invalid');

    if (errors.length > 0) {
      field.classList.add('field-invalid');
      
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = errors[0]; // Show first error
      field.parentNode.appendChild(errorElement);
    } else if (field.value.trim()) {
      field.classList.add('field-valid');
    }
  }

  // Enhanced modal management
  createModal(options) {
    const {
      id,
      title,
      content,
      size = 'medium',
      closable = true,
      actions = []
    } = options;

    // Remove existing modal with same ID
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = id;

    const sizeClass = {
      small: 'modal-sm',
      medium: 'modal-md',
      large: 'modal-lg',
      fullscreen: 'modal-fullscreen'
    }[size] || 'modal-md';

    modal.innerHTML = `
      <div class="modal-content ${sizeClass}">
        <div class="modal-header">
          <h3>${title}</h3>
          ${closable ? `<button class="modal-close" onclick="window.uiManager.closeModal('${id}')">&times;</button>` : ''}
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${actions.length > 0 ? `
          <div class="modal-footer">
            ${actions.map(action => `
              <button class="btn ${action.class || 'btn-secondary'}" 
                      onclick="${action.onclick || ''}"
                      ${action.disabled ? 'disabled' : ''}>
                ${action.text}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(modal);

    // Add escape key listener
    if (closable) {
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeModal(id);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }

    return modal;
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.remove();
    }
  }

  // Enhanced table management with sorting and filtering
  createDataTable(containerId, data, columns, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
      sortable = true,
      filterable = true,
      paginated = true,
      pageSize = 25,
      searchable = true
    } = options;

    let currentData = [...data];
    let currentPage = 1;
    let sortColumn = null;
    let sortDirection = 'asc';

    const tableHTML = `
      <div class="data-table-container">
        ${searchable ? `
          <div class="data-table-controls">
            <input type="text" class="data-table-search" placeholder="Search..." />
            <span class="data-table-count">Showing ${currentData.length} items</span>
          </div>
        ` : ''}
        
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th ${sortable ? `class="sortable" onclick="window.uiManager.sortTable('${containerId}', '${col.key}')"` : ''}>
                    ${col.title}
                    ${sortable ? '<span class="sort-indicator"></span>' : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="data-table-body">
            </tbody>
          </table>
        </div>
        
        ${paginated ? `
          <div class="data-table-pagination">
            <button class="btn btn-secondary" onclick="window.uiManager.changePage('${containerId}', -1)">Previous</button>
            <span class="pagination-info">Page 1</span>
            <button class="btn btn-secondary" onclick="window.uiManager.changePage('${containerId}', 1)">Next</button>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = tableHTML;

    // Store table data and config
    container._tableData = {
      originalData: data,
      currentData,
      columns,
      options,
      currentPage,
      sortColumn,
      sortDirection,
      pageSize
    };

    // Setup search if enabled
    if (searchable) {
      const searchInput = container.querySelector('.data-table-search');
      searchInput.addEventListener('input', () => {
        this._debounce(`search_${containerId}`, () => {
          this.filterTable(containerId, searchInput.value);
        }, 300);
      });
    }

    this.renderTableData(containerId);
  }

  renderTableData(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._tableData) return;

    const { currentData, columns, options, currentPage, pageSize } = container._tableData;
    const tbody = container.querySelector('.data-table-body');
    const countElement = container.querySelector('.data-table-count');
    const paginationInfo = container.querySelector('.pagination-info');

    // Calculate pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = options.paginated ? startIndex + pageSize : currentData.length;
    const pageData = currentData.slice(startIndex, endIndex);

    // Render rows
    tbody.innerHTML = pageData.map(row => `
      <tr>
        ${columns.map(col => `
          <td>${col.render ? col.render(row[col.key], row) : (row[col.key] || '')}</td>
        `).join('')}
      </tr>
    `).join('');

    // Update count and pagination
    if (countElement) {
      countElement.textContent = `Showing ${currentData.length} items`;
    }

    if (paginationInfo) {
      const totalPages = Math.ceil(currentData.length / pageSize);
      paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
  }

  // Utility methods
  _debounce(key, func, delay) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      func();
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  // Accessibility helpers
  announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  // Focus management
  trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    });

    firstElement.focus();
  }
}

// Export for global use
window.UIManager = UIManager;
