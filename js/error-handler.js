/**
 * Error Handler Module
 * Centralized error handling, logging, and user feedback
 */

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    
    // Setup global error handlers
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        severity: 'error'
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        severity: 'error'
      });
    });

    // Catch network errors
    window.addEventListener('offline', () => {
      this.handleError({
        type: 'network',
        message: 'Network connection lost',
        severity: 'warning',
        userMessage: 'You appear to be offline. Some features may not work properly.'
      });
    });

    window.addEventListener('online', () => {
      if (window.uiManager) {
        window.uiManager.showToast('Connection restored', 'success');
      }
    });
  }

  // Main error handling method
  handleError(errorInfo) {
    const error = this.normalizeError(errorInfo);
    
    // Log the error
    this.logError(error);
    
    // Determine user feedback based on severity
    this.provideUserFeedback(error);
    
    // Attempt recovery if possible
    this.attemptRecovery(error);
    
    // Report to external service if configured
    this.reportError(error);
    
    return error;
  }

  normalizeError(errorInfo) {
    const timestamp = new Date().toISOString();
    const userAgent = navigator.userAgent;
    const url = window.location.href;
    
    // Handle different error types
    if (errorInfo instanceof Error) {
      return {
        id: this.generateErrorId(),
        timestamp,
        type: 'javascript',
        message: errorInfo.message,
        stack: errorInfo.stack,
        severity: 'error',
        userAgent,
        url,
        userMessage: 'An unexpected error occurred. Please try again.'
      };
    }
    
    if (typeof errorInfo === 'string') {
      return {
        id: this.generateErrorId(),
        timestamp,
        type: 'custom',
        message: errorInfo,
        severity: 'error',
        userAgent,
        url,
        userMessage: errorInfo
      };
    }
    
    // Already normalized error object
    return {
      id: this.generateErrorId(),
      timestamp,
      userAgent,
      url,
      userMessage: 'An error occurred. Please try again.',
      ...errorInfo
    };
  }

  logError(error) {
    // Add to internal log
    this.errorLog.unshift(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
    
    // Console logging with appropriate level
    const logMethod = {
      'error': 'error',
      'warning': 'warn',
      'info': 'info'
    }[error.severity] || 'error';
    
    console[logMethod](`[${error.type.toUpperCase()}] ${error.message}`, error);
    
    // Store in localStorage for persistence
    try {
      const storedErrors = JSON.parse(localStorage.getItem('errorLog') || '[]');
      storedErrors.unshift({
        ...error,
        stack: undefined // Don't store stack traces in localStorage
      });
      localStorage.setItem('errorLog', JSON.stringify(storedErrors.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }
  }

  provideUserFeedback(error) {
    if (!window.uiManager) return;
    
    const { severity, userMessage, type } = error;
    
    // Don't show user feedback for certain error types
    if (type === 'network' && severity === 'info') return;
    
    // Map severity to toast type
    const toastType = {
      'error': 'error',
      'warning': 'warning',
      'info': 'info'
    }[severity] || 'error';
    
    // Show appropriate message
    const message = userMessage || this.getGenericMessage(type, severity);
    const duration = severity === 'error' ? 8000 : 5000;
    
    window.uiManager.showToast(message, toastType, duration);
  }

  getGenericMessage(type, severity) {
    const messages = {
      javascript: {
        error: 'A technical error occurred. Please refresh the page and try again.',
        warning: 'Something unexpected happened, but you can continue.',
        info: 'Operation completed with minor issues.'
      },
      network: {
        error: 'Network error. Please check your connection and try again.',
        warning: 'Slow network detected. Some features may be delayed.',
        info: 'Network operation completed.'
      },
      firebase: {
        error: 'Database error. Please try again in a moment.',
        warning: 'Database operation took longer than expected.',
        info: 'Database operation completed.'
      },
      validation: {
        error: 'Please check your input and try again.',
        warning: 'Some fields need attention.',
        info: 'Validation completed.'
      }
    };
    
    return messages[type]?.[severity] || 'An error occurred. Please try again.';
  }

  attemptRecovery(error) {
    const { type, context } = error;
    
    switch (type) {
      case 'network':
        this.attemptNetworkRecovery(error);
        break;
      case 'firebase':
        this.attemptFirebaseRecovery(error);
        break;
      case 'validation':
        this.attemptValidationRecovery(error);
        break;
    }
  }

  attemptNetworkRecovery(error) {
    // Retry network operations with exponential backoff
    if (error.context?.retryable && error.context?.operation) {
      const attemptKey = `${error.type}_${error.context.operation}`;
      const attempts = this.retryAttempts.get(attemptKey) || 0;
      
      if (attempts < this.maxRetries) {
        this.retryAttempts.set(attemptKey, attempts + 1);
        
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
        
        setTimeout(() => {
          console.log(`🔄 Retrying ${error.context.operation} (attempt ${attempts + 1})`);
          error.context.retryFunction?.();
        }, delay);
      }
    }
  }

  attemptFirebaseRecovery(error) {
    // Handle Firebase-specific errors
    if (error.code === 'permission-denied') {
      // Redirect to login if needed
      if (window.location.pathname !== '/index.html') {
        window.location.href = 'index.html';
      }
    }
  }

  attemptValidationRecovery(error) {
    // Focus on the problematic field if available
    if (error.context?.fieldId) {
      const field = document.getElementById(error.context.fieldId);
      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  reportError(error) {
    // Only report errors in production
    if (window.location.hostname === 'localhost') return;
    
    // Don't report certain error types
    if (error.type === 'network' || error.severity === 'info') return;
    
    // Prepare error report
    const report = {
      id: error.id,
      timestamp: error.timestamp,
      type: error.type,
      message: error.message,
      severity: error.severity,
      url: error.url,
      userAgent: error.userAgent,
      stack: error.stack?.substring(0, 1000), // Limit stack trace size
      context: error.context
    };
    
    // Send to error reporting service (implement as needed)
    this.sendErrorReport(report);
  }

  async sendErrorReport(report) {
    try {
      // Example: Send to Firebase or external service
      if (window.db) {
        await window.db.collection('errorReports').add(report);
      }
    } catch (e) {
      console.warn('Failed to send error report:', e);
    }
  }

  // Utility methods
  generateErrorId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Public API methods
  createError(type, message, context = {}) {
    return this.handleError({
      type,
      message,
      severity: 'error',
      context,
      userMessage: message
    });
  }

  createWarning(type, message, context = {}) {
    return this.handleError({
      type,
      message,
      severity: 'warning',
      context,
      userMessage: message
    });
  }

  createInfo(type, message, context = {}) {
    return this.handleError({
      type,
      message,
      severity: 'info',
      context,
      userMessage: message
    });
  }

  // Wrapper for async operations with error handling
  async withErrorHandling(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      this.handleError({
        ...error,
        context: {
          ...context,
          retryable: context.retryable || false,
          retryFunction: context.retryFunction
        }
      });
      throw error;
    }
  }

  // Get error statistics
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recent: this.errorLog.slice(0, 10)
    };
    
    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });
    
    return stats;
  }

  // Clear error log
  clearErrorLog() {
    this.errorLog = [];
    this.retryAttempts.clear();
    localStorage.removeItem('errorLog');
  }

  // Export error log
  exportErrorLog() {
    const data = {
      timestamp: new Date().toISOString(),
      errors: this.errorLog,
      stats: this.getErrorStats()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

// Export for global use
window.ErrorHandler = ErrorHandler;
