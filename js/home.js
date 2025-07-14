
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get('search');
  if (searchQuery) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = searchQuery;
      const event = new Event('input');
      searchInput.dispatchEvent(event);
    }
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('sophia_theme');
  if (!savedTheme) {
    document.body.classList.toggle('dark-mode', prefersDark);
    localStorage.setItem('sophia_theme', prefersDark ? 'dark' : 'light');
  }
});

'use strict';

// Firebase configuration
const firebaseConfig = {
  apiKey:'AIzaSyD0yaJtrClhyXWjBqDmtdxdM2kWl8AvtKU', 
  authDomain:'sophia-infringements.firebaseapp.com', 
  projectId:'sophia-infringements',
  databaseURL: 'https://sophia-infringements-default-rtdb.firebaseio.com/'
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ===== GLOBAL STATE & CONFIG =====
const appState = { 
  isLoading: false, 
  csvLoaded: false, 
  staffData: [], 
  teacherData: [], 
  loginAttempts: 0, 
  maxAttempts: 5,
  isAuthenticated: false,
  currentStaff: null
};

const elements = {};

const dataLoader = new SophiaDataManager();

// ===== ENHANCED DASHBOARD MANAGER =====
class DashboardManager {
  constructor() {
    this.cachedData = new Map();
    this.refreshInterval = null;
  }

  async loadQuickStats() {
    try {
      this.showLoadingStats();
      this.updateConnectionStatus('loading', 'Connecting to database...');
      
      const [todayInfractions, weekReferrals, totalStudents, weekAffirmations] = await Promise.allSettled([
        this.loadTodayInfractions(),
        this.loadWeekReferrals(),
        this.loadTotalStudents(),
        this.loadWeekAffirmations()
      ]);

      const stats = {
        today: this.extractValue(todayInfractions, 0),
        week: this.extractValue(weekReferrals, 0),
        students: this.extractValue(totalStudents, 0),
        affirmations: this.extractValue(weekAffirmations, 0)
      };

      this.updateStatsDisplay(stats);
      this.updateLastUpdatedTimestamp();
      this.hideLoadingStats();
      
      // Enhanced feedback
      this.handleDataSourceErrors([todayInfractions, weekReferrals, totalStudents, weekAffirmations]);
      
      console.log(`✅ Dashboard stats loaded:`, stats);
      
    } catch (error) {
      console.error('Failed to load quick stats:', error);
      this.hideLoadingStats();
      this.updateConnectionStatus('error', 'Database connection failed');
      this.showToast('Failed to load dashboard statistics', 'error');
    }
  }

  extractValue(promiseResult, defaultValue) {
    return promiseResult.status === 'fulfilled' ? promiseResult.value : defaultValue;
  }

  handleDataSourceErrors(results) {
    const errorSources = [];
    const sourceNames = ['infractions', 'referrals', 'student data', 'affirmations'];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        errorSources.push(sourceNames[index]);
      }
    });

    if (errorSources.length > 0) {
      console.warn(`⚠️ Some data sources unavailable: ${errorSources.join(', ')}`);
      this.updateConnectionStatus('error', 'Some data sources offline');
      this.showToast(`📊 Dashboard loaded (${errorSources.length} source${errorSources.length > 1 ? 's' : ''} offline)`, 'warning');
    } else {
      this.updateConnectionStatus('connected', 'All systems operational');
      this.showToast(`📊 Dashboard data refreshed successfully`, 'success');
    }
  }

  showLoadingStats() {
    const statsSection = document.getElementById('quick-stats');
    if (!statsSection) return;
    statsSection.style.display = 'grid';
    const cards = statsSection.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
      card.classList.add('loading');
      // Stagger loading animation
      setTimeout(() => {
        card.style.animationDelay = `${index * 0.1}s`;
      }, 50);
    });
  }

  hideLoadingStats() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
      card.classList.remove('loading');
      card.style.animationDelay = '';
    });
  }

  // Enhanced counter animation with easing
  animateCounter(element, targetValue) {
    if (!element) return;
    
    const start = parseInt(element.textContent) || 0;
    const end = targetValue;
    const duration = 1200;
    const startTime = performance.now();
    
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Enhanced easing function (ease-out-cubic)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * easeOutCubic);
      
      element.textContent = current.toLocaleString(); // Add comma formatting
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        // Add a subtle "pop" effect when complete
        element.style.transform = 'scale(1.05)';
        setTimeout(() => {
          element.style.transform = 'scale(1)';
        }, 150);
      }
    };
    requestAnimationFrame(update);
  }

  updateStatsDisplay(stats) {
    const updates = [
      { id: 'todayInfractionsCard', value: stats.today, label: 'Today\'s Infractions', targetId: 'todayInfractions' },
      { id: 'weekReferralsCard', value: stats.week, label: 'Week Referrals', targetId: 'weekReferrals' },
      { id: 'activeStudentsCard', value: stats.students, label: 'Total Students', targetId: 'activeStudents' },
      { id: 'weekAffirmationsCard', value: stats.affirmations, label: 'Week Affirmations', targetId: 'weekAffirmations' }
    ];

    updates.forEach((update, index) => {
      setTimeout(() => {
        const card = document.getElementById(update.id);
        if (card) {
          card.innerHTML = `
            <span class="stat-number" id="${update.targetId}"></span>
            <span class="stat-label">${update.label}</span>
          `;
          this.animateCounter(document.getElementById(update.targetId), update.value);
        }
      }, index * 100); // Stagger updates
    });

    // Render chart after all updates
    setTimeout(() => {
      this.renderInfractionsChart(stats.today, stats.week);
    }, 500);
  }

  // Enhanced chart rendering
  renderInfractionsChart(today, week) {
    try {
      const chartsSection = document.getElementById('charts');
      const canvas = document.getElementById('infractionsChart');
      
      if (!canvas || !chartsSection) return;
      
      chartsSection.style.display = 'block';
      
      // Destroy existing chart if it exists
      if (window.dashboardChart) {
        window.dashboardChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      window.dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Today\'s Infractions', 'Week\'s Referrals'],
          datasets: [{
            label: '# of Incidents',
            data: [today, week],
            backgroundColor: [
              'rgba(220, 53, 69, 0.2)',
              'rgba(255, 193, 7, 0.2)'
            ],
            borderColor: [
              'rgba(220, 53, 69, 1)',
              'rgba(255, 193, 7, 1)'
            ],
            borderWidth: 2,
            borderRadius: 4,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              cornerRadius: 8,
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      });
    } catch (error) {
      console.error('Failed to render chart:', error);
    }
  }

  // Data loading methods with caching
  getCachedData(key, maxAgeMinutes) {
    const cached = this.cachedData.get(key);
    if (!cached) return null;
    
    const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
    if (ageMinutes > maxAgeMinutes) {
      this.cachedData.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCachedData(key, data) {
    this.cachedData.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async loadTodayInfractions() {
    const cacheKey = 'today_infractions';
    const cached = this.getCachedData(cacheKey, 5);
    if (cached !== null) return cached;

    try {
      if (!db) return 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const snapshot = await db.collection('infringements')
        .where('timestamp', '>=', today.toISOString())
        .where('timestamp', '<', tomorrow.toISOString())
        .get();
        
      const result = snapshot.size;
      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('⚠️ Error loading today\'s infractions:', error);
      return 0;
    }
  }

  async loadWeekReferrals() {
    const cacheKey = 'week_referrals';
    const cached = this.getCachedData(cacheKey, 5);
    if (cached !== null) return cached;

    try {
      if (!db) return 0;
      
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);

      const snapshot = await db.collection('referrals')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startOfWeek))
        .get();
        
      const result = snapshot.size;
      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('⚠️ Error loading week referrals:', error);
      return 0;
    }
  }

  async loadTotalStudents() {
    const cacheKey = 'total_students';
    const cached = this.getCachedData(cacheKey, 30);
    if (cached !== null) return cached;

    try {
      // Try cached data first
      if (window.sophiaData && window.sophiaData.students) {
        const result = window.sophiaData.students.length;
        this.setCachedData(cacheKey, result);
        return result;
      }
      
      // Load from CSV if not cached
      const data = await dataLoader.loadCSV('students.csv');
      const result = data.length;
      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('⚠️ Error loading total students:', error);
      return 0;
    }
  }

  async loadWeekAffirmations() {
    const cacheKey = 'week_affirmations';
    const cached = this.getCachedData(cacheKey, 5);
    if (cached !== null) return cached;

    try {
      if (!db) return 0;
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      
      const snapshot = await db.collection('affirmations')
        .where('timestamp', '>=', weekAgo.toISOString())
        .get();
        
      const result = snapshot.size;
      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('⚠️ Error loading week affirmations:', error);
      return 0;
    }
  }

  // Enhanced refresh with better feedback
  async refreshDashboardStats() {
    const refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '🔄 <span>Refreshing...</span>';
    }
    
    try {
      console.log('🔄 Refreshing dashboard statistics...');
      
      // Clear cache to force fresh data
      this.cachedData.clear();
      
      await this.loadQuickStats();
      
      if (refreshBtn) {
        refreshBtn.innerHTML = '✅ <span>Refreshed!</span>';
        setTimeout(() => {
          refreshBtn.innerHTML = '🔄 <span>Refresh Stats</span>';
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Failed to refresh statistics:', error);
      this.showToast('Failed to refresh statistics', 'error');
      
      if (refreshBtn) {
        refreshBtn.innerHTML = '❌ <span>Failed</span>';
        setTimeout(() => {
          refreshBtn.innerHTML = '🔄 <span>Refresh Stats</span>';
        }, 2000);
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
      }
    }
  }

  // Connection status with auto-hide
  updateConnectionStatus(status, message) {
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (connectionStatus && connectionText) {
      connectionStatus.className = `connection-status ${status}`;
      connectionText.textContent = message;
      connectionStatus.style.display = 'block';
      
      // Auto-hide based on status
      let hideDelay = 0;
      switch (status) {
        case 'connected':
          hideDelay = 3000;
          break;
        case 'loading':
          hideDelay = 0; // Don't auto-hide
          break;
        case 'error':
          hideDelay = 8000; // Show errors longer
          break;
      }
      
      if (hideDelay > 0) {
        setTimeout(() => {
          connectionStatus.style.display = 'none';
        }, hideDelay);
      }
    }
  }

  updateLastUpdatedTimestamp() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    if (lastUpdatedElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      lastUpdatedElement.innerHTML = `
        <span style="opacity: 0.7;">Last updated:</span> 
        <strong>${timeString}</strong>
      `;
    }
  }

  // Auto-refresh with smart intervals
  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        this.refreshDashboardStats();
      }
    }, 5 * 60 * 1000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Enhanced toast notifications
  showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        this.closeToast();
      }, duration);
    }
  }

  closeToast() {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.classList.remove('show');
    }
  }
}
const dashboard = new DashboardManager();

const authManager = {
  STAFF_KEY: 'loggedInStaff',
  TIMESTAMP_KEY: 'loginTimestamp',
  REMEMBER_KEY: 'rememberMe',
  SESSION_DURATION: 48 * 60 * 60 * 1000,

  check() {
    console.log('🔐 Checking authentication...');
    
    const loggedInStaff = localStorage.getItem(this.STAFF_KEY);
    const loginTimestamp = localStorage.getItem(this.TIMESTAMP_KEY);
    const rememberMe = localStorage.getItem(this.REMEMBER_KEY);

    if (!loggedInStaff) {
      console.warn('⚠️ No authentication found');
      window.location.href = 'index.html';
      return null;
    }

    try {
      const staff = JSON.parse(loggedInStaff);
      
      // Check session expiry
      if (rememberMe !== 'true' && loginTimestamp) {
        const sessionAge = Date.now() - parseInt(loginTimestamp);
        if (sessionAge > this.SESSION_DURATION) {
          console.warn('⚠️ Session expired');
          this.clearAuth();
          window.location.href = 'index.html';
          return null;
        }
      }
      
      // Validate staff object
      if (!staff['staff name'] || !staff['staffid']) {
        console.warn('⚠️ Invalid authentication data');
        this.clearAuth();
        window.location.href = 'index.html';
        return null;
      }
      
      console.log(`✅ Authentication valid for: ${staff['staff name']}`);
      appState.isAuthenticated = true;
      appState.currentStaff = staff;
      return staff;
      
    } catch (e) {
      console.error('❌ Error parsing authentication data:', e);
      this.clearAuth();
      window.location.href = 'index.html';
      return null;
    }
  },

  logout() {
    console.log('🚪 Logging out user...');
    this.clearAuth();
    appState.isAuthenticated = false;
    appState.currentStaff = null;
    dashboard.stopAutoRefresh();
    window.location.href = 'index.html';
  },

  clearAuth() {
    localStorage.removeItem(this.STAFF_KEY);
    localStorage.removeItem(this.TIMESTAMP_KEY);
    localStorage.removeItem(this.REMEMBER_KEY);
  }
};

// ===== ENHANCED SEARCH FUNCTIONALITY =====
class SearchManager {
  constructor() {
    this.searchInput = null;
    this.searchClearBtn = null;
    this.searchResults = null;
    this.actionCards = null;
    this.searchTimeout = null;
  }

  initialize() {
    this.searchInput = document.getElementById('searchInput');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    this.searchResults = document.getElementById('searchResults');
    this.actionCards = document.querySelectorAll('.action-card');
    
    if (!this.searchInput) return;
    
    this.setupEventListeners();
    this.performSearch(''); // Initialize
  }

  setupEventListeners() {
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.performSearch(e.target.value), 150);
    });
    
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });
    
    this.searchClearBtn.addEventListener('click', () => this.clearSearch());
  }

  performSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    let visibleCount = 0;
    
    if (!searchTerm) {
      // Show all cards
      this.actionCards.forEach(card => {
        card.classList.remove('filtered-out', 'highlighted');
        card.classList.add('filtered-in');
        this.clearHighlights(card);
      });
      this.searchResults.textContent = '';
      this.searchResults.classList.remove('visible');
      this.searchClearBtn.classList.remove('visible');
      return;
    }
    
    this.searchClearBtn.classList.add('visible');
    
    this.actionCards.forEach(card => {
      const label = card.querySelector('.label').textContent.toLowerCase();
      const description = card.querySelector('.description').textContent.toLowerCase();
      const keywords = card.dataset.keywords?.toLowerCase() || '';
      
      const labelMatch = label.includes(searchTerm);
      const descMatch = description.includes(searchTerm);
      const keywordMatch = keywords.includes(searchTerm);
      
      if (labelMatch || descMatch || keywordMatch) {
        card.classList.remove('filtered-out');
        card.classList.add('filtered-in', 'highlighted');
        
        // Highlight matching text
        if (labelMatch) this.highlightText(card.querySelector('.label'), searchTerm);
        if (descMatch) this.highlightText(card.querySelector('.description'), searchTerm);
        
        visibleCount++;
      } else {
        card.classList.remove('filtered-in', 'highlighted');
        card.classList.add('filtered-out');
        this.clearHighlights(card);
      }
    });
    
    // Update results info
    if (visibleCount === 0) {
      this.searchResults.textContent = `No tools found for "${query}"`;
    } else if (visibleCount === 1) {
      this.searchResults.textContent = `Found 1 tool`;
    } else {
      this.searchResults.textContent = `Found ${visibleCount} tools`;
    }
    this.searchResults.classList.add('visible');
  }

  highlightText(element, term) {
    const text = element.textContent;
    const regex = new RegExp(`(${term})`, 'gi');
    const highlightedText = text.replace(regex, '<span class="highlight">$1</span>');
    element.innerHTML = highlightedText;
  }

  clearHighlights(card) {
    const label = card.querySelector('.label');
    const description = card.querySelector('.description');
    
    if (label.innerHTML.includes('<span class="highlight">')) {
      label.innerHTML = label.textContent;
    }
    if (description.innerHTML.includes('<span class="highlight">')) {
      description.innerHTML = description.textContent;
    }
  }

  clearSearch() {
    this.searchInput.value = '';
    this.performSearch('');
    this.searchInput.focus();
  }
}
const searchManager = new SearchManager();

// ===== ENHANCED THEME MANAGER =====
class ThemeManager {
  constructor() {
    this.themes = {
      light: { name: 'Light', icon: '🌓' },
      dark: { name: 'Dark', icon: '☀️' }
    };
  }

  initialize() {
    const savedTheme = localStorage.getItem('sophia_theme') || 'light';
    this.setTheme(savedTheme);
  }

  setTheme(themeName) {
    const isDark = themeName === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    this.updateThemeIcon(isDark);
    localStorage.setItem('sophia_theme', themeName);
  }

  toggle() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    
    dashboard.showToast(`Switched to ${this.themes[newTheme].name.toLowerCase()} mode`, 'info', 1500);
  }

  updateThemeIcon(isDark) {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      const theme = isDark ? this.themes.dark : this.themes.light;
      themeBtn.textContent = theme.icon;
      themeBtn.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
    }
  }
}
const themeManager = new ThemeManager();

// ===== UI & EVENT HANDLERS =====
function showLogin() {
  elements.mainContent.style.display = 'none';
  elements.loginSection.style.display = 'flex';
  elements.staffName.textContent = '';
  
  // Focus the staff ID input
  setTimeout(() => {
    if (elements.staffID) {
      elements.staffID.focus();
    }
  }, 100);
}

function showDashboard(staff) {
  elements.loginSection.style.display = 'none';
  elements.mainContent.style.display = 'block';
  updateStaffDisplay(staff);
  updateDashboardGreeting();
  
  // Initialize dashboard components
  searchManager.initialize();
  dashboard.loadQuickStats();
  dashboard.startAutoRefresh();
  
  // Hide loading banner after delay
  setTimeout(() => {
    const loadingBanner = document.getElementById('loadingBanner');
    if (loadingBanner) {
      loadingBanner.classList.add('hide');
      setTimeout(() => {
        loadingBanner.style.display = 'none';
      }, 500);
    }
  }, 1500);
}

function updateStaffDisplay(staff) {
  if (staff && elements.staffName) {
    elements.staffName.textContent = staff['staff name'] || 'Staff Member';
    console.log(`👤 Staff display updated: ${staff['staff name']}`);
    
    // Check admin access
    if (staff.adminaccess === 'Y' || staff.adminaccess === true) {
      elements.adminLink.style.display = 'block';
      console.log('🔧 Admin access enabled');
    }
  } else if (elements.staffName) {
    elements.staffName.textContent = 'Staff Member';
  }
}

function updateDashboardGreeting() {
  const greetingElement = document.getElementById('greeting');
  
  if (greetingElement) {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    let greeting = 'Good Evening';
    let emoji = '🌆';
    
    if (hour < 6) {
      greeting = 'Working Late';
      emoji = '🌙';
    } else if (hour < 12) {
      greeting = 'Good Morning';
      emoji = '🌅';
    } else if (hour < 17) {
      greeting = 'Good Afternoon';
      emoji = '☀️';
    } else if (hour < 19) {
      greeting = 'Good Evening';
      emoji = '🌆';
    } else {
      greeting = 'Good Evening';
      emoji = '🌃';
    }
    
    // Special weekend greetings
    if (day === 0 || day === 6) {
      greeting = `Happy ${day === 0 ? 'Sunday' : 'Saturday'}`;
      emoji = '🎉';
    }
    
    greetingElement.innerHTML = `${emoji} ${greeting}`;
  }
}

function setTimeGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  
  if (elements.timeGreeting) {
    elements.timeGreeting.textContent = greeting;
  }
}

function handleForgotId() {
  dashboard.showToast("If you've forgotten your Staff ID, please contact IT Support at splaittech@bne.catholic.edu.au", 'info', 5000);
}

function togglePasswordVisibility() {
  const input = elements.staffID;
  if (input.type === 'password') {
    input.type = 'text';
    elements.toggleEye.textContent = '🙈';
  } else {
    input.type = 'password';
    elements.toggleEye.textContent = '👁️';
  }
}

function validateStaffInput() {
  const isValid = elements.staffID.value.length === 6 && /^\d{6}$/.test(elements.staffID.value);
  elements.loginBtn.disabled = !isValid || appState.isLoading;
  
  // Update validation indicator
  const indicator = document.querySelector('.validation-indicator');
  if (indicator) {
    indicator.style.opacity = isValid ? '1' : '0';
  }
}

function showStatus(message, type = 'info', duration = 3000) {
  elements.statusMsg.textContent = message;
  elements.statusMsg.className = `status-msg ${type} visible`;
  if (duration > 0) {
    setTimeout(() => elements.statusMsg.classList.remove('visible'), duration);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (appState.isLoading) return;

  appState.isLoading = true;
  elements.loginBtn.innerHTML = '<span class="spinner"></span> Logging in...'; elements.loginBtn.classList.add('loading');
  validateStaffInput();
  showStatus('Authenticating...', 'info', 0);

  try {
    const staff = await authManager.login(elements.staffID.value.trim());
    showStatus(`Welcome, ${staff['staff name']}!`, 'success');
    setTimeout(() => showDashboard(staff), 1000);
  } catch (error) {
    showStatus(error, 'error');
    
    // Clear the input on error
    elements.staffID.value = '';
    validateStaffInput();
    elements.staffID.focus();
  } finally {
    appState.isLoading = false;
    elements.loginBtn.innerHTML = 'Login'; elements.loginBtn.classList.remove('loading');
    validateStaffInput();
  }
}

// ===== NAVIGATION FUNCTIONS =====
function navigate(page) {
  const loadingBanner = document.getElementById('loadingBanner');
  if (loadingBanner) {
    loadingBanner.textContent = `🔄 Loading ${page.replace('.html', '')}...`;
    loadingBanner.style.display = 'block';
  }
  
  // Add visual feedback to clicked element
  const clickedElement = event?.target?.closest('.action-card');
  if (clickedElement) {
    clickedElement.style.transform = 'scale(0.95)';
    setTimeout(() => {
      clickedElement.style.transform = '';
    }, 150);
  }
  
  setTimeout(() => {
    window.location.href = page;
  }, 100);
}

function handleCardKeydown(event, page) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    navigate(page);
  }
}

// ===== KEYBOARD SHORTCUTS =====
function handleKeyboardShortcuts(event) {
  // Navigation shortcuts
  if (event.altKey) {
    const shortcuts = {
      '1': 'staff.html',
      '2': 'outofclass.html', 
      '3': 'positiveaffirmations.html',
      '4': 'reengagementroom.html',
      '5': 'admin.html'
    };
    
    if (shortcuts[event.key]) {
      event.preventDefault();
      dashboard.showToast(`Opening ${shortcuts[event.key].replace('.html', '')}...`, 'info', 1000);
      navigate(shortcuts[event.key]);
    }
  }
  
  // Global shortcuts
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput && appState.isAuthenticated) {
      searchInput.focus();
      dashboard.showToast('Search focused - start typing!', 'info', 1500);
    }
  }
  
  // Escape to clear search
  if (event.key === 'Escape') {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value && appState.isAuthenticated) {
      searchManager.clearSearch();
    }
  }
}

// ===== VISIBILITY CHANGE HANDLING =====
function handleVisibilityChange() {
  if (!appState.isAuthenticated) return;
  
  if (document.hidden) {
    dashboard.stopAutoRefresh();
    console.log('📱 Page hidden - pausing auto-refresh');
  } else {
    dashboard.startAutoRefresh();
    console.log('📱 Page visible - resuming auto-refresh');
    
    // Refresh data if page was hidden for more than 10 minutes
    const lastUpdate = localStorage.getItem('lastDashboardUpdate');
    if (lastUpdate) {
      const timeDiff = Date.now() - parseInt(lastUpdate);
      if (timeDiff > 10 * 60 * 1000) {
        dashboard.refreshDashboardStats();
      }
    }
  }
}

// ===== ELEMENT CACHING =====
function cacheElements() {
  const ids = [
    'loginSection', 'mainContent', 'staffName', 'themeToggle', 'adminLink',
    'timeGreeting', 'loginForm', 'staffID', 'toggleEye', 'forgotID',
    'statusMsg', 'rememberMe', 'loginBtn'
  ];
  ids.forEach(id => elements[id] = document.getElementById(id));
}

function setupEventListeners() {
  // Login form events
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleLogin);
  }
  if (elements.staffID) {
    elements.staffID.addEventListener('input', validateStaffInput);
    elements.staffID.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !elements.loginBtn.disabled) {
        handleLogin(e);
      }
    });
  }
  if (elements.toggleEye) {
    elements.toggleEye.addEventListener('click', togglePasswordVisibility);
  }
  if (elements.forgotID) {
    elements.forgotID.addEventListener('click', (e) => {
      e.preventDefault();
      handleForgotId();
    });
  }
  
  // Theme toggle
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener('click', () => themeManager.toggle());
  }
  
  // Global event listeners
  document.addEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🌐 Sophia College Staff Intranet initializing...');
  
  try {
    // Cache DOM elements
    cacheElements();
    
    // Initialize theme
    themeManager.initialize();
    
    // Setup event listeners
    setupEventListeners();
    
    // Set greeting
    updateDashboardGreeting();
    
    // Check authentication
    const authenticatedStaff = authManager.check();

    if (authenticatedStaff) {
      console.log('✅ User is authenticated, showing dashboard');
      showDashboard(authenticatedStaff);
    }

    // Performance monitoring
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log(`⚡ Page loaded in ${Math.round(loadTime)}ms`);
        
        if (loadTime > 3000) {
          console.warn('⚠️ Slow page load detected');
        }
      });
    }
    
    console.log('✅ Initialization complete');
    
  } catch (error) {
    console.error('❌ Critical initialization error:', error);
    dashboard.showToast('System initialization failed', 'error');
  }
});

// ===== GLOBAL FUNCTION EXPORTS =====
window.navigate = navigate;
window.handleCardKeydown = handleCardKeydown;
window.logout = () => authManager.logout();
window.refreshDashboardStats = () => dashboard.refreshDashboardStats();
window.closeToast = () => dashboard.closeToast();

// Expose managers for debugging
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.debug = {
    dashboard,
    authManager,
    searchManager,
    themeManager,
    appState,
    dataLoader
  };
}

document.addEventListener('click', function (e) {
  const target = e.target.closest('button');
  if (!target) return;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = `${e.clientX - target.offsetLeft}px`;
  ripple.style.top = `${e.clientY - target.offsetTop}px`;
  target.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
});
