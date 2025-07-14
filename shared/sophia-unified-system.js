/**
 * Sophia College - Unified Data Management System
 * Shared library for all college management systems
 * FIXED VERSION - Resolves syntax errors and improves functionality
 */

class SophiaDataManager {
    constructor(config = {}) {
        this.config = {
            retryCount: 3,
            retryDelay: 1000,
            cacheTimeout: 30 * 60 * 1000, // 30 minutes
            ...config
        };
        
        this.cache = new Map();
        this.loadPromises = new Map();
        this.listeners = new Map();
        this.eventHandlers = new Map();
        
        // Initialize Firebase
        this.initFirebase();
        
        console.log('🚀 Sophia Data Manager initialized');
    }

    initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase SDK not loaded');
                return;
            }
            // Only initialize if not already initialized
            if (!firebase.apps.length) {
                firebase.initializeApp({
                    apiKey: 'AIzaSyD0yaJtrClhyXWjBqDmtdxdM2kWl8AvtKU',
                    authDomain: 'sophia-infringements.firebaseapp.com',
                    projectId: 'sophia-infringements',
                    databaseURL: 'https://sophia-infringements-default-rtdb.firebaseio.com/'
                });
            }
            this.db = firebase.firestore();
            console.log('✅ Firebase initialized');
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            // Don't throw error - allow system to work without Firebase
            this.db = null;
        }
    }

    // AUTHENTICATION MANAGEMENT
    async checkAuthentication() {
        const staff = JSON.parse(localStorage.getItem('loggedInStaff') || 'null');
        if (!staff) {
            throw new Error('Authentication required');
        }
        
        // Update staff name in UI if element exists
        const staffNameElement = document.getElementById('staffName');
        if (staffNameElement) {
            staffNameElement.textContent = staff['staff name'];
        }
        
        return staff;
    }

    logout() {
        this.cleanup();
        localStorage.removeItem('loggedInStaff');
        window.location.href = 'index.html';
    }

    async _loadWithRetry(filename, options, attempt = 1) {
        try {
            return await this._parseCSV(filename, options);
        } catch (error) {
            if (attempt < this.config.retryCount) {
                console.warn(`⚠️ Retry ${attempt}/${this.config.retryCount} for ${filename}`);
                await this._delay(this.config.retryDelay * attempt);
                return this._loadWithRetry(filename, options, attempt + 1);
            }
            console.error(`❌ All retries failed for ${filename}:`, error);
            throw error;
        }
    }

    async _parseCSV(filename, options) {
        const filePath = `/data/${filename}`;
        
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof Papa === 'undefined') {
                    reject(new Error('Papa Parse library not available'));
                    return;
                }

                console.log(`📁 Fetching CSV: ${filePath}`);

                // Use fetch API to get the file
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${filePath}`);
                }

                const csvText = await response.text();
                
                if (!csvText.trim()) {
                    throw new Error(`File ${filePath} is empty or invalid`);
                }

                console.log(`📄 File content loaded: ${csvText.length} characters`);

                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    complete: (results) => {
                        if (results.errors && results.errors.length > 0) {
                            console.warn(`⚠️ CSV parsing warnings for ${filename}:`, results.errors);
                        }
                        console.log(`✅ CSV parsed successfully: ${filename} (${results.data.length} rows)`);
                        resolve(results.data);
                    },
                    error: (error) => {
                        console.error(`❌ CSV parsing error for ${filename}:`, error);
                        reject(new Error(`Failed to parse ${filename}: ${error.message}`));
                    }
                });

            } catch (error) {
                console.error(`❌ Error loading ${filename}:`, error);
                reject(error);
            }
        });
    }

    // CSV Loading Method
    async loadCSV(filename, options = {}) {
        try {
            const cacheKey = `csv_${filename}`;
            
            // Return cached data if available and not expired
            if (this.cache.has(cacheKey) && !options.forceReload) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                    console.log(`📋 Using cached data for ${filename}`);
                    return cached.data;
                }
            }
            
            // Check if this file is already being loaded
            if (this.loadPromises.has(cacheKey)) {
                console.log(`⏳ Waiting for existing load of ${filename}`);
                return await this.loadPromises.get(cacheKey);
            }
            
            // Start loading with retry logic
            const loadPromise = this._loadWithRetry(filename, options);
            this.loadPromises.set(cacheKey, loadPromise);
            
            try {
                const data = await loadPromise;
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                return data;
            } finally {
                this.loadPromises.delete(cacheKey);
            }
        } catch (error) {
            console.error(`❌ Error loading CSV ${filename}:`, error);
            return [];
        }
    }

    // ENHANCED DATA LOADING METHODS
    async loadStudents() {
        try {
            const students = await this.loadCSV('students.csv');
            
            // Validate and clean student data
            return students.filter(student => 
                student.BCEID1 && 
                student.FirstName && 
                student.LegalSurname1
            ).map(student => ({
                ...student,
                fullName: `${student.FirstName} ${student.LegalSurname1}`,
                searchName: `${student.LegalSurname1}, ${student.FirstName}`.toLowerCase()
            }));
        } catch (error) {
            console.error('❌ Error loading students:', error);
            return [];
        }
    }

    async loadInfringementTypes() {
        try {
            const infringements = await this.loadCSV('infringements.csv');
            return infringements.map(item => item.infringements).filter(Boolean);
        } catch (error) {
            console.error('❌ Error loading infringement types:', error);
            return ['No Hat', 'Shirt', 'No Blazer', 'Belt', 'Shoes', 'Jewellery', 'Hair Acessories', 'Nails / Tan / Eyelashes', 'Facial Hair', 'Hair', 'Socks', 'Tie', 'Gum', 'No Diary', 'No Laptop', 'Missing key learning equipment', 'Trousers', 'Late to Class'];
        }
    }

    async loadOutOfClassReasons() {
        try {
            const reasons = await this.loadCSV('outofclass.csv');
            return reasons.map(item => item.outofclass).filter(Boolean);
        } catch (error) {
            console.error('❌ Error loading out of class reasons:', error);
            return ['Bathroom', 'Sick Bay', 'Office', 'Library', 'Other'];
        }
    }

    async loadTeachers() {
        try {
            const teachers = await this.loadCSV('BCEteacherinfo.csv');
            return teachers.filter(teacher => teacher.Stafffullname && teacher.BCEID);
        } catch (error) {
            console.error('❌ Error loading teachers:', error);
            return [];
        }
    }

    async loadParentEmails() {
        try {
            const parentData = await this.loadCSV('parentemail.csv');
            const parentEmails = {};
            
            parentData.forEach(item => {
                if (item.BCEID1 && item.ParentEmail) {
                    parentEmails[item.BCEID1] = {
                        email: item.ParentEmail,
                        name: `${item.ParentTitle || ''} ${item.ParentFirstName || ''} ${item.ParentSecondName || ''}`.trim() || 'Parent/Guardian'
                    };
                }
            });
            
            console.log('✅ Loaded parent emails for', Object.keys(parentEmails).length, 'students');
            return parentEmails;
        } catch (error) {
            console.error('❌ Error loading parent emails:', error);
            return {};
        }
    }

    async loadHouseCompanions() {
        try {
            const companionData = await this.loadCSV('housecompanions.csv');
            const companions = {};
            
            companionData.forEach(item => {
                // Handle different possible column names
                const houseName = item.House || item.house || item.HouseName;
                const companionName = item.Name || item.name || item.CompanionName || item.Companion;
                const companionEmail = item.Email || item.email || item.CompanionEmail;
                
                if (houseName) {
                    companions[houseName] = {
                        name: companionName || `${houseName} House Companion`,
                        email: companionEmail || ''
                    };
                }
            });
            
            console.log('✅ Loaded house companions for', Object.keys(companions).length, 'houses');
            
            // If no data loaded, provide fallback for common houses
            if (Object.keys(companions).length === 0) {
                console.log('⚠️ No house companion data found, using fallback');
                return {
                    'Aquinas': { name: 'Aquinas House Companion', email: '' },
                    'Becket': { name: 'Becket House Companion', email: '' },
                    'Catherine': { name: 'Catherine House Companion', email: '' },
                    'Dominic': { name: 'Dominic House Companion', email: '' },
                    'Francis': { name: 'Francis House Companion', email: '' },
                    'Gonzaga': { name: 'Gonzaga House Companion', email: '' }
                };
            }
            
            return companions;
        } catch (error) {
            console.error('❌ Error loading house companions:', error);
            // Return fallback data for common houses
            return {
                'Aquinas': { name: 'Aquinas House Companion', email: '' },
                'Becket': { name: 'Becket House Companion', email: '' },
                'Catherine': { name: 'Catherine House Companion', email: '' },
                'Dominic': { name: 'Dominic House Companion', email: '' },
                'Francis': { name: 'Francis House Companion', email: '' },
                'Gonzaga': { name: 'Gonzaga House Companion', email: '' }
            };
        }
    }

    // CONNECTION STATUS MONITORING
    listenToConnectionStatus(statusElement, textElement) {
        if (!statusElement || !textElement) {
            console.warn('Connection status elements not found');
            return;
        }

        // Initialize status as loading
        statusElement.className = 'connection-status loading';
        textElement.textContent = 'Connecting...';
        statusElement.style.display = 'block';

        // If Firebase Realtime Database is available, use it for connection monitoring
        if (typeof firebase !== 'undefined' && firebase.database) {
            try {
                const connectedRef = firebase.database().ref(".info/connected");
                connectedRef.on("value", (snap) => {
                    if (snap.val() === true) {
                        statusElement.className = 'connection-status online';
                        textElement.textContent = 'Connected';
                        statusElement.style.display = 'block';
                        setTimeout(() => { 
                            statusElement.style.display = 'none'; 
                        }, 3000);
                    } else {
                        statusElement.className = 'connection-status offline';
                        textElement.textContent = 'Offline';
                        statusElement.style.display = 'block';
                    }
                });
                console.log('✅ Firebase connection status monitoring enabled');
                return;
            } catch (error) {
                console.warn('Failed to setup Firebase connection monitoring:', error);
            }
        }
        
        // Fallback to basic network monitoring
        this.fallbackConnectionMonitor(statusElement, textElement);
    }

    fallbackConnectionMonitor(statusElement, textElement) {
        // Basic online/offline detection
        const updateStatus = () => {
            if (navigator.onLine) {
                statusElement.className = 'connection-status online';
                textElement.textContent = 'Online';
                setTimeout(() => { 
                    statusElement.style.display = 'none'; 
                }, 3000);
            } else {
                statusElement.className = 'connection-status offline';
                textElement.textContent = 'Offline';
                statusElement.style.display = 'block';
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        
        // Initial status check
        updateStatus();
        
        // Hide loading state after initial check
        setTimeout(() => {
            if (statusElement.className.includes('loading')) {
                updateStatus();
            }
        }, 2000);
        
        console.log('✅ Basic connection monitoring enabled');
    }

    // FIREBASE OPERATIONS
    async submitToFirebase(collection, data) {
        if (!this.db) {
            throw new Error('Firebase not available');
        }

        const staff = JSON.parse(localStorage.getItem('loggedInStaff') || '{}');
        
        const docData = {
            ...data,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            submittedBy: staff['staff name'] || 'Unknown Staff',
            submittedByEmail: staff.email || '',
            createdAt: new Date()
        };

        try {
            const docRef = await this.db.collection(collection).add(docData);
            console.log(`✅ Document added to ${collection} with ID:`, docRef.id);
            
            // Invalidate relevant caches
            this.invalidateCache(collection);
            
            return docRef.id;
        } catch (error) {
            console.error(`❌ Error adding document to ${collection}:`, error);
            throw error;
        }
    }

    subscribeToCollection(collection, whereClause, callback) {
        if (!this.db) {
            console.warn('Firebase not available for subscriptions');
            return () => {}; // Return empty unsubscribe function
        }

        try {
            let query = this.db.collection(collection);
            
            // Handle whereClause properly
            if (whereClause && typeof whereClause === 'object') {
                // If whereClause is an array of conditions
                if (Array.isArray(whereClause)) {
                    whereClause.forEach(condition => {
                        if (condition.length === 3) {
                            query = query.where(condition[0], condition[1], condition[2]);
                        }
                    });
                } else {
                    // If whereClause is an object like { status: 'out' }
                    for (const [field, value] of Object.entries(whereClause)) {
                        if (value !== undefined && value !== null) {
                            query = query.where(field, '==', value);
                        }
                    }
                }
            }

            const unsubscribe = query.onSnapshot(callback, (error) => {
                console.error(`❌ Subscription error for ${collection}:`, error);
            });

            // Store unsubscribe function for cleanup
            const subscriptionId = `${collection}_${Date.now()}`;
            this.listeners.set(subscriptionId, unsubscribe);

            return unsubscribe;
        } catch (error) {
            console.error(`❌ Error setting up subscription for ${collection}:`, error);
            return () => {};
        }
    }

    // UI HELPER METHODS
    populateSelect(selectId, options, placeholder = 'Select...') {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`Select element with ID '${selectId}' not found`);
            return;
        }

        // Clear existing options
        select.innerHTML = `<option value="">${placeholder}</option>`;

        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        console.log(`✅ Populated select '${selectId}' with ${options.length} options`);
    }

    createFilterDropdowns(students) {
        const homeGroups = [...new Set(students.map(s => s.HomeGroup).filter(Boolean))].sort();
        const houses = [...new Set(students.map(s => s.HouseName).filter(Boolean))].sort();
        const yearLevels = [...new Set(students.map(s => s.YearLevelName || s.YearLevel).filter(Boolean))].sort();

        return { homeGroups, houses, yearLevels };
    }

    showToast(message, type = 'info', duration = 4000) {
        // Use UnifiedToast if available, otherwise create simple toast
        if (window.UnifiedToast && typeof window.UnifiedToast.show === 'function') {
            window.UnifiedToast.show(message, type, duration);
            return;
        }

        // Fallback toast implementation
        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.style.cssText = `
            position: fixed; top: 90px; right: 20px; 
            background: white; border: 1px solid #ddd; 
            padding: 16px 20px; border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            z-index: 10000; max-width: 400px;
            transform: translateX(450px); 
            transition: transform 0.3s ease;
        `;

        const colors = {
            success: '#059669',
            error: '#dc2626',
            warning: '#d97706',
            info: '#0284c7'
        };

        toast.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Remove after duration
        setTimeout(() => {
            toast.style.transform = 'translateX(450px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // DATE AND TIME UTILITIES
    dateFilter(date, filterType) {
        if (!date || !filterType) return true;
        
        const now = new Date();
        const itemDate = date instanceof Date ? date : new Date(date);
        
        if (isNaN(itemDate.getTime())) return false;
        
        switch (filterType) {
            case 'today':
                return this.isSameDay(itemDate, now);
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return itemDate >= weekAgo;
            case 'month':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return itemDate >= monthAgo;
            default:
                return true;
        }
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    formatDate(dateObj) {
        try {
            const validDate = dateObj instanceof Date ? dateObj : new Date(dateObj);
            if (isNaN(validDate.getTime())) {
                console.warn('formatDate received unparseable value:', dateObj);
                return 'Invalid Date';
            }
            return new Intl.DateTimeFormat('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(validDate);
        } catch (error) {
            console.error('Error formatting date:', dateObj, error);
            return 'Error Date';
        }
    }

    // PERFORMANCE UTILITIES
    debounce(func, wait) {
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

    sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => {
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[match];
        });
    }

    // UTILITY METHODS
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    invalidateCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
            console.log(`🗑️ Cache invalidated for pattern: ${pattern}`);
        } else {
            this.cache.clear();
            console.log('🗑️ All cache cleared');
        }
    }

    // CLEANUP
    cleanup() {
        // Unsubscribe from Firebase listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();

        // Clear caches
        this.cache.clear();
        this.loadPromises.clear();

        console.log('🧹 Sophia Data Manager cleanup completed');
    }

    // STATISTICS & MONITORING
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            listeners: this.listeners.size
        };
    }

    // DEVELOPMENT HELPERS
    getSystemStats() {
        return {
            cacheStats: this.getCacheStats(),
            config: this.config,
            isFirebaseConnected: !!this.db
        };
    }
}

// SPECIALIZED MODULES FOR EACH SYSTEM

class StaffInfringementModule {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.selectedStudents = [];
    }

    async initialize() {
        console.log('📝 Initializing Staff Infringement Module...');
        
        try {
            await this.dataManager.checkAuthentication();
            await this.loadData();
            this.setupUI();
            this.setupEventListeners();
            console.log('✅ Staff Infringement Module ready');
        } catch (error) {
            console.error('❌ Staff module initialization failed:', error);
            throw error;
        }
    }

    async loadData() {
        console.log('📚 Loading staff module data...');
        
        const [students, infringementTypes] = await Promise.all([
            this.dataManager.loadStudents(),
            this.dataManager.loadInfringementTypes()
        ]);

        this.students = students;
        this.infringementTypes = infringementTypes;

        // Setup filters
        const filters = this.dataManager.createFilterDropdowns(students);
        this.dataManager.populateSelect('homegroupFilter', filters.homeGroups, 'All Homegroups');
        this.dataManager.populateSelect('houseFilter', filters.houses, 'All Houses');
        this.dataManager.populateSelect('yearFilter', filters.yearLevels, 'All Years');
        this.dataManager.populateSelect('infringementSelect', infringementTypes, 'Select infringement type...');
    }

    setupUI() {
        // UI setup will be handled by individual pages
        console.log('🎨 Staff module UI ready');
    }

    setupEventListeners() {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitInfringement());
        }
    }

    selectStudent(student) {
        if (!this.selectedStudents.find(s => s.BCEID1 === student.BCEID1)) {
            this.selectedStudents.push(student);
            this.updateSelectedStudentsDisplay();
        }
    }

    removeStudent(studentId) {
        this.selectedStudents = this.selectedStudents.filter(s => s.BCEID1 !== studentId);
        this.updateSelectedStudentsDisplay();
    }

    updateSelectedStudentsDisplay() {
        // This will be implemented by the individual pages
        console.log(`📋 Selected students: ${this.selectedStudents.length}`);
    }

    async submitInfringement() {
        const selectedStudentIds = this.selectedStudents.map(s => s.BCEID1);
        const infringementType = document.getElementById('infringementSelect')?.value;

        if (selectedStudentIds.length === 0 || !infringementType) {
            this.dataManager.showToast('Please select students and infringement type', 'error');
            return;
        }

        try {
            const submissions = selectedStudentIds.map(studentId => {
                const student = this.selectedStudents.find(s => s.BCEID1 === studentId);
                return this.dataManager.submitToFirebase('infringements', {
                    studentBCEID: studentId,
                    studentName: student ? student.fullName : 'Unknown',
                    infringementType: infringementType,
                    studentHouse: student?.HouseName || '',
                    studentYearLevel: student?.YearLevelName || student?.YearLevel || '',
                    staffName: JSON.parse(localStorage.getItem('loggedInStaff') || '{}')['staff name'] || 'Unknown Staff'
                });
            });

            await Promise.all(submissions);
            this.dataManager.showToast(`Infringement logged for ${selectedStudentIds.length} students`, 'success');
            
            // Reset form
            this.selectedStudents = [];
            this.updateSelectedStudentsDisplay();
            
        } catch (error) {
            console.error('Error logging infringement:', error);
            this.dataManager.showToast('Error logging infringement', 'error');
        }
    }
}

class OutOfClassModule {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.selectedStudent = null;
    }

    async initialize() {
        console.log('🏫 Initializing Out of Class Module...');
        
        try {
            await this.dataManager.checkAuthentication();
            await this.loadData();
            this.setupRealtimeMonitoring();
            console.log('✅ Out of Class Module ready');
        } catch (error) {
            console.error('❌ Out of class module initialization failed:', error);
            throw error;
        }
    }

    async loadData() {
        console.log('📚 Loading out of class module data...');
        
        const [students, reasons] = await Promise.all([
            this.dataManager.loadStudents(),
            this.dataManager.loadOutOfClassReasons()
        ]);

        this.students = students;
        this.dataManager.populateSelect('reasonSelect', reasons, 'Select reason...');
    }

    setupRealtimeMonitoring() {
        // Monitor active incidents
        this.dataManager.subscribeToCollection('outofclass', { status: 'out' }, (snapshot) => {
            this.updateActiveIncidents(snapshot);
        });
    }

    updateActiveIncidents(snapshot) {
        console.log('📊 Updating active incidents:', snapshot.size);
        
        const grid = document.getElementById('activeIncidentsGrid');
        if (!grid) return;
        
        if (snapshot.empty) {
            grid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No active incidents</div>';
            return;
        }
        
        grid.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
            
            return `
                <div class="incident-card">
                    <strong>${data.studentName || 'Unknown Student'}</strong>
                    <div style="font-size: 0.85em; color: var(--text-light); margin: 4px 0;">
                        ${data.reason || 'No reason specified'}
                    </div>
                    <div style="font-size: 0.8em; color: var(--text-muted);">
                        ${timestamp.toLocaleTimeString()}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    showStudentProfile(student) {
        console.log('👤 Showing profile for:', student.FirstName, student.LegalSurname1);
        
        const profile = document.getElementById('studentProfile');
        if (!profile) return;
        
        // Update profile information
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value || 'N/A';
        };
        
        updateElement('studentNameDetail', `${student.FirstName} ${student.LegalSurname1}`);
        updateElement('studentBCE', student.BCEID1);
        updateElement('studentHouse', student.HouseName);
        updateElement('studentHomeGroup', student.HomeGroup);
        updateElement('studentYear', student.YearLevelName || student.YearLevel);
        
        // Show profile with animation
        profile.classList.add('visible');
        profile.style.display = 'block';
    }

    async submitOutOfClass() {
        if (!this.selectedStudent) {
            this.dataManager.showToast('Please select a student', 'error');
            return;
        }

        const reason = document.getElementById('reasonSelect')?.value;
        const details = document.getElementById('detailsInput')?.value || '';

        if (!reason) {
            this.dataManager.showToast('Please select a reason', 'error');
            return;
        }

        try {
            await this.dataManager.submitToFirebase('outofclass', {
                studentBCEID: this.selectedStudent.BCEID1,
                studentName: `${this.selectedStudent.FirstName} ${this.selectedStudent.LegalSurname1}`,
                reason,
                details,
                status: 'out',
                studentHouse: this.selectedStudent.HouseName || '',
                studentYearLevel: this.selectedStudent.YearLevelName || this.selectedStudent.YearLevel || '',
                staffName: JSON.parse(localStorage.getItem('loggedInStaff') || '{}')['staff name'] || 'Unknown Staff'
            });

            this.dataManager.showToast('Out-of-class incident logged successfully', 'success');
            
            // Reset form
            const form = document.getElementById('incidentForm');
            if (form) form.reset();
            
            const hiddenInput = document.getElementById('selectedStudentId');
            if (hiddenInput) hiddenInput.value = '';
            
            this.selectedStudent = null;
            
            const profile = document.getElementById('studentProfile');
            if (profile) {
                profile.classList.remove('visible');
                profile.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error logging incident:', error);
            this.dataManager.showToast('Error logging incident', 'error');
        }
    }
}

// GLOBAL INITIALIZATION WITH PROPER ERROR HANDLING
class SophiaSystem {
    constructor() {
        this.dataManager = null;
        this.module = null;
        console.log('🚀 Sophia System constructor called');
    }
    
    async initialize() {
        try {
            console.log('🔄 Initializing Sophia System...');
            this.dataManager = new SophiaDataManager();
            console.log('✅ Sophia System initialized');
            return this.dataManager;
        } catch (error) {
            console.error('❌ SophiaSystem initialization failed:', error);
            throw error;
        }
    }
    
    async initializeSystem(systemType) {
        try {
            console.log(`🚀 Initializing system type: ${systemType}`);
            
            // Create shared data manager if not already created
            if (!this.dataManager) {
                this.dataManager = new SophiaDataManager();
            }
            
            // Initialize system-specific module
            switch (systemType) {
                case 'staff':
                    this.module = new StaffInfringementModule(this.dataManager);
                    await this.module.initialize();
                    break;
                    
                case 'outofclass':
                    this.module = new OutOfClassModule(this.dataManager);
                    await this.module.initialize();
                    break;
                    
                case 'reengagement':
                    // For re-engagement system, just provide data access
                    console.log('✅ Re-engagement system data manager ready');
                    break;
                    
                default:
                    console.warn(`⚠️ Unknown system type: ${systemType}, providing basic data manager`);
                    break;
            }
            
            console.log(`✅ System ${systemType} initialized successfully`);
            
        } catch (error) {
            console.error(`❌ System ${systemType} initialization failed:`, error);
            if (this.dataManager) {
                this.dataManager.showToast(`Initialization failed: ${error.message}`, 'error');
            }
            // Don't throw error - allow system to continue with degraded functionality
        }
    }
    
    logout() {
        if (this.dataManager) {
            this.dataManager.logout();
        } else {
            localStorage.removeItem('loggedInStaff');
            window.location.href = 'index.html';
        }
    }
    
    // Provide access to data manager for pages that need it
    getDataManager() {
        return this.dataManager;
    }
    
    // Provide access to module for pages that need it
    getModule() {
        return this.module;
    }
}

// Create single global instance
if (typeof window !== 'undefined') {
    window.SophiaSystem = new SophiaSystem();
    console.log('✅ Sophia College Unified Data Management System loaded and instantiated');
}

// Development helpers
if (typeof window !== 'undefined') {
    window.getSophiaStats = () => {
        if (window.SophiaSystem?.dataManager) {
            return window.SophiaSystem.dataManager.getSystemStats();
        }
        return { status: 'SophiaSystem not initialized' };
    };
    
    window.clearSophiaCache = () => {
        if (window.SophiaSystem?.dataManager) {
            window.SophiaSystem.dataManager.invalidateCache();
            return 'Cache cleared';
        }
        return 'SophiaSystem not available';
    };
}
