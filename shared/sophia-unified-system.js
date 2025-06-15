/**
 * Sophia College - Unified Data Management System
 * Shared library for all college management systems
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
            firebase.initializeApp({
                apiKey: 'AIzaSyD0yaJtrClhyXWjBqDmtdxdM2kWl8AvtKU',
                authDomain: 'sophia-infringements.firebaseapp.com',
                projectId: 'sophia-infringements'
            });
            this.db = firebase.firestore();
            console.log('✅ Firebase initialized');
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            throw error;
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

    // ENHANCED CSV DATA LOADING
    async loadCSV(filename, options = {}) {
        const cacheKey = `csv_${filename}`;
        
        // Return cached data if available and not expired
        if (this.cache.has(cacheKey) && !options.forceReload) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                console.log(`📋 Using cached data for ${filename}`);
                return cached.data;
            }
        }

        // Return existing promise if already loading
        if (this.loadPromises.has(cacheKey)) {
            return this.loadPromises.get(cacheKey);
        }

        const loadPromise = this._loadWithRetry(filename, options);
        this.loadPromises.set(cacheKey, loadPromise);

        try {
            const data = await loadPromise;
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            console.log(`✅ Loaded and cached ${filename}: ${data.length} records`);
            return data;
        } finally {
            this.loadPromises.delete(cacheKey);
        }
    }

    async _loadWithRetry(filename, options, attempt = 1) {
        try {
            return await this._parseCSV(filename, options);
        } catch (error) {
            if (attempt < this.config.retryCount) {
                console.warn(`⚠️ Retry ${attempt}/${this.config.retryCount} for ${filename}`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
                return this._loadWithRetry(filename, options, attempt + 1);
            }
            throw new Error(`Failed to load ${filename} after ${this.config.retryCount} attempts: ${error.message}`);
        }
    }

    _parseCSV(filename, options) {
        return new Promise((resolve, reject) => {
            if (typeof Papa === 'undefined') {
                reject(new Error('Papa Parse library not available'));
                return;
            }

            Papa.parse(filename, {
                download: true,
                header: true,
                skipEmptyLines: true,
                trimHeaders: true,
                dynamicTyping: true,
                transformHeader: (header) => header.trim(),
                ...options,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn(`⚠️ CSV parsing warnings for ${filename}:`, results.errors);
                    }
                    resolve(results.data);
                },
                error: reject
            });
        });
    }

    // CORE DATA LOADERS
    async loadStudents() {
        try {
            const students = await this.loadCSV('students.csv');
            return students.filter(s => s.FirstName && s.LegalSurname1 && s.BCEID1);
        } catch (error) {
            console.error('❌ Error loading students:', error);
            return [];
        }
    }

    async loadTeachers() {
        try {
            const teachersData = await this.loadCSV('BCEteacherinfo.csv');
            const teachers = [];
            const teacherEmails = {};

            teachersData.forEach(teacher => {
                if (teacher.Stafffullname && teacher.BCEID) {
                    const teacherName = `${teacher.Stafffullname} (${teacher.BCEID})`;
                    teachers.push(teacherName);
                    teacherEmails[teacherName] = teacher.Staffemail || '';
                }
            });

            return { teachers: teachers.sort(), teacherEmails };
        } catch (error) {
            console.error('❌ Error loading teachers:', error);
            return { teachers: [], teacherEmails: {} };
        }
    }

    async loadParentEmails() {
        try {
            const parentData = await this.loadCSV('parentemail.csv');
            const parentEmails = {};
            
            parentData.forEach(parent => {
                if (parent.BCEID1 && parent.ParentEmail) {
                    parentEmails[parent.BCEID1] = {
                        email: parent.ParentEmail,
                        name: [
                            parent.ParentTitle,
                            parent.ParentFirstName,
                            parent.ParentSecondName
                        ].filter(Boolean).join(' ')
                    };
                }
            });
            
            return parentEmails;
        } catch (error) {
            console.error('❌ Error loading parent emails:', error);
            return {};
        }
    }

    async loadHouseCompanions() {
        try {
            const houseData = await this.loadCSV('housecompanions.csv');
            const houseCompanions = {};
            
            houseData.forEach(companion => {
                const houseField = companion.housegroup || companion.HouseName;
                const emailField = companion.email || companion.Email;
                const nameField = companion['staff name'] || companion['Staff Name'];

                if (houseField && emailField) {
                    houseCompanions[houseField] = {
                        email: emailField,
                        name: nameField || ''
                    };
                }
            });
            
            return houseCompanions;
        } catch (error) {
            console.error('❌ Error loading house companions:', error);
            return {};
        }
    }

    async loadClassrooms() {
        try {
            const barcodesData = await this.loadCSV('Barcodelocations.csv');
            return [...new Set(
                barcodesData
                    .map(item => item.Title)
                    .filter(Boolean)
            )].sort();
        } catch (error) {
            console.error('❌ Error loading classrooms:', error);
            return [];
        }
    }

    async loadLearningAreas() {
        try {
            const learningData = await this.loadCSV('Learningareacategory.csv');
            return [...new Set(
                learningData
                    .map(item => item['Learning Area Category'])
                    .filter(Boolean)
            )].sort();
        } catch (error) {
            console.error('❌ Error loading learning areas:', error);
            return [];
        }
    }

    async loadInfringementTypes() {
        try {
            const infringementData = await this.loadCSV('infringements.csv');
            return infringementData
                .map(row => row[Object.keys(row)[0]])
                .filter(Boolean)
                .sort();
        } catch (error) {
            console.error('❌ Error loading infringement types:', error);
            return [];
        }
    }

    async loadOutOfClassReasons() {
        try {
            const reasonsData = await this.loadCSV('outofclass.csv');
            const reasonField = Object.keys(reasonsData[0])[0];
            return [...new Set(
                reasonsData
                    .map(row => row[reasonField])
                    .filter(Boolean)
            )].sort();
        } catch (error) {
            console.error('❌ Error loading out-of-class reasons:', error);
            return ['Library', 'Toilet', 'Drink', 'Other'];
        }
    }

    async loadBehaviorTypes() {
        try {
            const behaviorData = await this.loadCSV('BehaviourList.csv');
            return behaviorData
                .map(item => item['Behaviour'] || item['behavior'])
                .filter(Boolean)
                .sort();
        } catch (error) {
            console.error('❌ Error loading behavior types:', error);
            return [];
        }
    }

    // STUDENT SEARCH FUNCTIONALITY
    createStudentSearch(inputId, dropdownId, callback) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        
        if (!input || !dropdown) {
            console.error(`Student search elements not found: ${inputId}, ${dropdownId}`);
            return;
        }

        // Store search cache
        const searchCache = new Map();
        
        const debouncedSearch = this.debounce(async (searchTerm) => {
            if (searchTerm.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            // Check cache
            const cacheKey = `search_${searchTerm}`;
            let results;
            
            if (searchCache.has(cacheKey)) {
                results = searchCache.get(cacheKey);
            } else {
                const students = await this.loadStudents();
                results = this.fuzzySearchStudents(students, searchTerm);
                searchCache.set(cacheKey, results);
            }

            this.displaySearchResults(dropdown, results, callback);
        }, 300);

        // Event listeners
        input.addEventListener('input', (e) => debouncedSearch(e.target.value.toLowerCase().trim()));
        input.addEventListener('focus', () => {
            if (input.value.length >= 2) {
                dropdown.style.display = 'block';
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        return { input, dropdown, searchCache };
    }

    fuzzySearchStudents(students, searchTerm) {
        return students.filter(student => {
            const fullName = `${student.FirstName} ${student.LegalSurname1}`.toLowerCase();
            const reverseName = `${student.LegalSurname1}, ${student.FirstName}`.toLowerCase();
            const bceid = student.BCEID1.toLowerCase();

            return fullName.includes(searchTerm) || 
                   reverseName.includes(searchTerm) || 
                   bceid.includes(searchTerm);
        }).slice(0, 10);
    }

    displaySearchResults(dropdown, students, callback) {
        dropdown.innerHTML = '';

        if (students.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'student-option no-results';
            noResults.textContent = 'No students found';
            noResults.style.cssText = `
                padding: 12px;
                color: #666;
                font-style: italic;
            `;
            dropdown.appendChild(noResults);
        } else {
            students.forEach(student => {
                const option = document.createElement('div');
                option.className = 'student-option';
                option.innerHTML = `
                    <div style="font-weight: 600;">${this.sanitizeHTML(student.FirstName)} ${this.sanitizeHTML(student.LegalSurname1)}</div>
                    <div style="font-size: 0.875rem; color: #666;">${this.sanitizeHTML(student.BCEID1)} • ${this.sanitizeHTML(student.HouseName || 'No House')}</div>
                `;
                option.style.cssText = `
                    padding: 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    transition: background-color 0.2s ease;
                `;
                
                option.addEventListener('click', () => {
                    dropdown.style.display = 'none';
                    callback(student);
                });
                
                option.addEventListener('mouseenter', () => {
                    option.style.backgroundColor = '#f0f7ff';
                });
                
                option.addEventListener('mouseleave', () => {
                    option.style.backgroundColor = '';
                });
                
                dropdown.appendChild(option);
            });
        }

        dropdown.style.display = 'block';
    }

    // FORM UTILITIES
    populateSelect(selectId, options, placeholder = '-- Select --') {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`Select element ${selectId} not found`);
            return;
        }

        select.innerHTML = `<option value="">${placeholder}</option>`;

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
    }

    createFilterDropdowns(students) {
        const filters = {
            houses: [...new Set(students.map(s => s.HouseName).filter(Boolean))].sort(),
            homeGroups: [...new Set(students.map(s => s.HomeGroup).filter(Boolean))].sort(),
            yearLevels: [...new Set(students.map(s => s.YearLevelName).filter(Boolean))].sort()
        };

        return filters;
    }

    // FIREBASE UTILITIES
    async submitToFirebase(collection, data) {
        try {
            const staff = await this.checkAuthentication();
            const submissionData = {
                ...data,
                staff: staff['staff name'],
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(collection).add(submissionData);
            console.log(`✅ Document written to ${collection} with ID: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error(`❌ Error writing to ${collection}:`, error);
            throw error;
        }
    }

    subscribeToCollection(collection, filters, callback) {
        try {
            let query = this.db.collection(collection);
            
            // Apply filters
            if (filters) {
                Object.entries(filters).forEach(([field, value]) => {
                    if (value !== null && value !== undefined) {
                        query = query.where(field, '==', value);
                    }
                });
            }

            const unsubscribe = query.onSnapshot(callback, error => {
                console.error(`❌ Subscription error for ${collection}:`, error);
            });

            // Store unsubscribe function
            const key = `${collection}_${Date.now()}`;
            this.listeners.set(key, unsubscribe);
            
            return key;
        } catch (error) {
            console.error(`❌ Error subscribing to ${collection}:`, error);
            throw error;
        }
    }

    // NOTIFICATION SYSTEM
    showToast(message, type = 'info', duration = 4000) {
        // Remove existing toasts of same type
        document.querySelectorAll(`.toast-${type}`).forEach(toast => toast.remove());

        const colors = {
            info: '#2196F3',
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
        `;

        toast.textContent = message;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 10px;
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            opacity: 0.7;
        `;
        closeBtn.onclick = () => toast.remove();
        toast.appendChild(closeBtn);

        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Auto remove
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // UTILITY FUNCTIONS
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

    sanitizeHTML(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
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

    async clearCache() {
        this.cache.clear();
        this.loadPromises.clear();
        console.log('🗑️ Cache cleared');
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
        await this.dataManager.checkAuthentication();
        await this.loadData();
        this.setupUI();
        this.setupEventListeners();
    }

    async loadData() {
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
        // Create student search
        this.dataManager.createStudentSearch('searchInput', 'studentDropdown', (student) => {
            this.selectStudent(student);
        });
    }

    setupEventListeners() {
        document.getElementById('submitBtn')?.addEventListener('click', () => this.submitInfringement());
    }

    async submitInfringement() {
        const selectedStudentIds = this.selectedStudents.map(s => s.BCEID1);
        const infringementType = document.getElementById('infringementSelect')?.value;

        if (selectedStudentIds.length === 0 || !infringementType) {
            this.dataManager.showToast('Please select students and infringement type', 'error');
            return;
        }

        try {
            const submissions = selectedStudentIds.map(studentId => 
                this.dataManager.submitToFirebase('infringements', {
                    student: studentId,
                    infringement: infringementType
                })
            );

            await Promise.all(submissions);
            this.dataManager.showToast(`Infringement logged for ${selectedStudentIds.length} students`, 'success');
        } catch (error) {
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
        await this.dataManager.checkAuthentication();
        await this.loadData();
        this.setupUI();
        this.setupRealtimeMonitoring();
    }

    async loadData() {
        const [students, reasons] = await Promise.all([
            this.dataManager.loadStudents(),
            this.dataManager.loadOutOfClassReasons()
        ]);

        this.students = students;
        this.dataManager.populateSelect('reasonSelect', reasons, 'Select reason...');
    }

    setupUI() {
        this.dataManager.createStudentSearch('searchInput', 'studentDropdown', (student) => {
            this.selectedStudent = student;
            this.showStudentProfile(student);
        });
    }

    setupRealtimeMonitoring() {
        // Monitor active incidents
        this.dataManager.subscribeToCollection('outofclass', { status: 'out' }, (snapshot) => {
            this.updateActiveIncidents(snapshot);
        });
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
                student: this.selectedStudent.BCEID1,
                reason,
                details,
                status: 'out'
            });

            this.dataManager.showToast('Out-of-class incident logged successfully', 'success');
        } catch (error) {
            this.dataManager.showToast('Error logging incident', 'error');
        }
    }
}

// GLOBAL INITIALIZATION
window.SophiaSystem = {
    dataManager: null,
    
    async initializeSystem(systemType) {
        try {
            // Create shared data manager
            this.dataManager = new SophiaDataManager();
            
            // Initialize system-specific module
            switch (systemType) {
                case 'staff':
                    this.module = new StaffInfringementModule(this.dataManager);
                    break;
                case 'outofclass':
                    this.module = new OutOfClassModule(this.dataManager);
                    break;
                default:
                    throw new Error(`Unknown system type: ${systemType}`);
            }
            
            await this.module.initialize();
            this.dataManager.showToast('System initialized successfully!', 'success');
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            if (this.dataManager) {
                this.dataManager.showToast(`Initialization failed: ${error.message}`, 'error');
            }
        }
    },
    
    logout: () => window.SophiaSystem.dataManager?.logout()
};

console.log('✅ Sophia College Unified Data Management System loaded');