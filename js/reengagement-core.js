/**
 * Sophia College Re-Engagement Room System - Enhanced Version
 * Integrates with shared modules and new HTML structure
 * 
 * Dependencies: error-handler.js, data-manager.js, ui-components.js
 * External: Firebase, PapaParse
 */

// Utility functions and helpers
const Utils = {
    generateId: () => Math.random().toString(36).substr(2, 9),
    
    debounce: (func, wait) => {
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
    
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    fuzzySearch: (needle, haystack, threshold = 0.6) => {
        const similarity = (a, b) => {
            const distance = Utils.levenshteinDistance(a, b);
            const maxLength = Math.max(a.length, b.length);
            return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
        };
        
        return haystack.filter(item => {
            const searchText = typeof item === 'string' ? item : JSON.stringify(item);
            return similarity(needle.toLowerCase(), searchText.toLowerCase()) >= threshold;
        });
    },

    levenshteinDistance: (a, b) => {
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

// Enhanced Re-Engagement Room System
class ReEngagementRoomSystem {
    constructor() {
        // Initialize dependencies
        this.errorHandler = window.ErrorHandler ? new ErrorHandler() : null;
        this.dataManager = window.DataManager ? new DataManager() : null;
        this.uiManager = window.UIManager ? new UIManager() : null;
        
        // Data storage
        this.data = {
            students: [],
            classrooms: [],
            teachers: [],
            teacherEmails: {},
            learningAreas: [],
            parentEmails: {},
            houseCompanions: {},
            behaviorTypes: [],
            referrals: []
        };

        // Application state
        this.state = {
            selectedStudent: null,
            currentTab: 'submit',
            isLoading: false,
            searchCache: new Map(),
            reflectionFile: null
        };

        // Event listeners registry
        this.eventListeners = new Map();
        
        // Firebase instance
        this.db = null;
        
        console.log('🚀 Re-Engagement Room System initializing...');
    }

    async init() {
        try {
            console.log('📚 Starting system initialization...');
            
            // Show loading state
            this.showLoadingState(true);
            
            // Check authentication
            await this.checkAuthentication();
            
            // Initialize Firebase
            await this.initializeFirebase();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load all data
            await this.loadAllData();
            
            // Setup UI
            this.setupUI();
            
            // Hide loading state
            this.showLoadingState(false);
            
            // Show success message
            this.showToast('✅ System initialized successfully!', 'success');
            
            console.log('✅ Re-Engagement Room System ready');
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.handleError({
                type: 'initialization',
                message: 'Failed to initialize system',
                error: error,
                severity: 'error'
            });
            this.showLoadingState(false);
        }
    }

    async checkAuthentication() {
        const loggedInStaff = localStorage.getItem('loggedInStaff');
        if (!loggedInStaff) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const staff = JSON.parse(loggedInStaff);
            document.getElementById('staffName').textContent = staff['staff name'] || 'Staff Member';
            
            // Show admin elements if user is admin
            if (staff.admin) {
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'block';
                });
            }
        } catch (error) {
            console.warn('⚠️ Authentication data corrupted, redirecting...');
            localStorage.removeItem('loggedInStaff');
            window.location.href = 'index.html';
        }
    }

    async initializeFirebase() {
        try {
            console.log('🔥 Initializing Firebase...');
            
            const firebaseConfig = {
                apiKey: 'AIzaSyD0yaJtrClhyXWjBqDmtdxdM2kWl8AvtKU',
                authDomain: 'sophia-infringements.firebaseapp.com',
                projectId: 'sophia-infringements',
                databaseURL: 'https://sophia-infringements-default-rtdb.firebaseio.com/'
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            this.db = firebase.firestore();
            console.log('✅ Firebase initialized successfully');
            
        } catch (error) {
            throw new Error(`Firebase initialization failed: ${error.message}`);
        }
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Student search
        const studentSearch = document.getElementById('studentSearch');
        if (studentSearch) {
            const debouncedSearch = Utils.debounce((e) => this.handleStudentSearch(e), 300);
            this.addEventListener(studentSearch, 'input', debouncedSearch);
            this.addEventListener(studentSearch, 'focus', () => this.showSearchDropdown());
        }

        // Form validation
        const validationFields = [
            'lessonSelect', 'classroomSelect', 'teacherSelect', 
            'learningAreaSelect', 'behaviorTypeSelect', 'detailsInput'
        ];

        validationFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                this.addEventListener(field, 'change', () => this.validateForm());
                this.addEventListener(field, 'blur', () => this.validateField(fieldId));
            }
        });

        // File upload
        const reflectionFile = document.getElementById('reflectionFile');
        if (reflectionFile) {
            this.addEventListener(reflectionFile, 'change', (e) => this.handleFileUpload(e));
        }

        // Form submission
        const referralForm = document.getElementById('referralForm');
        if (referralForm) {
            this.addEventListener(referralForm, 'submit', (e) => this.handleFormSubmit(e));
        }

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
        
        if (!this.dataManager) {
            console.warn('⚠️ DataManager not available, using fallback loader');
            await this.loadDataFallback();
            return;
        }
        
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
        this.populateFormSelects();
    }

    async loadDataFallback() {
        // Fallback CSV loader if DataManager is not available
        const loadCSV = (filename) => {
            return new Promise((resolve, reject) => {
                Papa.parse(filename, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: results => resolve(results.data),
                    error: err => reject(err)
                });
            });
        };

        try {
            const [students, classrooms, teachers, areas, parents, companions, behaviors] = await Promise.all([
                loadCSV('students.csv'),
                loadCSV('Barcodelocations.csv'),
                loadCSV('BCEteacherinfo.csv'),
                loadCSV('Learningareacategory.csv'),
                loadCSV('parentemail.csv'),
                loadCSV('housecompanions.csv'),
                loadCSV('BehaviourList.csv')
            ]);

            this.data.students = students;
            this.data.classrooms = [...new Set(classrooms.map(item => item.Title).filter(Boolean))].sort();
            this.processTeachers(teachers);
            this.data.learningAreas = [...new Set(areas.map(item => item['Learning Area Category']).filter(Boolean))].sort();
            this.processParentEmails(parents);
            this.processHouseCompanions(companions);
            this.data.behaviorTypes = behaviors.map(b => b.Type).filter(Boolean);

        } catch (error) {
            console.error('❌ Fallback data loading failed:', error);
            throw error;
        }
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
            
            console.log(`✅ Classrooms loaded: ${this.data.classrooms.length}`);
        } catch (error) {
            console.warn('⚠️ Classrooms loading failed:', error);
            this.data.classrooms = [];
        }
    }

    async loadTeachers() {
        try {
            const teachersData = await this.dataManager.loadCSV('BCEteacherinfo.csv');
            this.processTeachers(teachersData);
            console.log(`✅ Teachers loaded: ${this.data.teachers.length}`);
        } catch (error) {
            console.warn('⚠️ Teachers loading failed:', error);
            this.data.teachers = [];
        }
    }

    processTeachers(teachersData) {
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
    }

    async loadLearningAreas() {
        try {
            const learningData = await this.dataManager.loadCSV('Learningareacategory.csv');
            this.data.learningAreas = [...new Set(
                learningData
                    .map(item => item['Learning Area Category'])
                    .filter(Boolean)
            )].sort();
            
            console.log(`✅ Learning areas loaded: ${this.data.learningAreas.length}`);
        } catch (error) {
            console.warn('⚠️ Learning areas loading failed:', error);
            this.data.learningAreas = [];
        }
    }

    async loadParentEmails() {
        try {
            const parentData = await this.dataManager.loadCSV('parentemail.csv');
            this.processParentEmails(parentData);
            console.log(`✅ Parent emails loaded: ${Object.keys(this.data.parentEmails).length}`);
        } catch (error) {
            console.warn('⚠️ Parent emails loading failed:', error);
            this.data.parentEmails = {};
        }
    }

    processParentEmails(parentData) {
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
    }

    async loadHouseCompanions() {
        try {
            const houseData = await this.dataManager.loadCSV('housecompanions.csv');
            this.processHouseCompanions(houseData);
            console.log(`✅ House companions loaded: ${Object.keys(this.data.houseCompanions).length}`);
        } catch (error) {
            console.warn('⚠️ House companions loading failed:', error);
            this.data.houseCompanions = {};
        }
    }

    processHouseCompanions(houseData) {
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
    }

    async loadBehaviorTypes() {
        try {
            const behaviorData = await this.dataManager.loadCSV('BehaviourList.csv');
            this.data.behaviorTypes = behaviorData.map(b => b.Type).filter(Boolean);
            console.log(`✅ Behavior types loaded: ${this.data.behaviorTypes.length}`);
        } catch (error) {
            console.warn('⚠️ Behavior types loading failed:', error);
            this.data.behaviorTypes = [
                'Minor - Disrespect/non-compliance',
                'Minor - Disruption',
                'Major - Persistent disruption',
                'Major - Defiance'
            ];
        }
    }

    populateFormSelects() {
        this.populateSelect('classroomSelect', this.data.classrooms);
        this.populateSelect('teacherSelect', this.data.teachers);
        this.populateSelect('learningAreaSelect', this.data.learningAreas);
        this.populateSelect('behaviorTypeSelect', this.data.behaviorTypes);
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Keep the first option (placeholder)
        const firstOption = select.options[0];
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
    }

    setupUI() {
        console.log('🎨 Setting up UI...');
        
        // Initialize form validation
        this.setupFormValidation();
        
        // Set initial tab
        this.switchTab('submit');
        
        // Setup search
        this.setupStudentSearch();
    }

    setupFormValidation() {
        const form = document.getElementById('referralForm');
        if (!form) return;

        // Real-time validation
        const requiredFields = [
            'selectedStudentId', 'lessonSelect', 'classroomSelect', 
            'teacherSelect', 'learningAreaSelect', 'behaviorTypeSelect', 
            'detailsInput', 'referralType'
        ];

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                this.addEventListener(field, 'input', () => this.validateForm());
                this.addEventListener(field, 'change', () => this.validateForm());
            }
        });
    }

    setupStudentSearch() {
        const searchInput = document.getElementById('studentSearch');
        if (!searchInput) return;

        // Clear any existing dropdown
        this.hideSearchDropdown();
    }

    // Event Handlers
    handleStudentSearch(event) {
        const query = event.target.value.trim();
        
        if (query.length < 2) {
            this.hideSearchDropdown();
            return;
        }

        const filteredStudents = this.searchStudents(query);
        this.displaySearchResults(filteredStudents);
    }

    searchStudents(query) {
        const normalizedQuery = query.toLowerCase();
        
        return this.data.students.filter(student => {
            const searchTerms = [
                student.FirstName,
                student.LegalSurname1,
                student.BCEID1,
                `${student.FirstName} ${student.LegalSurname1}`,
                `${student.LegalSurname1}, ${student.FirstName}`
            ].filter(Boolean).map(term => term.toLowerCase());
            
            return searchTerms.some(term => term.includes(normalizedQuery));
        }).slice(0, 10); // Limit results
    }

    displaySearchResults(students) {
        const dropdown = document.getElementById('studentDropdown');
        if (!dropdown) return;

        if (students.length === 0) {
            dropdown.innerHTML = '<div class="student-option no-results">No students found</div>';
        } else {
            dropdown.innerHTML = students.map(student => `
                <div class="student-option" onclick="window.RRSystem.selectStudent('${student.BCEID1}')" 
                     data-student-id="${student.BCEID1}">
                    <div>
                        <strong>${student.FirstName} ${student.LegalSurname1}</strong>
                        <small style="display: block; color: var(--text-muted);">
                            ID: ${student.BCEID1} | House: ${student.HouseName || 'Unassigned'}
                        </small>
                    </div>
                </div>
            `).join('');
        }
        
        this.showSearchDropdown();
    }

    showSearchDropdown() {
        const dropdown = document.getElementById('studentDropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
        }
    }

    hideSearchDropdown() {
        const dropdown = document.getElementById('studentDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        }
    }

    selectStudent(studentId) {
        const student = this.data.students.find(s => s.BCEID1 === studentId);
        if (!student) return;

        // Update form
        document.getElementById('selectedStudentId').value = studentId;
        document.getElementById('studentSearch').value = `${student.FirstName} ${student.LegalSurname1}`;
        
        // Store selected student
        this.state.selectedStudent = student;
        
        // Hide dropdown
        this.hideSearchDropdown();
        
        // Show student profile
        this.displayStudentProfile(student);
        
        // Validate form
        this.validateForm();
        
        console.log('✅ Student selected:', student.FirstName, student.LegalSurname1);
    }

    displayStudentProfile(student) {
        const profile = document.getElementById('studentProfile');
        if (!profile) return;

        // Update profile information
        document.getElementById('studentName').textContent = `${student.FirstName} ${student.LegalSurname1}`;
        document.getElementById('studentBCEID').textContent = student.BCEID1;
        document.getElementById('studentHouse').textContent = student.HouseName || 'Unassigned';
        document.getElementById('studentHomeGroup').textContent = student.Homegroup || '-';
        document.getElementById('studentYearLevel').textContent = student.YearLevel || '-';

        // Set student photo
        const photo = document.getElementById('studentPhoto');
        if (photo) {
            photo.src = student.PhotoURL || 'default-avatar.png';
            photo.alt = `Photo of ${student.FirstName} ${student.LegalSurname1}`;
        }

        // Load referral count and history
        this.loadStudentReferralData(student.BCEID1);
        
        // Show profile
        profile.style.display = 'flex';
    }

    async loadStudentReferralData(studentId) {
        if (!this.db) return;

        try {
            const snapshot = await this.db.collection('referrals')
                .where('studentId', '==', studentId)
                .orderBy('createdAt', 'desc')
                .get();

            const referrals = [];
            snapshot.forEach(doc => {
                referrals.push({ id: doc.id, ...doc.data() });
            });

            // Update referral count
            document.getElementById('referralCount').textContent = referrals.length;

            // Display history
            this.displayReferralHistory(referrals);

            // Check step progression
            this.updateStepIndicator(referrals.length);

        } catch (error) {
            console.warn('⚠️ Failed to load student referral data:', error);
        }
    }

    displayReferralHistory(referrals) {
        const historyList = document.getElementById('historyList');
        const historySection = document.getElementById('historySection');
        
        if (!historyList || !historySection) return;

        if (referrals.length === 0) {
            historySection.style.display = 'none';
            return;
        }

        historyList.innerHTML = referrals.map(referral => `
            <div class="history-item">
                <div class="history-date">${Utils.formatDate(referral.createdAt?.toDate() || new Date())}</div>
                <div class="history-details">
                    <strong>${referral.referralType || 'Unknown'} Referral</strong>
                    <p>${referral.details || 'No details provided'}</p>
                    <small>Teacher: ${referral.teacher || 'Unknown'} | Subject: ${referral.learningArea || 'Unknown'}</small>
                </div>
            </div>
        `).join('');

        historySection.style.display = 'block';
    }

    updateStepIndicator(referralCount) {
        const indicator = document.getElementById('stepIndicator');
        const title = document.getElementById('stepTitle');
        const description = document.getElementById('stepDescription');
        
        if (!indicator || !title || !description) return;

        if (referralCount === 0) {
            indicator.style.display = 'none';
            return;
        }

        let step, stepTitle, stepDesc;
        
        if (referralCount <= 2) {
            step = 1;
            stepTitle = '🎯 Step 1: Initial Intervention';
            stepDesc = 'Student receiving initial support and guidance.';
        } else if (referralCount <= 5) {
            step = 2;
            stepTitle = '📞 Step 2: Parent Contact';
            stepDesc = 'Parents contacted for collaborative support.';
        } else {
            step = 3;
            stepTitle = '🔄 Step 3: Formal Support Plan';
            stepDesc = 'Formal support plan and intensive intervention required.';
        }

        title.textContent = stepTitle;
        description.textContent = stepDesc;
        indicator.style.display = 'block';
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            this.state.reflectionFile = null;
            return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('❌ Only JPG, PNG, and PDF files are allowed', 'error');
            event.target.value = '';
            this.state.reflectionFile = null;
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showToast('❌ File size must be less than 10MB', 'error');
            event.target.value = '';
            this.state.reflectionFile = null;
            return;
        }

        this.state.reflectionFile = file;
        console.log('📄 File selected:', file.name);
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            this.showToast('❌ Please complete all required fields', 'error');
            return;
        }

        await this.submitReferral();
    }

    validateForm() {
        const requiredFields = [
            'selectedStudentId', 'lessonSelect', 'classroomSelect', 
            'teacherSelect', 'learningAreaSelect', 'behaviorTypeSelect', 
            'detailsInput', 'referralType'
        ];

        let isValid = true;

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field || !field.value || !field.value.trim()) {
                isValid = false;
                this.markFieldInvalid(fieldId);
            } else {
                this.markFieldValid(fieldId);
            }
        });

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = !isValid;
        }

        return isValid;
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        if (field.value && field.value.trim()) {
            this.markFieldValid(fieldId);
        } else {
            this.markFieldInvalid(fieldId);
        }
    }

    markFieldValid(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('field-invalid');
            field.classList.add('field-valid');
        }
    }

    markFieldInvalid(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('field-valid');
            field.classList.add('field-invalid');
        }
    }

    async submitReferral() {
        const submitBtn = document.getElementById('submitBtn');
        if (!submitBtn) return;

        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Submitting...';

        try {
            // Prepare referral data
            const referralData = await this.prepareReferralData();
            
            // Save to Firebase
            const docRef = await this.db.collection('referrals').add(referralData);
            
            console.log('✅ Referral saved with ID:', docRef.id);
            
            // Send email notification
            await this.sendEmailNotification(referralData);
            
            // Show success message
            this.showToast('✅ Referral submitted successfully!', 'success');
            
            // Reset form
            this.resetForm();
            
        } catch (error) {
            console.error('❌ Failed to submit referral:', error);
            this.handleError({
                type: 'submission',
                message: 'Failed to submit referral',
                error: error,
                severity: 'error'
            });
            this.showToast('❌ Failed to submit referral. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async prepareReferralData() {
        const student = this.state.selectedStudent;
        const staff = JSON.parse(localStorage.getItem('loggedInStaff'));
        
        const referralData = {
            // Student information
            studentId: document.getElementById('selectedStudentId').value,
            studentName: student ? `${student.FirstName} ${student.LegalSurname1}` : '',
            studentHouse: student?.HouseName || '',
            
            // Incident details
            referralType: document.getElementById('referralType').value,
            lesson: document.getElementById('lessonSelect').value,
            classroom: document.getElementById('classroomSelect').value,
            teacher: document.getElementById('teacherSelect').value,
            learningArea: document.getElementById('learningAreaSelect').value,
            behaviorType: document.getElementById('behaviorTypeSelect').value,
            details: document.getElementById('detailsInput').value,
            
            // Metadata
            submittedBy: staff?.['staff name'] || 'Unknown',
            submittedByEmail: staff?.email || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            
            // File attachment
            reflection: null
        };

        // Handle file upload if present
        if (this.state.reflectionFile) {
            referralData.reflection = await this.processFileUpload(this.state.reflectionFile);
        }

        return referralData;
    }

    async processFileUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    data: reader.result,
                    uploadedAt: new Date().toISOString()
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async sendEmailNotification(referralData) {
        try {
            const student = this.state.selectedStudent;
            if (!student) return;

            const parentInfo = this.data.parentEmails[student.BCEID1];
            const houseInfo = this.data.houseCompanions[student.HouseName];
            const teacherEmail = this.data.teacherEmails[referralData.teacher];

            const to = parentInfo?.email || '';
            const cc = houseInfo?.email || '';
            const bcc = teacherEmail || '';
            
            const subject = encodeURIComponent(`Re-Engagement Room Referral - ${student.FirstName} ${student.LegalSurname1}`);
            const body = encodeURIComponent(`Dear Parent/Carer,

Your child ${student.FirstName} ${student.LegalSurname1} has been referred to the Re-Engagement Room as part of our Triple R Process (Reset, Rethink, Rebuild).

Referral Details:
- Type: ${referralData.referralType}
- Subject: ${referralData.learningArea}
- Teacher: ${referralData.teacher}
- Lesson: ${referralData.lesson}

This is part of our positive behavior support system to help ${student.FirstName} learn and grow from this experience.

We will be in touch to discuss next steps.

Regards,
Sophia College Staff`);

            const mailtoUrl = `mailto:${to}?cc=${cc}&bcc=${bcc}&subject=${subject}&body=${body}`;
            window.location.href = mailtoUrl;

        } catch (error) {
            console.warn('⚠️ Email notification failed:', error);
            // Don't throw error - email is not critical
        }
    }

    resetForm() {
        const form = document.getElementById('referralForm');
        if (form) {
            form.reset();
        }

        // Clear selected student
        this.state.selectedStudent = null;
        this.state.reflectionFile = null;
        document.getElementById('selectedStudentId').value = '';
        document.getElementById('referralType').value = '';

        // Hide student profile and history
        const profile = document.getElementById('studentProfile');
        const history = document.getElementById('historySection');
        if (profile) profile.style.display = 'none';
        if (history) history.style.display = 'none';

        // Clear referral type selection
        document.querySelectorAll('.type-option').forEach(option => {
            option.classList.remove('selected');
            option.setAttribute('aria-checked', 'false');
        });

        // Reset validation styles
        document.querySelectorAll('.field-valid, .field-invalid').forEach(field => {
            field.classList.remove('field-valid', 'field-invalid');
        });

        // Disable submit button
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        console.log('🔄 Form reset completed');
    }

    handleOutsideClick(event) {
        const dropdown = document.getElementById('studentDropdown');
        const searchInput = document.getElementById('studentSearch');
        
        if (dropdown && searchInput && 
            !dropdown.contains(event.target) && 
            !searchInput.contains(event.target)) {
            this.hideSearchDropdown();
        }
    }

    handleKeyboardNavigation(event) {
        // ESC key closes dropdowns
        if (event.key === 'Escape') {
            this.hideSearchDropdown();
        }

        // Handle dropdown navigation
        const dropdown = document.getElementById('studentDropdown');
        if (dropdown && dropdown.style.display === 'block') {
            const options = dropdown.querySelectorAll('.student-option');
            if (options.length === 0) return;

            let currentIndex = -1;
            options.forEach((option, index) => {
                if (option.classList.contains('selected')) {
                    currentIndex = index;
                }
            });

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                currentIndex = (currentIndex + 1) % options.length;
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                currentIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
            } else if (event.key === 'Enter' && currentIndex >= 0) {
                event.preventDefault();
                options[currentIndex].click();
                return;
            }

            // Update selection
            options.forEach((option, index) => {
                option.classList.toggle('selected', index === currentIndex);
            });
        }
    }

    handleResize() {
        // Handle responsive adjustments if needed
        // Currently placeholder for future responsive features
    }

    // Tab management functions
    switchTab(tabName, buttonElement) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Activate selected button
        if (buttonElement) {
            buttonElement.classList.add('active');
            buttonElement.setAttribute('aria-selected', 'true');
        }

        // Update state
        this.state.currentTab = tabName;

        // Load tab-specific content
        this.loadTabContent(tabName);

        console.log(`📄 Switched to tab: ${tabName}`);
    }

    loadTabContent(tabName) {
        switch (tabName) {
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'manage':
                this.loadReferralManagement();
                break;
            case 'masterlist':
                this.loadMasterList();
                break;
            case 'admin':
                this.loadAdminPanel();
                break;
            default:
                // Submit tab is default, no additional loading needed
                break;
        }
    }

    loadAnalytics() {
        console.log('📊 Loading analytics...');
        // TODO: Implement analytics dashboard
    }

    loadReferralManagement() {
        console.log('📋 Loading referral management...');
        // TODO: Implement referral management interface
    }

    loadMasterList() {
        console.log('📋 Loading master list...');
        // TODO: Implement master list functionality
    }

    loadAdminPanel() {
        console.log('⚙️ Loading admin panel...');
        // TODO: Implement admin panel
    }

    // Referral type selection
    selectReferralType(type, element) {
        // Clear previous selections
        document.querySelectorAll('.type-option').forEach(option => {
            option.classList.remove('selected');
            option.setAttribute('aria-checked', 'false');
        });

        // Select clicked option
        element.classList.add('selected');
        element.setAttribute('aria-checked', 'true');

        // Update hidden field
        document.getElementById('referralType').value = type;

        // Validate form
        this.validateForm();

        console.log(`📋 Referral type selected: ${type}`);
    }

    handleTypeKeydown(event, type, element) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.selectReferralType(type, element);
        }
    }

    // Utility methods
    showLoadingState(show) {
        const loadingStatus = document.getElementById('loadingStatus');
        if (loadingStatus) {
            loadingStatus.style.display = show ? 'flex' : 'none';
        }

        // Toggle loading class on main content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.classList.toggle('loading-state', show);
        }
    }

    showToast(message, type = 'info') {
        if (this.uiManager) {
            this.uiManager.showToast(message, type);
        } else {
            // Fallback toast implementation
            const toast = document.getElementById('toast');
            if (toast) {
                toast.textContent = message;
                toast.className = `toast ${type} show`;
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 4000);
            }
        }
    }

    handleError(errorInfo) {
        if (this.errorHandler) {
            this.errorHandler.handleError(errorInfo);
        } else {
            console.error('Error:', errorInfo);
        }
    }

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
        if (this.dataManager) {
            this.dataManager.clearCache();
        }
        this.state.searchCache.clear();
        
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
                houseCompanions: Object.keys(this.data.houseCompanions).length,
                behaviorTypes: this.data.behaviorTypes.length
            },
            cacheStats: this.dataManager?.getCacheStats() || {},
            eventListeners: this.eventListeners.size,
            currentTab: this.state.currentTab,
            selectedStudent: this.state.selectedStudent?.BCEID1 || null
        };
    }

    async reloadData() {
        console.log('🔄 Manual data reload triggered...');
        if (this.dataManager) {
            this.dataManager.clearCache();
        }
        this.state.searchCache.clear();
        await this.loadAllData();
        this.showToast('✅ Data reloaded successfully!', 'success');
    }
}

// Global functions for HTML onclick handlers
window.switchTab = (tabName, buttonElement) => {
    if (window.RRSystem) {
        window.RRSystem.switchTab(tabName, buttonElement);
    }
};

window.selectReferralType = (type, element) => {
    if (window.RRSystem) {
        window.RRSystem.selectReferralType(type, element);
    }
};

window.handleTypeKeydown = (event, type, element) => {
    if (window.RRSystem) {
        window.RRSystem.handleTypeKeydown(event, type, element);
    }
};

window.logout = () => {
    if (window.RRSystem) {
        window.RRSystem.logout();
    }
};

// Initialize system when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, initializing Re-Engagement Room System...');
    
    try {
        // Create global instance
        window.RRSystem = new ReEngagementRoomSystem();
        
        // Initialize system
        await window.RRSystem.init();
        
        console.log('✅ Re-Engagement Room System ready');
        
    } catch (error) {
        console.error('❌ Failed to initialize system:', error);
        
        // Show fallback error message
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = '❌ System initialization failed. Please refresh the page.';
            toast.className = 'toast error show';
        }
    }
});

// Development helpers (available in console)
window.getSystemStats = () => window.RRSystem?.getSystemStats();
window.reloadData = () => window.RRSystem?.reloadData();

console.log('📜 Enhanced Re-Engagement Room System script loaded');
console.log('🧪 Available development commands:');
console.log('  - getSystemStats() - View system statistics');
console.log('  - reloadData() - Reload all CSV data');
console.log('  - RRSystem.showToast("message", "type") - Show toast notification');