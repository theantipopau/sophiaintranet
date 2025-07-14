/**
 * Sophia College Re-Engagement Room System - ENHANCED VERSION
 * Optimized with modern JavaScript, better performance, and enhanced features
 */

console.log('🚀 Enhanced Re-Engagement Room System Loading...');

// Enhanced utility functions
const Utils = {
    // Debounce function for search optimization
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
    },

    // Sanitize input to prevent XSS
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    // Deep clone objects
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Format date consistently
    formatDate(date) {
        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    },

    // Generate unique IDs
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Fuzzy search implementation
    fuzzySearch(needle, haystack, threshold = 0.6) {
        const similarity = (a, b) => {
            const longer = a.length > b.length ? a : b;
            const shorter = a.length > b.length ? b : a;
            const editDistance = this.levenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / longer.length;
        };
        
        return haystack.filter(item => {
            const searchText = typeof item === 'string' ? item : JSON.stringify(item);
            return similarity(needle.toLowerCase(), searchText.toLowerCase()) >= threshold;
        });
    },

    levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[b.length][a.length];
    }
};

// Enhanced Data Manager
class DataManager {
    constructor() {
        this.cache = new Map();
        this.loadPromises = new Map();
        this.retryCount = 3;
        this.retryDelay = 1000;
    }

    async loadCSV(filename, options = {}) {
        const cacheKey = `csv_${filename}`;
        
        // Return cached data if available
        if (this.cache.has(cacheKey) && !options.forceReload) {
            console.log(`📋 Using cached data for ${filename}`);
            return this.cache.get(cacheKey);
        }

        // Return existing promise if already loading
        if (this.loadPromises.has(cacheKey)) {
            return this.loadPromises.get(cacheKey);
        }

        const loadPromise = this._loadWithRetry(filename, options);
        this.loadPromises.set(cacheKey, loadPromise);

        try {
            const data = await loadPromise;
            this.cache.set(cacheKey, data);
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
            if (attempt < this.retryCount) {
                console.warn(`⚠️ Retry ${attempt}/${this.retryCount} for ${filename}`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                return this._loadWithRetry(filename, options, attempt + 1);
            }
            throw new Error(`Failed to load ${filename} after ${this.retryCount} attempts: ${error.message}`);
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

    clearCache() {
        this.cache.clear();
        console.log('🗑️ Data cache cleared');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Enhanced Toast Manager
class ToastManager {
    constructor() {
        this.toasts = new Map();
        this.defaultDuration = 4000;
        this.maxToasts = 5;
    }

    show(message, type = 'info', duration = this.defaultDuration, actions = null) {
        const id = Utils.generateId();
        const toast = this._createToast(id, message, type, duration, actions);
        
        this.toasts.set(id, toast);
        this._limitToasts();
        
        setTimeout(() => this.remove(id), duration);
        return id;
    }

    _createToast(id, message, type, duration, actions) {
        const colors = {
            info: '#2196F3',
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800'
        };

        const toastElement = document.createElement('div');
        toastElement.id = `toast-${id}`;
        toastElement.className = `toast toast-${type}`;
        toastElement.style.cssText = `position: fixed;
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
max-width: 300px;
word-wrap: break-word;
margin-bottom: 10px;`;

        // Add message
        const messageSpan = document.createElement('span');
        messageSpan.textContent = Utils.sanitizeInput(message);
        toastElement.appendChild(messageSpan);

        // Add actions if provided
        if (actions) {
            const actionsDiv = document.createElement('div');
            actionsDiv.style.marginTop = '10px';
            
            actions.forEach(action => {
                const button = document.createElement('button');
                button.textContent = action.text;
                button.style.cssText = `
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 4px 12px;
                    margin-right: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                `;
                button.onclick = () => {
                    action.callback();
                    this.remove(id);
                };
                actionsDiv.appendChild(button);
            });
            
            toastElement.appendChild(actionsDiv);
        }

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
        closeBtn.onclick = () => this.remove(id);
        toastElement.appendChild(closeBtn);

        document.body.appendChild(toastElement);
        
        // Animate in
        requestAnimationFrame(() => {
            toastElement.style.transform = 'translateX(0)';
        });

        return {
            element: toastElement,
            type,
            timestamp: Date.now()
        };
    }

    remove(id) {
        const toast = this.toasts.get(id);
        if (!toast) return;

        toast.element.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.toasts.delete(id);
        }, 300);
    }

    _limitToasts() {
        if (this.toasts.size > this.maxToasts) {
            const oldest = Array.from(this.toasts.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            this.remove(oldest[0]);
        }
    }

    clear() {
        this.toasts.forEach((_, id) => this.remove(id));
    }
}

// Enhanced Form Validator
class FormValidator {
    constructor() {
        this.rules = new Map();
        this.errors = new Map();
    }

    addRule(fieldId, validator, message) {
        if (!this.rules.has(fieldId)) {
            this.rules.set(fieldId, []);
        }
        this.rules.get(fieldId).push({ validator, message });
    }

    validate(formData) {
        this.errors.clear();
        let isValid = true;

        for (const [fieldId, rules] of this.rules) {
            const value = formData[fieldId];
            
            for (const rule of rules) {
                if (!rule.validator(value, formData)) {
                    this.errors.set(fieldId, rule.message);
                    isValid = false;
                    break;
                }
            }
        }

        return isValid;
    }

    getErrors() {
        return Object.fromEntries(this.errors);
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Remove existing error
        this.clearFieldError(fieldId);

        // Add error styling
        field.style.borderColor = '#f44336';
        field.setAttribute('aria-invalid', 'true');

        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.id = `${fieldId}-error`;
        errorDiv.className = 'field-error';
        errorDiv.style.cssText = `
            color: #f44336;
            font-size: 0.875rem;
            margin-top: 4px;
            display: block;
        `;
        errorDiv.textContent = message;

        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '';
            field.removeAttribute('aria-invalid');
        }

        const errorDiv = document.getElementById(`${fieldId}-error`);
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    clearAllErrors() {
        this.errors.forEach((_, fieldId) => this.clearFieldError(fieldId));
        this.errors.clear();
    }
}

// Enhanced Re-Engagement Room System
class ReEngagementRoomSystem {
    constructor() {
        this.dataManager = new DataManager();
        this.toastManager = new ToastManager();
        this.formValidator = new FormValidator();
        
        this.data = {
            students: [],
            classrooms: [],
            teachers: [],
            teacherEmails: {},
            learningAreas: [],
            parentEmails: {},
            houseCompanions: {},
            behaviorTypes: []
        };

        this.state = {
            selectedStudent: null,
            pendingFormData: null,
            isLoading: false,
            currentTab: 'submit',
            searchCache: new Map()
        };

        this.eventListeners = new Map();
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Enhanced Re-Engagement Room System...');
        
        try {
            this.showLoadingState(true);
            await this.checkAuthentication();
            this.setupFormValidation();
            this.setupEventListeners();
            await this.loadAllData();
            this.setupUI();
            this.toastManager.show('✅ System initialized successfully!', 'success');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.toastManager.show(`❌ Initialization failed: ${error.message}`, 'error');
        } finally {
            this.showLoadingState(false);
        }
    }

    checkAuthentication() {
        const staff = JSON.parse(localStorage.getItem('loggedInStaff') || 'null');
        if (!staff) {
            throw new Error('No authentication found');
        }

        console.log('✅ Staff authenticated:', staff['staff name']);
        const staffNameElement = document.getElementById('staffName');
        if (staffNameElement) {
            staffNameElement.textContent = staff['staff name'];
        }

        return staff;
    }

    setupFormValidation() {
        // Add validation rules
        this.formValidator.addRule('selectedStudentId', 
            value => value && value.trim() !== '', 
            'Please select a student'
        );
        
        this.formValidator.addRule('lessonSelect', 
            value => value && value.trim() !== '', 
            'Please select a lesson period'
        );
        
        this.formValidator.addRule('classroomSelect', 
            value => value && value.trim() !== '', 
            'Please select a classroom'
        );
        
        this.formValidator.addRule('teacherSelect', 
            value => value && value.trim() !== '', 
            'Please select a teacher'
        );
        
        this.formValidator.addRule('learningAreaSelect', 
            value => value && value.trim() !== '', 
            'Please select a subject area'
        );
        
        this.formValidator.addRule('referralType', 
            value => value && value.trim() !== '', 
            'Please select a referral type'
        );
        
        this.formValidator.addRule('detailsInput', 
            value => value && value.trim().length >= 10, 
            'Please provide at least 10 characters of incident details'
        );
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('referralForm');
        if (form) {
            this.addEventListener(form, 'submit', (e) => this.handleFormSubmit(e));
        }

        // Student search with debouncing
        const studentSearch = document.getElementById('studentSearch');
        if (studentSearch) {
            const debouncedSearch = Utils.debounce((e) => this.handleStudentSearch(e), 300);
            this.addEventListener(studentSearch, 'input', debouncedSearch);
            this.addEventListener(studentSearch, 'focus', () => this.showSearchDropdown());
        }

        // Form field validation
        const validationFields = [
            'lessonSelect', 'classroomSelect', 'teacherSelect', 
            'learningAreaSelect', 'detailsInput'
        ];

        validationFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                this.addEventListener(field, 'change', () => this.validateForm());
                this.addEventListener(field, 'blur', () => this.validateField(fieldId));
            }
        });

        // Click outside to close dropdowns
        this.addEventListener(document, 'click', (e) => this.handleOutsideClick(e));

        // Keyboard navigation
        this.addEventListener(document, 'keydown', (e) => this.handleKeyboardNavigation(e));

        // Window resize for responsive adjustments
        this.addEventListener(window, 'resize', Utils.debounce(() => this.handleResize(), 250));
    }

    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        
        // Store for cleanup
        const key = Utils.generateId();
        this.eventListeners.set(key, { element, event, handler });
        
        return key;
    }

    removeEventListener(key) {
        const listener = this.eventListeners.get(key);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler);
            this.eventListeners.delete(key);
        }
    }

    async loadAllData() {
        console.log('📚 Loading all system data...');
        
        const loadTasks = [
            this.loadStudents(),
            this.loadClassrooms(), 
            this.loadTeachers(),
            this.loadLearningAreas(),
            this.loadParentEmails(),
            this.loadHouseCompanions(),
            this.loadBehaviorTypes()
        ];

        const results = await Promise.allSettled(loadTasks);
        
        // Log any failures
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`⚠️ Data loading task ${index} failed:`, result.reason);
            }
        });

        console.log('✅ Data loading completed');
    }

    async loadStudents() {
        try {
            this.data.students = await this.dataManager.loadCSV('students.csv');
            console.log(`✅ Students loaded: ${this.data.students.length}`);
        } catch (error) {
            console.warn('⚠️ Students loading failed:', error);
            this.data.students = [];
        }
    }

    async loadClassrooms() {
        try {
            const barcodesData = await this.dataManager.loadCSV('Barcodelocations.csv');
            this.data.classrooms = [...new Set(
                barcodesData
                    .map(item => item.Title)
                    .filter(Boolean)
            )].sort();
            
            this.populateSelect('classroomSelect', this.data.classrooms);
            console.log(`✅ Classrooms loaded: ${this.data.classrooms.length}`);
        } catch (error) {
            console.warn('⚠️ Classrooms loading failed:', error);
            this.data.classrooms = [];
        }
    }

    async loadTeachers() {
        try {
            const teachersData = await this.dataManager.loadCSV('BCEteacherinfo.csv');
            this.data.teachers = [];
            this.data.teacherEmails = {};

            teachersData.forEach(teacher => {
                if (teacher.Stafffullname && teacher.BCEID) {
                    const teacherName = `${teacher.Stafffullname} (${teacher.BCEID})`;
                    this.data.teachers.push(teacherName);
                    this.data.teacherEmails[teacherName] = teacher.Staffemail || '';
                }
            });

            this.data.teachers.sort();
            this.populateSelect('teacherSelect', this.data.teachers);
            console.log(`✅ Teachers loaded: ${this.data.teachers.length}`);
        } catch (error) {
            console.warn('⚠️ Teachers loading failed:', error);
            this.data.teachers = [];
        }
    }

    async loadLearningAreas() {
        try {
            const learningData = await this.dataManager.loadCSV('Learningareacategory.csv');
            this.data.learningAreas = [...new Set(
                learningData
                    .map(item => item['Learning Area Category'])
                    .filter(Boolean)
            )].sort();
            
            this.populateSelect('learningAreaSelect', this.data.learningAreas);
            console.log(`✅ Learning areas loaded: ${this.data.learningAreas.length}`);
        } catch (error) {
            console.warn('⚠️ Learning areas loading failed:', error);
            this.data.learningAreas = [];
        }
    }

    async loadParentEmails() {
        try {
            const parentData = await this.dataManager.loadCSV('parentemail.csv');
            this.data.parentEmails = {};
            
            parentData.forEach(parent => {
                if (parent.BCEID1 && parent.ParentEmail) {
                    this.data.parentEmails[parent.BCEID1] = {
                        email: parent.ParentEmail,
                        name: [
                            parent.ParentTitle,
                            parent.ParentFirstName,
                            parent.ParentSecondName
                        ].filter(Boolean).join(' ')
                    };
                }
            });
            
            console.log(`✅ Parent emails loaded: ${Object.keys(this.data.parentEmails).length}`);
        } catch (error) {
            console.warn('⚠️ Parent emails loading failed:', error);
            this.data.parentEmails = {};
        }
    }

    async loadHouseCompanions() {
        try {
            const houseData = await this.dataManager.loadCSV('housecompanions.csv');
            this.data.houseCompanions = {};
            
            houseData.forEach(companion => {
                const houseField = companion.housegroup || companion.HouseName;
                const emailField = companion.email || companion.Email;
                const nameField = companion['staff name'] || companion['Staff Name'];

                if (houseField && emailField) {
                    this.data.houseCompanions[houseField] = {
                        email: emailField,
                        name: nameField || ''
                    };
                }
            });
            
            console.log(`✅ House companions loaded: ${Object.keys(this.data.houseCompanions).length}`);
        } catch (error) {
            console.warn('⚠️ House companions loading failed:', error);
            this.data.houseCompanions = {};
        }
    }

    async loadBehaviorTypes() {
        try {
            const behaviorData = await this.dataManager.loadCSV('BehaviourList.csv');
            this.data.behaviorTypes = behaviorData
                .map(item => item['Behaviour'] || item['behavior'])
                .filter(Boolean)
                .sort();
            
            this.populateSelect('behaviorTypeSelect', this.data.behaviorTypes);
            console.log(`✅ Behavior types loaded: ${this.data.behaviorTypes.length}`);
        } catch (error) {
            console.warn('⚠️ Behavior types loading failed:', error);
            this.data.behaviorTypes = [];
        }
    }

    populateSelect(selectId, options, placeholder = '-- Select --') {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`Select element ${selectId} not found`);
            return;
        }

        // Clear existing options except the first placeholder
        select.innerHTML = `<option value="">${placeholder}</option>`;

        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        console.log(`✅ Populated ${selectId} with ${options.length} options`);
    }

    handleStudentSearch(event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        const dropdown = document.getElementById('studentDropdown');
        
        if (!dropdown) return;

        if (searchTerm.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        // Check cache first
        const cacheKey = `search_${searchTerm}`;
        if (this.state.searchCache.has(cacheKey)) {
            this.displaySearchResults(this.state.searchCache.get(cacheKey));
            return;
        }

        // Perform fuzzy search
        const filteredStudents = this.data.students.filter(student => {
            if (!student.FirstName || !student.LegalSurname1 || !student.BCEID1) {
                return false;
            }

            const fullName = `${student.FirstName} ${student.LegalSurname1}`.toLowerCase();
            const reverseName = `${student.LegalSurname1}, ${student.FirstName}`.toLowerCase();
            const bceid = student.BCEID1.toLowerCase();

            return fullName.includes(searchTerm) || 
                   reverseName.includes(searchTerm) || 
                   bceid.includes(searchTerm);
        }).slice(0, 10);

        // Cache results
        this.state.searchCache.set(cacheKey, filteredStudents);
        this.displaySearchResults(filteredStudents);
    }

    displaySearchResults(students) {
        const dropdown = document.getElementById('studentDropdown');
        if (!dropdown) return;

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
            students.forEach((student, index) => {
                const option = document.createElement('div');
                option.className = 'student-option';
                option.innerHTML = `
                    <div style="font-weight: 600;">${Utils.sanitizeInput(student.FirstName)} ${Utils.sanitizeInput(student.LegalSurname1)}</div>
                    <div style="font-size: 0.875rem; color: #666;">${Utils.sanitizeInput(student.BCEID1)} • ${Utils.sanitizeInput(student.HouseName || 'No House')}</div>
                `;
                option.style.cssText = `
                    padding: 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                `;
                option.setAttribute('data-index', index);
                option.addEventListener('click', () => this.selectStudent(student));
                option.addEventListener('mouseenter', () => this.highlightSearchOption(option));
                dropdown.appendChild(option);
            });
        }

        dropdown.style.display = 'block';
    }

    highlightSearchOption(option) {
        // Remove previous highlights
        document.querySelectorAll('.student-option.highlighted').forEach(opt => {
            opt.classList.remove('highlighted');
            opt.style.backgroundColor = '';
        });

        // Highlight current option
        option.classList.add('highlighted');
        option.style.backgroundColor = '#f0f7ff';
    }

    selectStudent(student) {
        console.log('👤 Student selected:', student.FirstName, student.LegalSurname1);

        try {
            this.state.selectedStudent = student;

            // Update form fields
            const studentSearch = document.getElementById('studentSearch');
            const selectedStudentId = document.getElementById('selectedStudentId');
            const dropdown = document.getElementById('studentDropdown');

            if (studentSearch) {
                studentSearch.value = `${student.FirstName} ${student.LegalSurname1}`;
            }
            if (selectedStudentId) {
                selectedStudentId.value = student.BCEID1;
            }
            if (dropdown) {
                dropdown.style.display = 'none';
            }

            this.showStudentProfile(student);
            this.validateForm();

        } catch (error) {
            console.error('❌ Error selecting student:', error);
            this.toastManager.show('❌ Error selecting student', 'error');
        }
    }

    showStudentProfile(student) {
        console.log('📋 Showing profile for:', student.BCEID1);

        try {
            const profile = document.getElementById('studentProfile');
            if (!profile) return;

            // Update photo with error handling
            const photo = document.getElementById('studentPhoto');
            if (photo) {
                photo.src = `students/${student.BCEID1}.jpg`;
                photo.onerror = () => {
                    photo.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f0f0f0"/><text x="60" y="65" text-anchor="middle" fill="%23666" font-size="14">No Photo</text></svg>`;
                };
                photo.alt = `Photo of ${student.FirstName} ${student.LegalSurname1}`;
            }

            // Update profile details
            const updateElement = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = Utils.sanitizeInput(value || 'N/A');
                }
            };

            updateElement('studentName', `${student.FirstName} ${student.LegalSurname1}`);
            updateElement('studentBCEID', student.BCEID1);
            updateElement('studentHouse', student.HouseName);
            updateElement('studentHomeGroup', student.HomeGroup);
            updateElement('studentYearLevel', student.YearLevelName);

            // Show profile with animation
            profile.style.display = 'block';
            profile.style.opacity = '0';
            profile.style.transform = 'translateY(10px)';
            
            requestAnimationFrame(() => {
                profile.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                profile.style.opacity = '1';
                profile.style.transform = 'translateY(0)';
            });

            // Load referral history (placeholder for now)
            this.loadStudentHistory(student.BCEID1);

        } catch (error) {
            console.error('❌ Error showing student profile:', error);
        }
    }

    async loadStudentHistory(studentId) {
        try {
            // Placeholder for referral history loading
            const referralCount = document.getElementById('referralCount');
            const historyList = document.getElementById('historyList');

            if (referralCount) {
                referralCount.textContent = '0 Previous Referrals';
            }

            if (historyList) {
                historyList.innerHTML = '<div style="color: #666; font-style: italic;">No previous referrals found</div>';
            }

            // TODO: Implement actual history loading from database/API
        } catch (error) {
            console.error('❌ Error loading student history:', error);
        }
    }

    validateField(fieldId) {
        const formData = this.collectFormData();
        const field = document.getElementById(fieldId);
        
        if (!field) return;

        this.formValidator.clearFieldError(fieldId);
        
        const rules = this.formValidator.rules.get(fieldId);
        if (rules) {
            const value = formData[fieldId];
            
            for (const rule of rules) {
                if (!rule.validator(value, formData)) {
                    this.formValidator.showFieldError(fieldId, rule.message);
                    break;
                }
            }
        }
    }

    validateForm() {
        const formData = this.collectFormData();
        const isValid = this.formValidator.validate(formData);

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = !isValid;
            submitBtn.style.opacity = isValid ? '1' : '0.6';
            submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }

        return isValid;
    }

    collectFormData() {
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };

        return {
            studentId: getValue('selectedStudentId'),
            referralType: getValue('referralType'),
            lesson: getValue('lessonSelect'),
            classroom: getValue('classroomSelect'),
            teacher: getValue('teacherSelect'),
            learningArea: getValue('learningAreaSelect'),
            behaviorType: getValue('behaviorTypeSelect'),
            details: getValue('detailsInput'),
            timestamp: new Date().toISOString()
        };
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        console.log('📝 Form submission initiated');

        try {
            this.formValidator.clearAllErrors();
            const formData = this.collectFormData();

            if (!this.validateForm()) {
                const errors = this.formValidator.getErrors();
                const firstError = Object.entries(errors)[0];
                
                if (firstError) {
                    this.formValidator.showFieldError(firstError[0], firstError[1]);
                    document.getElementById(firstError[0])?.focus();
                }
                
                this.toastManager.show('❌ Please fix the errors in the form', 'error');
                return;
            }

            await this.processReferralSubmission(formData);

        } catch (error) {
            console.error('❌ Form submission failed:', error);
            this.toastManager.show(`❌ Submission failed: ${error.message}`, 'error');
        }
    }

    async processReferralSubmission(formData) {
        console.log('📋 Processing referral submission:', formData);
        
        // Prepare email information
        const emailInfo = this.prepareEmailInfo(formData);
        
        if (!emailInfo || !emailInfo.hasRecipients) {
            // Submit without emails if no recipients found
            this.toastManager.show('⚠️ No email recipients found. Submitting referral only.', 'warning');
            await this.submitReferralDirect(formData);
            return;
        }

        // Show email confirmation modal
        this.showEmailConfirmation(formData, emailInfo);
    }

    prepareEmailInfo(formData) {
        console.log('📋 Preparing email information for student:', formData.studentId);

        const student = this.data.students.find(s => s.BCEID1 === formData.studentId);
        if (!student) {
            console.warn('Student not found:', formData.studentId);
            return null;
        }

        const parentInfo = this.data.parentEmails[formData.studentId];
        const houseCompanion = this.data.houseCompanions[student.HouseName];
        const teacherEmail = this.data.teacherEmails[formData.teacher];

        const templateVars = {
            parentName: parentInfo?.name || 'Parent/Guardian',
            studentName: `${student.FirstName} ${student.LegalSurname1}`,
            subjectArea: formData.learningArea,
            lesson: formData.lesson,
            teacher: formData.teacher,
            classroom: formData.classroom,
            details: formData.details
        };

        const templateName = formData.referralType === 'automatic' 
            ? 'triple_r_automatic_referral' 
            : 'triple_r_referral_warning';

        const recipients = [];
        if (parentInfo) recipients.push({ type: 'parent', ...parentInfo });
        if (houseCompanion) recipients.push({ type: 'house', ...houseCompanion });
        if (teacherEmail) recipients.push({ type: 'teacher', email: teacherEmail, name: formData.teacher });

        return {
            student,
            recipients,
            templateVars,
            templateName,
            hasRecipients: recipients.length > 0
        };
    }

    showEmailConfirmation(formData, emailInfo) {
        const emailContent = this.generateEmailContent(emailInfo);
        const recipientsList = this.generateRecipientsList(emailInfo.recipients);

        const modalHTML = `
            <div id="emailConfirmModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📧 Email Confirmation</h2>
                        <button class="modal-close" onclick="RRSystem.closeEmailModal()" aria-label="Close">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <p class="modal-intro">
                            The following emails will be sent for <strong>${Utils.sanitizeInput(emailInfo.student.FirstName)} ${Utils.sanitizeInput(emailInfo.student.LegalSurname1)}</strong>:
                        </p>
                        
                        <div class="recipients-section">
                            <h4>📬 Recipients:</h4>
                            ${recipientsList}
                        </div>
                        
                        <div class="email-preview">
                            <div class="preview-header">
                                <strong>Email Preview:</strong>
                            </div>
                            <div class="preview-content">${Utils.sanitizeInput(emailContent)}</div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="RRSystem.closeEmailModal()">
                            ❌ Cancel
                        </button>
                        <button class="btn btn-primary" onclick="RRSystem.confirmSendEmails()">
                            📨 Send Emails & Submit Referral
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('emailConfirmModal');
        if (existingModal) existingModal.remove();

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Store form data
        this.state.pendingFormData = formData;

        // Focus management
        const modal = document.getElementById('emailConfirmModal');
        if (modal) {
            modal.focus();
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeEmailModal();
            });
        }

        console.log('✅ Email confirmation modal displayed');
    }

    generateRecipientsList(recipients) {
        const icons = {
            parent: '👨‍👩‍👧‍👦',
            house: '🏠',
            teacher: '👩‍🏫'
        };

        return recipients.map(recipient => 
            `<div class="recipient-item">
                ${icons[recipient.type]} ${Utils.sanitizeInput(recipient.name)} &lt;${Utils.sanitizeInput(recipient.email)}&gt;
            </div>`
        ).join('');
    }

    generateEmailContent(emailInfo) {
        const templates = {
            'triple_r_automatic_referral': `Subject: Courtesy Notification – Triple R Automatic Referral – {subjectArea} – Lesson {lesson}

Dear {parentName},

This is a courtesy email to inform you that {studentName} was referred, as part of the Triple R process at Sophia College, to the Re-Engagement Room for {subjectArea} during Lesson {lesson} with {teacher} in {classroom}.

On this occasion, a Triple R disc was not issued. The referral was automatic due to behaviour and disruption to the teaching and learning environment, which does not align with the expectations of our Positive Behaviour for Learning (PB4L) framework.

Incident Details: {details}

If you require any further information, you are welcome to contact the classroom teacher or the Re-Engagement Room Team.

Kind regards,
Re-Engagement Room Team
Sophia College`,

            'triple_r_referral_warning': `Subject: Courtesy Notification – Triple R Referral – {subjectArea} – Lesson {lesson}

Dear {parentName},

This is a courtesy email to inform you that {studentName} was referred, as part of the Triple R process at Sophia College, to the Re-Engagement Room for {subjectArea} during Lesson {lesson} with {teacher} in {classroom}.

A Triple R disc was issued as a warning to improve behaviour, in line with our Positive Behaviour for Learning (PB4L) framework. Despite this warning, {studentName} continued to be disruptive to the teaching and learning environment, impacting both their own learning and that of others. As a result, a formal referral to the Re-Engagement Room was made.

Incident Details: {details}

If you require any further information, you are welcome to contact the classroom teacher or the Re-Engagement Room Team.

Kind regards,
Re-Engagement Room Team
Sophia College`
        };

        let template = templates[emailInfo.templateName];
        if (!template) {
            console.warn('Template not found:', emailInfo.templateName);
            template = 'Email template not available.';
        }

        // Replace template variables
        Object.entries(emailInfo.templateVars).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            template = template.replace(regex, value);
        });

        return template;
    }

    closeEmailModal() {
        const modal = document.getElementById('emailConfirmModal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        }
        this.state.pendingFormData = null;
    }

    async confirmSendEmails() {
        console.log('📨 Confirming email send...');

        if (!this.state.pendingFormData) {
            this.toastManager.show('❌ No pending form data', 'error');
            return;
        }

        try {
            this.closeEmailModal();
            
            // Show progress
            const progressToast = this.toastManager.show('📧 Sending emails and submitting referral...', 'info', 10000);
            
            // Simulate API calls with proper error handling
            await this.simulateEmailSending();
            await this.submitReferralDirect(this.state.pendingFormData);
            
            // Remove progress toast
            this.toastManager.remove(progressToast);
            
            this.toastManager.show('✅ Referral submitted and emails sent successfully!', 'success');
            this.resetForm();
            
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            this.toastManager.show(`❌ Failed to send emails: ${error.message}`, 'error');
        }
    }

    async simulateEmailSending() {
        // Simulate email sending with random delay
        const delay = Math.random() * 2000 + 1000; // 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate occasional failures (10% chance)
        if (Math.random() < 0.1) {
            throw new Error('Email service temporarily unavailable');
        }
    }

    async submitReferralDirect(formData) {
        console.log('📝 Submitting referral directly...');
        
        // TODO: Implement actual API submission
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Log the referral data (in production, this would go to a database)
        console.log('📋 Referral Data:', formData);
    }

    resetForm() {
        console.log('🔄 Resetting form...');

        try {
            // Reset form elements
            const form = document.getElementById('referralForm');
            if (form) form.reset();

            // Clear hidden fields and state
            this.state.selectedStudent = null;
            this.state.pendingFormData = null;

            const fieldsToReset = ['selectedStudentId', 'referralType'];
            fieldsToReset.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });

            // Hide student profile
            const studentProfile = document.getElementById('studentProfile');
            if (studentProfile) {
                studentProfile.style.display = 'none';
            }

            // Clear referral type selection
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.style.borderColor = '#e0e0e0';
                opt.style.backgroundColor = '#fff';
            });

            // Clear form validation
            this.formValidator.clearAllErrors();
            this.validateForm();

            console.log('✅ Form reset completed');
            
        } catch (error) {
            console.error('❌ Form reset failed:', error);
        }
    }

    // Tab management
    switchTab(tabName, buttonElement) {
        console.log('🔄 Switching to tab:', tabName);
        
        try {
            // Update state
            this.state.currentTab = tabName;

            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
                tab.classList.remove('active');
            });

            // Remove active from buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.style.backgroundColor = '#f8f9fa';
                btn.style.color = '#666';
                btn.style.borderBottom = '3px solid transparent';
            });

            // Show target tab
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.style.display = 'block';
                targetTab.classList.add('active');
            }

            // Activate button
            if (buttonElement) {
                buttonElement.classList.add('active');
                buttonElement.style.backgroundColor = '#fff';
                buttonElement.style.color = '#003057';
                buttonElement.style.borderBottom = '3px solid #660000';
                buttonElement.style.fontWeight = '600';
            }

            // Tab-specific setup
            this.handleTabSwitch(tabName);

            console.log('✅ Tab switched successfully');
        } catch (error) {
            console.error('❌ Tab switch error:', error);
        }
    }

    handleTabSwitch(tabName) {
        switch (tabName) {
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'manage':
                this.loadReferralManagement();
                break;
            case 'documents':
                this.loadDocuments();
                break;
            case 'admin':
                this.loadAdminPanel();
                break;
        }
    }

    // Referral type selection
    selectReferralType(type, element) {
        console.log('📋 Selecting referral type:', type);

        try {
            // Clear previous selections
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.style.borderColor = '#e0e0e0';
                opt.style.backgroundColor = '#fff';
            });

            // Select current option
            if (element) {
                element.classList.add('selected');
                element.style.borderColor = '#660000';
                element.style.backgroundColor = '#fff5f5';
            }

            // Update hidden input
            const input = document.getElementById('referralType');
            if (input) {
                input.value = type;
            }

            this.validateForm();

        } catch (error) {
            console.error('❌ Select type error:', error);
        }
    }

    // UI Management
    showLoadingState(show) {
        const loadingStatus = document.getElementById('loadingStatus');
        if (loadingStatus) {
            loadingStatus.style.display = show ? 'block' : 'none';
        }
        this.state.isLoading = show;
    }

    setupUI() {
        // Add CSS for enhanced modals and UI
        const style = document.createElement('style');
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 1;
                transition: opacity 0.2s ease;
            }
            
            .modal-content {
                background: white;
                border-radius: 12px;
                max-width: 700px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                animation: modalSlideIn 0.3s ease;
            }
            
            @keyframes modalSlideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .modal-header {
                background: #003057;
                color: white;
                padding: 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h2 {
                margin: 0;
                font-size: 1.3em;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.5em;
                cursor: pointer;
                padding: 5px;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            }
            
            .modal-close:hover {
                background-color: rgba(255,255,255,0.1);
            }
            
            .modal-body {
                padding: 25px;
            }
            
            .modal-intro {
                margin: 0 0 20px 0;
                font-size: 1.1em;
                color: #333;
            }
            
            .recipients-section {
                background: #f8f9fa;
                border-left: 4px solid #660000;
                padding: 15px;
                margin: 20px 0;
                border-radius: 0 6px 6px 0;
            }
            
            .recipients-section h4 {
                margin: 0 0 10px 0;
                color: #660000;
            }
            
            .recipient-item {
                margin: 5px 0;
                font-size: 0.95em;
                padding: 4px 0;
            }
            
            .email-preview {
                border: 1px solid #ddd;
                border-radius: 8px;
                margin: 20px 0;
            }
            
            .preview-header {
                background: #f1f1f1;
                padding: 12px;
                border-bottom: 1px solid #ddd;
                border-radius: 8px 8px 0 0;
                font-weight: bold;
            }
            
            .preview-content {
                padding: 20px;
                font-family: Georgia, serif;
                line-height: 1.6;
                white-space: pre-line;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .modal-actions {
                display: flex;
                gap: 15px;
                justify-content: flex-end;
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
            
            .btn {
                padding: 12px 25px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1em;
                border: none;
                transition: all 0.2s ease;
            }
            
            .btn-secondary {
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
            }
            
            .btn-secondary:hover {
                background: #e9ecef;
            }
            
            .btn-primary {
                background: #660000;
                color: white;
                font-weight: 600;
            }
            
            .btn-primary:hover {
                background: #800000;
            }
            
            .field-error {
                color: #f44336;
                font-size: 0.875rem;
                margin-top: 4px;
                display: block;
            }
            
            .student-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 1000;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .student-option {
                padding: 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                transition: background-color 0.2s ease;
            }
            
            .student-option:hover,
            .student-option.highlighted {
                background-color: #f0f7ff;
            }
            
            .student-option:last-child {
                border-bottom: none;
            }
            
            .student-search {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }

    // Event handlers
    handleOutsideClick(event) {
        const dropdown = document.getElementById('studentDropdown');
        const searchInput = document.getElementById('studentSearch');
        
        if (dropdown && searchInput && 
            !dropdown.contains(event.target) && 
            !searchInput.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    }

    showSearchDropdown() {
        const searchInput = document.getElementById('studentSearch');
        const dropdown = document.getElementById('studentDropdown');
        
        if (searchInput && dropdown && searchInput.value.length >= 2) {
            dropdown.style.display = 'block';
        }
    }

    handleKeyboardNavigation(event) {
        const dropdown = document.getElementById('studentDropdown');
        if (!dropdown || dropdown.style.display === 'none') return;

        const options = dropdown.querySelectorAll('.student-option:not(.no-results)');
        const currentHighlight = dropdown.querySelector('.student-option.highlighted');
        
        let newIndex = -1;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (currentHighlight) {
                    newIndex = Array.from(options).indexOf(currentHighlight) + 1;
                } else {
                    newIndex = 0;
                }
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                if (currentHighlight) {
                    newIndex = Array.from(options).indexOf(currentHighlight) - 1;
                } else {
                    newIndex = options.length - 1;
                }
                break;
                
            case 'Enter':
                event.preventDefault();
                if (currentHighlight) {
                    currentHighlight.click();
                }
                return;
                
            case 'Escape':
                dropdown.style.display = 'none';
                return;
        }
        
        // Update highlight
        if (newIndex >= 0 && newIndex < options.length) {
            options.forEach(opt => {
                opt.classList.remove('highlighted');
                opt.style.backgroundColor = '';
            });
            this.highlightSearchOption(options[newIndex]);
        }
    }

    handleResize() {
        // Handle responsive adjustments
        const modal = document.getElementById('emailConfirmModal');
        if (modal) {
            const content = modal.querySelector('.modal-content');
            if (content && window.innerWidth < 768) {
                content.style.width = '95%';
                content.style.margin = '10px';
            }
        }
    }

    // Placeholder methods for other tabs
    loadAnalytics() {
        console.log('📊 Loading analytics...');
        // TODO: Implement analytics loading
    }

    loadReferralManagement() {
        console.log('📋 Loading referral management...');
        // TODO: Implement referral management
    }

    loadDocuments() {
        console.log('📁 Loading documents...');
        // TODO: Implement document management
    }

    loadAdminPanel() {
        console.log('⚙️ Loading admin panel...');
        // TODO: Implement admin panel
    }

    // Utility methods
    logout() {
        console.log('🚪 Logging out...');
        
        // Clean up
        this.cleanup();
        
        // Clear authentication
        localStorage.removeItem('loggedInStaff');
        
        // Redirect
        window.location.href = 'index.html';
    }

    cleanup() {
        // Remove event listeners
        this.eventListeners.forEach((_, key) => this.removeEventListener(key));
        
        // Clear caches
        this.dataManager.clearCache();
        this.state.searchCache.clear();
        
        // Clear toasts
        this.toastManager.clear();
        
        console.log('🧹 Cleanup completed');
    }

    // Development and testing methods
    getSystemStats() {
        return {
            dataLoaded: {
                students: this.data.students.length,
                teachers: this.data.teachers.length,
                classrooms: this.data.classrooms.length,
                learningAreas: this.data.learningAreas.length,
                parentEmails: Object.keys(this.data.parentEmails).length,
                houseCompanions: Object.keys(this.data.houseCompanions).length
            },
            cacheStats: this.dataManager.getCacheStats(),
            eventListeners: this.eventListeners.size,
            currentTab: this.state.currentTab,
            selectedStudent: this.state.selectedStudent?.BCEID1 || null
        };
    }

    async reloadData() {
        console.log('🔄 Manual data reload triggered...');
        this.dataManager.clearCache();
        this.state.searchCache.clear();
        await this.loadAllData();
        this.toastManager.show('✅ Data reloaded successfully!', 'success');
    }
}

// Create global instance
window.RRSystem = new ReEngagementRoomSystem();

// Global functions for HTML onclick handlers
window.switchTab = (tabName, buttonElement) => RRSystem.switchTab(tabName, buttonElement);
window.selectReferralType = (type, element) => RRSystem.selectReferralType(type, element);
window.logout = () => RRSystem.logout();

// Development helpers
window.getSystemStats = () => RRSystem.getSystemStats();
window.reloadData = () => RRSystem.reloadData();

console.log('✅ Enhanced Re-Engagement Room System loaded');
console.log('🧪 Available commands:');
console.log('  - getSystemStats() - View system statistics');
console.log('  - reloadData() - Reload all CSV data');
console.log('  - RRSystem.toastManager.show("message", "type") - Show toast notification');
console.log('  - RRSystem.dataManager.getCacheStats() - View cache statistics');
