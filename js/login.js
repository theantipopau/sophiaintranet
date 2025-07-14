'use strict';

// ===== ENHANCED ERROR HANDLING SYSTEM =====
class GlobalErrorHandler {
      constructor() { 
        this.errorLog = []; 
        this.maxLogSize = 50; 
        this.ignoredErrors = [
          'ResizeObserver loop limit exceeded', 
          'Script error', 
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
        this.showUserFriendlyError(errorInfo); 
      }
      
      showUserFriendlyError(errorInfo) { 
        const friendlyMessages = { 
          'permission denied': 'Access denied. Please check your permissions.', 
          'network': 'Connection problem. Please check your internet and try again.', 
          'fetch': 'Failed to load data. Please refresh the page.', 
          'csv': 'Data loading failed. Please refresh the page.', 
          'authentication': 'Authentication failed. Please try logging in again.' 
        }; 
        
        const messageKey = Object.keys(friendlyMessages).find(key => 
          errorInfo.message.toLowerCase().includes(key)
        ); 
        const userMessage = messageKey ? friendlyMessages[messageKey] : 
          'A system error occurred. Please refresh the page if the problem persists.'; 
        
        this.showErrorToast(userMessage); 
      }
      
      showErrorToast(message) { 
        const existingToast = document.querySelector('.toast.error'); 
        if (existingToast) return; 
        
        const toast = document.createElement('div'); 
        toast.className = 'toast error show'; 
        const isMobile = window.innerWidth <= 480; 
        
        const baseStyles = `
          position: fixed; background: #fff; border: 1px solid #f1b2b7; 
          border-left: 4px solid var(--error); border-radius: 8px; 
          padding: 16px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
          z-index: 10000; font-family: var(--font-primary); 
          transition: transform 0.3s ease;
        `; 
        
        if (isMobile) { 
          toast.style.cssText = baseStyles + `
            top: 90px; left: 16px; right: 16px; transform: translateY(-120px);
          `; 
        } else { 
          toast.style.cssText = baseStyles + `
            top: 90px; right: 20px; max-width: 400px; transform: translateX(450px);
          `; 
        } 
        
        toast.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--error); margin-bottom: 4px;">System Error</div>
              <div style="color: #333; font-size: 0.9em; line-height: 1.4;">${message}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; font-size: 1.4em; cursor: pointer; color: #999; line-height: 1; padding: 0;" 
              title="Close">&times;</button>
          </div>
          <div style="margin-top: 12px; text-align: right;">
            <button onclick="location.reload()" 
              style="padding: 6px 12px; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500;">
              Refresh Page
            </button>
          </div>
        `; 
        
        document.body.appendChild(toast); 
        
        setTimeout(() => { 
          if (isMobile) toast.style.transform = 'translateY(0)'; 
          else toast.style.transform = 'translateX(0)'; 
        }, 100); 
        
        setTimeout(() => { 
          if (toast.parentNode) { 
            if (isMobile) toast.style.transform = 'translateY(-120px)'; 
            else toast.style.transform = 'translateX(450px)'; 
            setTimeout(() => toast.remove(), 300); 
          } 
        }, 8000); 
      }
      
      logError(errorInfo) { 
        this.errorLog.push(errorInfo); 
        if (this.errorLog.length > this.maxLogSize) this.errorLog.shift(); 
        console.error('🚨 Critical Error:', errorInfo); 
      }
    }

    // ===== ENHANCED SESSION MANAGEMENT =====
    class SecureSessionManager {
      constructor() { 
        this.SESSION_TIMEOUT = 30 * 60 * 1000; 
        this.WARNING_TIME = 5 * 60 * 1000; 
        this.lastActivity = Date.now(); 
        this.warningShown = false; 
      }
      
      initialize() { 
        this.startActivityTracking(); 
        this.startSessionMonitoring(); 
      }
      
      startActivityTracking() { 
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => { 
          document.addEventListener(event, () => { 
            this.lastActivity = Date.now(); 
            this.warningShown = false; 
          }, { passive: true }); 
        }); 
      }
      
      startSessionMonitoring() { 
        setInterval(() => { 
          const timeElapsed = Date.now() - this.lastActivity; 
          if (timeElapsed > this.SESSION_TIMEOUT) { 
            this.forceLogout('Session expired due to inactivity'); 
          } else if (timeElapsed > this.SESSION_TIMEOUT - this.WARNING_TIME && !this.warningShown) { 
            this.showTimeoutWarning(); 
            this.warningShown = true; 
          } 
        }, 60000); 
      }
      
      showTimeoutWarning() { 
        if (confirm('Your session will expire in 5 minutes due to inactivity. Stay logged in?')) { 
          this.lastActivity = Date.now(); 
        } 
      }
      
      forceLogout(reason) { 
        localStorage.clear(); 
        sessionStorage.clear(); 
        alert(`Session ended: ${reason}`); 
        location.reload(); 
      }
    }


    // ===== CONFIGURATION AND CONSTANTS =====
    const THEME_KEY = 'sophia_theme';
    const STAFF_KEY = 'loggedInStaff';
    const TIMESTAMP_KEY = 'loginTimestamp';
    const REMEMBER_KEY = 'rememberMe';
    const SESSION_DURATION = 48 * 60 * 60 * 1000;

    // ===== APPLICATION STATE =====
    let elements = {};
    const appState = { 
      isLoading: false, 
      loginAttempts: 0, 
      maxAttempts: 5, 
      progressInterval: null 
    };

    const loadingMessages = [ 
      'Connecting to Sophia College servers...', 
      'Loading staff authentication data...', 
      'Verifying security protocols...', 
      'Almost ready...' 
    ];

    // ===== INITIALIZE SYSTEMS =====
    const globalErrorHandler = new GlobalErrorHandler();
    const sessionManager = new SecureSessionManager();
    const dataLoader = new DataManager();

    // ===== UTILITY FUNCTIONS =====
    function sanitizeInput(input) { 
      if (typeof input !== 'string') return input; 
      return input.trim().replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '');
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', initializeApp);

    async function initializeApp() {
      console.log('🚀 Initializing Enhanced Sophia College Login System v2.3');
      
      try {
        sessionManager.initialize();
        cacheElements();
        setupEventListeners();
        initializeTheme();
        setTimeGreeting();
        checkExistingSession();
        
        // Add emergency timeout to always enable form
        const emergencyTimeout = setTimeout(() => {
          console.warn('🚨 Emergency timeout - forcing form enable');
          if (elements.staffID && elements.staffID.disabled) {
            elements.staffID.disabled = false;
            elements.staffID.placeholder = 'Enter your 6-digit Staff ID (emergency mode)';
            elements.staffID.focus();
            appState.csvLoaded = true; // Allow login in emergency mode
            updateLoginButtonState();
            showStatus('Emergency mode enabled - please try logging in', 'warning');
            showLoading(false);
          }
        }, 15000); // 15 second emergency timeout
        
        // await loadInitialData(); // No longer needed
        enhanceStaffIdInput();
        showLoading(false);
        showProgress(100);
        const btnText = elements.loginBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = '🔐 Secure Login';
        }
        elements.staffID.disabled = false;
        elements.staffID.placeholder = 'Enter your 6-digit Staff ID';
        updateLoginButtonState();
        
        clearTimeout(emergencyTimeout); // Cancel emergency timeout if loading succeeds
        console.log('✅ Application initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        showStatus('System initialization failed. Please refresh the page.', 'error');
        
        // Force enable the form even if initialization fails
        if (elements.staffID) {
          elements.staffID.disabled = false;
          elements.staffID.placeholder = 'Enter your 6-digit Staff ID (fallback mode)';
          elements.staffID.focus();
        }
        appState.csvLoaded = true; // Allow login in fallback mode
        updateLoginButtonState();
        showLoading(false);
      }
    }

    function cacheElements() {
      const elementIds = [ 
        'themeToggle', 'timeGreeting', 'loginForm', 'staffID', 'toggleEye', 
        'forgotID', 'statusMsg', 'rememberMe', 'loginBtn', 'loadingOverlay', 
        'progressBar', 'progressFill', 'loadingMessage' 
      ];
      
      elementIds.forEach(id => { 
        elements[id] = document.getElementById(id); 
        if (!elements[id]) { 
          console.warn(`⚠️ Element not found: ${id}`); 
        } 
      });
      
      // Ensure the staff ID input is initially enabled
      if (elements.staffID) {
        elements.staffID.disabled = false;
        elements.staffID.placeholder = 'Loading authentication system...';
        console.log('🔓 Staff ID input initialized as enabled');
      }
    }

    function setupEventListeners() {
      console.log('🔧 Setting up event listeners...');
      
      // Theme toggle
      if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
      }
      
      // Password visibility toggle
      if (elements.toggleEye) {
        elements.toggleEye.addEventListener('click', togglePasswordVisibility);
      }
      
      // Forgot ID link
      elements.forgotID?.addEventListener('click', handleForgotId);
      elements.forgotID?.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter' || e.key === ' ') { 
          e.preventDefault(); 
          handleForgotId(); 
        } 
      });
      
      // Login form
      if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
      }
      
      // Staff ID input
      elements.staffID?.addEventListener('input', validateStaffInput);
      elements.staffID?.addEventListener('keydown', handleStaffInputKeydown);
      elements.staffID?.addEventListener('paste', handleStaffInputPaste);
      elements.staffID?.addEventListener('blur', validateOnBlur);
      
      // Remember me checkbox
      elements.rememberMe?.addEventListener('change', () => { 
        localStorage.setItem(REMEMBER_KEY, elements.rememberMe.checked); 
      });
      
      // Global keyboard shortcuts
      document.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') { 
          clearStatus(); 
        } 
      });
      
      console.log('✅ Event listeners configured');
    }

    // ===== THEME MANAGEMENT =====
    function initializeTheme() {
      const savedTheme = localStorage.getItem(THEME_KEY);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        if (elements.themeToggle) elements.themeToggle.textContent = '☀️';
      } else {
        if (elements.themeToggle) elements.themeToggle.textContent = '🌓';
      }
      
      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { 
        if (!localStorage.getItem(THEME_KEY)) { 
          document.body.classList.toggle('dark-mode', e.matches); 
          if (elements.themeToggle) {
            elements.themeToggle.textContent = e.matches ? '☀️' : '🌓';
          }
        } 
      });
    }

    function toggleTheme() {
      console.log('🎨 Toggling theme...');
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      
      if (elements.themeToggle) {
        elements.themeToggle.textContent = isDark ? '☀️' : '🌓';
        elements.themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      }
      
      showStatus(`Theme changed to ${isDark ? 'dark' : 'light'} mode`, 'info', 2000);
    }

    // ===== GREETING SYSTEM =====
    function setTimeGreeting() {
      if (!elements.timeGreeting) return;
      
      const hour = new Date().getHours();
      let greeting;
      
      if (hour < 5) greeting = 'Working late tonight?';
      else if (hour < 12) greeting = 'Good morning!';
      else if (hour < 17) greeting = 'Good afternoon!';
      else if (hour < 21) greeting = 'Good evening!';
      else greeting = 'Working late tonight?';
      
      elements.timeGreeting.textContent = greeting;
    }

    // ===== SESSION MANAGEMENT =====
    function checkExistingSession() {
      const storedStaff = localStorage.getItem(STAFF_KEY);
      const timestamp = localStorage.getItem(TIMESTAMP_KEY);
      const rememberMe = localStorage.getItem(REMEMBER_KEY) === 'true';
      
      if (storedStaff && timestamp && rememberMe) {
        const loginTime = parseInt(timestamp);
        const currentTime = Date.now();
        
        if (currentTime - loginTime < SESSION_DURATION) {
          console.log('✅ Valid session found, redirecting...');
          showStatus('Welcome back! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'home.html';
          }, 1000);
          return;
        } else {
          console.log('⏰ Session expired, clearing storage');
          localStorage.removeItem(STAFF_KEY);
          localStorage.removeItem(TIMESTAMP_KEY);
          localStorage.removeItem(REMEMBER_KEY);
        }
      }
    }

    // ===== INPUT VALIDATION =====
    function enhanceStaffIdInput() {
      if (!elements.staffID) return;
      
      console.log('🔧 Enhancing staff ID input...');
      
      // Don't disable initially - let the loading process handle this
      // elements.staffID.disabled = true;
      
      // Enhanced input filtering
      elements.staffID.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
      });
      
      // Add a backup enable mechanism
      setTimeout(() => {
        if (elements.staffID && elements.staffID.disabled) {
          console.log('🔓 Backup: Enabling staff ID input after delay');
          elements.staffID.disabled = false;
          elements.staffID.placeholder = 'Enter your 6-digit Staff ID';
          updateLoginButtonState();
        }
      }, 5000); // Enable after 5 seconds regardless
    }

    function validateStaffInput(event) {
      const input = event.target;
      let value = input.value.replace(/\D/g, '').substring(0, 6);
      input.value = value;

      const errorDiv = document.getElementById('staffID-error');
      const helpTextDiv = document.getElementById('staffID-help');
      const validationIndicator = input.nextElementSibling?.nextElementSibling;

      if (value.length === 0) {
        input.classList.remove('field-valid', 'field-invalid');
        if (validationIndicator) validationIndicator.textContent = '';
        if (errorDiv) errorDiv.textContent = '';
        if (helpTextDiv) helpTextDiv.textContent = 'Enter your 6-digit staff identification number';
      } else if (value.length < 6) {
        input.classList.remove('field-valid');
        input.classList.add('field-invalid');
        if (validationIndicator) validationIndicator.textContent = '✖';
        if (errorDiv) errorDiv.textContent = 'Staff ID must be 6 digits.';
        if (helpTextDiv) helpTextDiv.textContent = '';
      } else {
        input.classList.remove('field-invalid');
        input.classList.add('field-valid');
        if (validationIndicator) validationIndicator.textContent = '✓';
        if (errorDiv) errorDiv.textContent = '';
        if (helpTextDiv) helpTextDiv.textContent = 'Staff ID format correct.';
      }
      
      updateLoginButtonState();
    }

    function handleStaffInputKeydown(event) {
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
      ];
      
      if (allowedKeys.includes(event.key)) return;
      if (event.ctrlKey || event.metaKey) return;
      if (!/^\d$/.test(event.key)) {
        event.preventDefault();
        return;
      }
      
      if (event.target.value.length >= 6) {
        event.preventDefault();
      }
    }

    function handleStaffInputPaste(event) {
      event.preventDefault();
      const paste = (event.clipboardData || window.clipboardData).getData('text');
      const numbers = paste.replace(/\D/g, '').substring(0, 6);
      event.target.value = numbers;
      validateStaffInput(event);
    }

    function validateOnBlur() {
      const staffId = elements.staffID?.value;
      if (staffId && staffId.length < 6) {
        showStatus('Staff ID must be exactly 6 digits', 'warning', 3000);
      }
    }

    function updateLoginButtonState() {
      const staffIdInput = elements.staffID;
      const loginButton = elements.loginBtn;
      
      if (staffIdInput && loginButton) {
        const staffIdValue = staffIdInput.value;
        const isValidLength = staffIdValue.length === 6;
        const isInputEnabled = !staffIdInput.disabled;
        
        // Allow login if input is valid and enabled, regardless of CSV loading status
        const canAttemptLogin = isValidLength && isInputEnabled && !appState.isLoading;
        
        console.log(`🔘 Button state - Valid: ${isValidLength}, Enabled: ${isInputEnabled}, Loading: ${appState.isLoading}, Can Login: ${canAttemptLogin}`);
        
        loginButton.disabled = !canAttemptLogin;
        
        // Update button text based on state
        if (elements.loginBtn) {
          const btnText = elements.loginBtn.querySelector('.btn-text');
          if (btnText) {
            btnText.textContent = '🔐 Secure Login';
          }
        }
      } else {
        console.error('❌ updateLoginButtonState: staffIdInput or loginButton element not found.');
      }
    }

    // ===== UI INTERACTIONS =====
    function togglePasswordVisibility() {
      const input = elements.staffID;
      const toggle = elements.toggleEye;
      
      if (!input || !toggle) return;
      
      if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
        toggle.title = 'Hide Staff ID';
      } else {
        input.type = 'password';
        toggle.textContent = '👁️';
        toggle.title = 'Show Staff ID';
      }
    }

    function handleForgotId() {
      const message = `If you've forgotten your Staff ID, please contact:
      
📧 IT Support: splaittech@bne.catholic.edu.au
📞 College Office: (07) 3347 9200

Your Staff ID is a 6-digit number provided during orientation.`;
      
      alert(message);
    }


    // ===== LOGIN PROCESS =====
    async function handleLogin(event) {
      console.log('🔐 Login attempt initiated');
      
      if (event) {
        event.preventDefault();
      }
      
      if (appState.isLoading) {
        console.log('⏳ Login already in progress');
        return;
      }
      
      const staffId = sanitizeInput(elements.staffID?.value.trim());
      
      if (!staffId) {
        showStatus('Please enter your Staff ID', 'error');
        elements.staffID?.focus();
        return;
      }
      
      if (staffId.length !== 6 || !/^\d{6}$/.test(staffId)) {
        showStatus('Staff ID must be exactly 6 digits', 'error');
        elements.staffID?.focus();
        return;
      }
      
      if (appState.loginAttempts >= appState.maxAttempts) {
        showStatus('Too many failed attempts. Please wait before trying again.', 'error');
        return;
      }
      
      try {
        await performLogin(staffId);
      } catch (error) {
        console.error('❌ Login error:', error);
        showStatus('Login failed. Please try again.', 'error');
      }
    }
    
    async function performLogin(staffId) {
      appState.isLoading = true;
      updateLoginButtonState();
      
      if (elements.loginBtn) elements.loginBtn.classList.add('loading');
      showStatus('Authenticating...', 'info');
      showProgress(20);

      try {
        const response = await fetch('/functions/authenticate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ staffId }),
        });

        const data = await response.json();
        showProgress(80);

        if (response.ok && data.success) {
          const loggedInStaff = data.staff;
          
          // Reset login attempts
          appState.loginAttempts = 0;
          showProgress(95);
          
          // Store session data
          localStorage.setItem(STAFF_KEY, JSON.stringify(loggedInStaff));
          localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
          localStorage.setItem(REMEMBER_KEY, elements.rememberMe?.checked || false);
          
          showProgress(100);
          showStatus(`Welcome, ${loggedInStaff['staff name']}! Redirecting...`, 'success');
          
          if (elements.loginBtn) {
            elements.loginBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
          }
          
          // Redirect after success animation
          setTimeout(() => {
            const redirectUrl = sessionStorage.getItem('redirectUrlAfterLogin');
            sessionStorage.removeItem('redirectUrlAfterLogin');
            window.location.href = redirectUrl || 'home.html';
          }, 1500);
          
          console.log(`✅ Login successful for: ${loggedInStaff['staff name']}`);
          
        } else {
          // Handle failed login
          appState.loginAttempts++;
          const remainingAttempts = appState.maxAttempts - appState.loginAttempts;
          
          let message = data.message || 'Invalid Staff ID. Please check and try again.';
          if (remainingAttempts > 0 && remainingAttempts < appState.maxAttempts) {
            message += ` (${remainingAttempts} attempts remaining)`;
          }
          
          showStatus(message, 'error');
          showProgress(0);
          
          if (elements.staffID) {
            elements.staffID.value = '';
            elements.staffID.classList.remove('field-valid');
            elements.staffID.classList.add('field-invalid');
            elements.staffID.focus();
          }
          
          if (elements.loginBtn) {
            elements.loginBtn.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => { elements.loginBtn.style.animation = ''; }, 500);
          }
          
          console.log(`❌ Login failed for Staff ID: ${staffId}`);
        }
        
      } catch (error) {
        console.error('❌ Login error during authentication:', error);
        showStatus('Login failed due to a system error. Please try again.', 'error');
        showProgress(0);
      } finally {
        appState.isLoading = false;
        if (elements.loginBtn) elements.loginBtn.classList.remove('loading');
        updateLoginButtonState();
      }
    }

    // ===== UI FEEDBACK FUNCTIONS =====
    function showStatus(message, type = 'info', duration = 5000) { 
      if (!elements.statusMsg) return; 
      
      elements.statusMsg.textContent = message; 
      elements.statusMsg.className = `status-msg ${type} visible`; 
      
      console.log(`📱 Status (${type}): ${message}`);
      
      if (duration > 0) {
        setTimeout(clearStatus, duration);
      }
    }
    
    function clearStatus() { 
      if (elements.statusMsg) {
        elements.statusMsg.classList.remove('visible'); 
      }
    }
    
    function showLoading(show) { 
      if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.toggle('visible', show); 
      }
      if (show) {
        showProgressiveLoading(); 
      }
    }
    
    function showProgressiveLoading() {
      if (!elements.loadingMessage) return;
      
      let messageIndex = 0;
      const updateMessage = () => {
        if (elements.loadingMessage && elements.loadingOverlay?.classList.contains('visible')) {
          elements.loadingMessage.textContent = loadingMessages[messageIndex];
          messageIndex = (messageIndex + 1) % loadingMessages.length;
        }
      };
      
      updateMessage();
      const interval = setInterval(() => {
        if (elements.loadingOverlay?.classList.contains('visible')) {
          updateMessage();
        } else {
          clearInterval(interval);
        }
      }, 1500);
    }
    
    function showProgress(percentage) { 
      if (elements.progressBar && elements.progressFill) {
        elements.progressBar.style.display = percentage > 0 ? 'block' : 'none';
        elements.progressFill.style.width = percentage + '%';
      }
    }

    // ===== ENHANCED ACCESSIBILITY =====
    
    // Announce important changes to screen readers
    function announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'visually-hidden';
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }

    // ===== PERFORMANCE MONITORING =====
    
    // Monitor and log performance metrics
    function logPerformanceMetrics() {
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const metrics = {
          pageLoadTime: timing.loadEventEnd - timing.navigationStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.requestStart
        };
        
        console.log('📊 Performance Metrics:', metrics);
      }
    }

    // Log performance on load
    window.addEventListener('load', () => {
      setTimeout(logPerformanceMetrics, 100);
    });

    console.log('✅ Enhanced login system loaded successfully');
