// Enhanced Admin Dashboard System with full functionality restored
class AdminDashboardSystem {
  constructor() {
    this.dataManager = null;
    this.students = [];
    this.parentEmails = {};
    this.companions = {};
    this.infraData = [];
    this.outData = [];
    this.affirmationData = [];
    this.outOfClassCounts = {};
    this.filteredInfraData = [];
    this.filteredOutData = [];
    this.filteredAffirmationData = []; 
    this.selectedInfringements = new Set();
    this.selectedOutOfClass = new Set();
    this.emailTemplates = {}; 
    this.charts = {};
    this.currentSort = { column: null, direction: null, table: null };

    
    
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Admin Dashboard...');
      this.showLoadingState(true);
      this.dataManager = new SophiaDataManager();
      await this.checkAdminAuthentication();
      await this.loadSystemData();
      await this.loadEmailTemplates(); 
      this.setupDataSubscriptions();
      this.setupEventListeners();
      this.showLoadingState(false);
      this.dataManager.showToast('✅ Admin Dashboard ready!', 'success');
    } catch (error) {
      console.error('❌ Admin Dashboard initialization failed:', error);
      if (this.dataManager) this.dataManager.showToast(`❌ Initialization failed: ${error.message}`, 'error');
      if (error.message.includes('Authentication') || error.message.includes('Access denied')) {
        setTimeout(() => { window.location.href = error.message.includes('Access denied') ? 'home.html' : 'index.html'; }, 2000);
      }
    }
  }

  async checkAdminAuthentication() {
    const staff = await this.dataManager.checkAuthentication();
    if (staff.adminaccess !== 'Y') throw new Error('Access denied: Administrator privileges required.');
    console.log('✅ Administrator access confirmed for:', staff['staff name']);
    const staffNameElement = document.getElementById('staffName');
    if (staffNameElement) staffNameElement.textContent = staff['staff name'];
    return staff;
  }

  async loadSystemData() {
    console.log('📚 Loading system data...');
    const [students, parentEmails, houseCompanions] = await Promise.all([
      this.dataManager.loadStudents(),
      this.dataManager.loadParentEmails(),
      this.dataManager.loadHouseCompanions()
    ]);
    this.students = students; 
    this.parentEmails = parentEmails; 
    this.companions = houseCompanions;
    this.populateHouseFilters(); 
    this.dataManager.populateSelect('houseFilterAffirmations', this.dataManager.createFilterDropdowns(this.students).houses, 'All Houses'); 
    console.log('✅ Loaded ' + students.length + ' students, ' + Object.keys(parentEmails).length + ' parent emails, ' + Object.keys(houseCompanions).length + ' companions.');
  }

  populateHouseFilters() {
    const filters = this.dataManager.createFilterDropdowns(this.students);
    ['houseFilterInfr', 'houseFilterOut', 'houseFilterAffirmations'].forEach(id => this.dataManager.populateSelect(id, filters.houses, 'All Houses'));
  }

  async loadEmailTemplates() {
    console.log('📧 Loading email templates...');
    for (let step = 1; step <= 6; step++) {
      try {
        const response = await fetch(`uniformtemplates/step${step}_uniform_infringement.txt`);
        this.emailTemplates[step] = response.ok ? await response.text() : this.generateFallbackTemplate(step);
      } catch (error) { this.emailTemplates[step] = this.generateFallbackTemplate(step); }
    }
    try {
        const response = await fetch(`uniformtemplates/affirmation_notification.txt`);
        this.emailTemplates.affirmation = response.ok ? await response.text() : this.generateFallbackAffirmationTemplate();
    } catch (error) {
        console.error('Failed to load affirmation email template:', error);
        this.emailTemplates.affirmation = this.generateFallbackAffirmationTemplate();
    }
  }

  generateFallbackAffirmationTemplate() {
    return 'Subject: Positive Affirmation for {studentName} at Sophia College\n\n' +
           'Dear {parentName},\n\n' +
           'We are delighted to share a positive affirmation that was recently submitted for {studentName}:\n\n' +
           '"{affirmationText}"\n\n' +
           'This recognition was submitted by: {staffName}.\n\n' +
           'Kind regards,\nSophia College';
  }

  generateFallbackTemplate(step) {
    const messages = { 
      1: "five uniform infringements...", 
      2: "ten...", 
      3: "fifteen...", 
      4: "twenty...", 
      5: "twenty-five...", 
      6: "thirty..." 
    };
    return 'Subject: Uniform Infringement Notification – Step ' + step + '\n\n' +
           'Dear {parentName},\n\n' +
           'This email is to notify you that {studentName} has now received ' + messages[step] + '\n\n' +
           'Kind regards,\n' +
           '{houseCompanion}\n' +
           'House Companion\n' +
           'Sophia College';
  }

  setupDataSubscriptions() {
    this.dataManager.subscribeToCollection('infringements', null, (s) => this.handleInfringementsUpdate(s));
    this.dataManager.subscribeToCollection('outofclass', null, (s) => this.handleOutOfClassUpdate(s));
    this.dataManager.subscribeToCollection('affirmations', null, (s) => this.handleAffirmationsUpdate(s)); 
  }
  
  parseCustomDateString(dateString) {
    // Expected format: "DD/MM/YYYY HH:MM AM/PM" e.g., "20/06/2025 11:23 AM"
    if (!dateString || typeof dateString !== 'string') return null;

    const parts = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!parts) {
        console.warn(`Could not parse date string: ${dateString}`);
        return null;
    }

    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[3], 10);
    let hours = parseInt(parts[4], 10);
    const minutes = parseInt(parts[5], 10);
    const ampm = parts[6].toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0; // Midnight case

    const date = new Date(year, month, day, hours, minutes);
    if (isNaN(date.getTime())) {
        console.warn(`Constructed invalid date from: ${dateString}`);
        return null;
    }
    return date;
  }


  handleAffirmationsUpdate(snapshot) {
    console.log('🔄 Handling affirmations update, docs:', snapshot.docs.length);
    this.affirmationData = snapshot.docs.map(doc => {
      const data = doc.data();
      let studentDetails = this.students.find(s => s.BCEID1 === data.studentBCEID) || {};
      
      let parsedDate = null;
      if (data.timestamp) {
        if (typeof data.timestamp.toDate === 'function') { // Firebase Timestamp object
          parsedDate = data.timestamp.toDate();
        } else if (typeof data.timestamp === 'string') { 
            if (data.timestamp.includes('/') && (data.timestamp.includes('AM') || data.timestamp.includes('PM'))) {
                // Try parsing "DD/MM/YYYY HH:MM AM/PM"
                parsedDate = this.parseCustomDateString(data.timestamp);
                if (!parsedDate) { // If custom parse fails, try ISO as a fallback
                    parsedDate = new Date(data.timestamp); 
                }
            } else { // Assume ISO string if not custom format
                parsedDate = new Date(data.timestamp);
            }
            if (isNaN(parsedDate?.getTime())) { // Check if any parsing resulted in invalid date
                console.warn(`Invalid/unparseable timestamp string for affirmation doc ${doc.id}:`, data.timestamp);
                parsedDate = null; 
            }
        } else if (typeof data.timestamp === 'number') { // Unix timestamp (milliseconds)
            parsedDate = new Date(data.timestamp);
             if (isNaN(parsedDate.getTime())) {
                console.warn(`Invalid numeric timestamp for affirmation doc ${doc.id}:`, data.timestamp);
                parsedDate = null; 
            }
        } else {
          console.warn(`Unrecognized timestamp format for affirmation doc ${doc.id}:`, data.timestamp);
          parsedDate = null; 
        }
      }
      
      if (!parsedDate) { // If all parsing attempts failed or no timestamp
        parsedDate = new Date(); 
        console.warn(`Missing or unparseable timestamp for affirmation doc ${doc.id}, defaulting to now.`);
      }


      return {
        id: doc.id,
        date: parsedDate,
        studentBCEID: data.studentBCEID || 'N/A',
        studentName: data.studentName || `${studentDetails.FirstName || ''} ${studentDetails.LegalSurname1 || ''}`.trim() || 'N/A',
        house: data.studentHouse || studentDetails.HouseName || 'N/A',
        affirmationText: data.affirmation || 'N/A', 
        staffName: data.staffName || 'N/A',
        ui_emailSent: data.ui_emailSent || false 
      };
    });
    this.affirmationData.sort((a,b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    this.filteredAffirmationData = [...this.affirmationData];
    this.renderAffirmationsTable();
    this.updateAffirmationsTabWarning();
    if (document.getElementById('analytics-tab')?.classList.contains('active')) this.renderCharts();
  }

  updateAffirmationsTabWarning() {
    const pendingCount = this.affirmationData.filter(item => !item.ui_emailSent).length;
    const affirmationsTab = document.getElementById('affirmationsNavTab');
    if (affirmationsTab) {
      const baseText = '✨ Affirmations';
      if (pendingCount >= 5) {
        affirmationsTab.innerHTML = `${baseText} <span aria-label="warning, 5 or more pending">⚠️</span>`;
      } else {
        affirmationsTab.innerHTML = baseText;
      }
    }
  }

  handleInfringementsUpdate(snapshot) {
    const summary = {};
    this.infraData = snapshot.docs.map(doc => {
      const data = doc.data();
      let studentDetails = this.students.find(s => s.BCEID1 === data.studentBCEID) || {}; 
      
      summary[data.studentBCEID] = (summary[data.studentBCEID] || 0) + 1; 

      let parsedDate = null;
      if (data.timestamp) {
        if (typeof data.timestamp.toDate === 'function') { 
          parsedDate = data.timestamp.toDate();
        } else if (typeof data.timestamp === 'string' && data.timestamp.length > 0) { 
          parsedDate = new Date(data.timestamp);
          if (isNaN(parsedDate.getTime())) {
            console.warn(`Invalid timestamp string for infringement doc ${doc.id}:`, data.timestamp);
            parsedDate = null; 
          }
        } else if (typeof data.timestamp === 'number') { 
            parsedDate = new Date(data.timestamp);
             if (isNaN(parsedDate.getTime())) {
                console.warn(`Invalid numeric timestamp for infringement doc ${doc.id}:`, data.timestamp);
                parsedDate = null; 
            }
        } else {
          console.warn(`Unrecognized timestamp format for infringement doc ${doc.id}:`, data.timestamp);
          parsedDate = null; 
        }
      } else {
        parsedDate = new Date(); 
        console.warn(`Missing timestamp for infringement doc ${doc.id}, defaulting to now.`);
      }

      return {
        id: doc.id,
        student: data.studentBCEID, 
        date: parsedDate, 
        name: data.studentName || `${studentDetails.FirstName || ''} ${studentDetails.LegalSurname1 || ''}`.trim() || 'N/A',
        house: data.studentHouse || studentDetails.HouseName || 'N/A',
        yearLevel: data.studentYearLevel || studentDetails.YearLevelName || 'N/A', 
        infringement: data.infringementType || 'N/A', 
        staff: data.staffName || 'N/A', 
        step: this.calculateStep(summary[data.studentBCEID]),
        emailedSteps: data.emailedSteps || {}
      };
    });
    this.infraData.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0)); 
    this.filteredInfraData = [...this.infraData]; 
    this.updateStats(); 
    this.renderInfringementsTable(); 
    this.renderEmailTriggers();
    if (document.getElementById('analytics-tab')?.classList.contains('active')) this.renderCharts();
  }

  handleOutOfClassUpdate(snapshot) {
    this.outData = snapshot.docs.map(doc => {
      const data = doc.data();
      const student = this.students.find(s => s.BCEID1 === (data.studentBCEID || data.student)) || {}; 

      let parsedDate = null;
      if (data.timestamp) {
        if (typeof data.timestamp.toDate === 'function') { 
          parsedDate = data.timestamp.toDate();
        } else if (typeof data.timestamp === 'string' && data.timestamp.length > 0) {
          parsedDate = new Date(data.timestamp);
          if (isNaN(parsedDate.getTime())) {
            console.warn(`Invalid timestamp string for outofclass doc ${doc.id}:`, data.timestamp);
            parsedDate = null; 
          }
        } else if (typeof data.timestamp === 'number') {
            parsedDate = new Date(data.timestamp);
             if (isNaN(parsedDate.getTime())) {
                console.warn(`Invalid numeric timestamp for outofclass doc ${doc.id}:`, data.timestamp);
                parsedDate = null; 
            }
        } else {
          console.warn(`Unrecognized timestamp format for outofclass doc ${doc.id}:`, data.timestamp);
          parsedDate = null; 
        }
      } else {
        parsedDate = new Date(); 
        console.warn(`Missing timestamp for outofclass doc ${doc.id}, defaulting to now.`);
      }

      return {
        id: doc.id, date: parsedDate, 
        student: data.studentBCEID || data.student, 
        name: data.studentName || `${student.FirstName || ''} ${student.LegalSurname1 || ''}`.trim() || 'N/A',
        house: data.studentHouse || student.HouseName || 'N/A', 
        yearLevel: data.studentYearLevel || student.YearLevelName || 'N/A',
        reason: data.reason || 'N/A',
        details: data.details || '', 
        staff: data.staffName || data.staff || 'N/A' 
      };
    });
    this.outData.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    
    this.outOfClassCounts = {};
    this.outData.forEach(log => {
      if (log.student) {
        this.outOfClassCounts[log.student] = (this.outOfClassCounts[log.student] || 0) + 1;
      }
    });

    this.filteredOutData = [...this.outData]; 
    this.updateStats(); 
    this.renderOutOfClassTable(); 
    this.populateReasonFilter();
    if (document.getElementById('analytics-tab')?.classList.contains('active')) this.renderCharts();
  }

  setupEventListeners() {
    document.getElementById('searchInfringements')?.addEventListener('input', () => this.filterInfringements());
    document.getElementById('houseFilterInfr')?.addEventListener('change', () => this.filterInfringements());
    document.getElementById('dateFilterInfr')?.addEventListener('change', () => this.filterInfringements());
    document.getElementById('searchOutOfClass')?.addEventListener('input', () => this.filterOutOfClass());
    document.getElementById('houseFilterOut')?.addEventListener('change', () => this.filterOutOfClass());
    document.getElementById('reasonFilter')?.addEventListener('change', () => this.filterOutOfClass());
    // Event listeners for affirmations tab
    document.getElementById('searchAffirmations')?.addEventListener('input', () => this.filterAffirmations());
    document.getElementById('houseFilterAffirmations')?.addEventListener('change', () => this.filterAffirmations());
    document.getElementById('dateFilterAffirmations')?.addEventListener('change', () => this.filterAffirmations());
  }
  
  calculateStep = count => count >= 30 ? 6 : count >= 25 ? 5 : count >= 20 ? 4 : count >= 15 ? 3 : count >= 10 ? 2 : count >= 5 ? 1 : 0;

  updateStats() {
    document.getElementById('totalInfringements').textContent = this.infraData.length;
    document.getElementById('totalOutOfClass').textContent = this.outData.length;
    const studentCounts = {}; this.infraData.forEach(item => studentCounts[item.student] = (studentCounts[item.student] || 0) + 1);
    const pendingEmails = Object.keys(studentCounts).filter(studentId => {
        const step = this.calculateStep(studentCounts[studentId]);
        const record = this.infraData.find(item => item.student === studentId); 
        const parentEmail = this.parentEmails[studentId]?.email;
        return step > 0 && (!record || !record.emailedSteps || !record.emailedSteps[step]) && parentEmail;
    }).length;
    document.getElementById('pendingEmails').textContent = pendingEmails;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayActivity = this.infraData.filter(i => i.date && i.date >= today).length + this.outData.filter(i => i.date && i.date >= today).length;
    document.getElementById('todayActivity').textContent = todayActivity;
    
    const lateToClassCount = this.infraData.filter(item => item.infringement === 'Late to Class').length;
    document.getElementById('lateToClass').textContent = lateToClassCount;

    document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  }

  async refreshData() {
    this.dataManager.showToast('🔄 Refreshing data...', 'info');
    try {
      await this.loadSystemData(); 
      this.dataManager.showToast('✅ Data refreshed successfully', 'success');
    } catch (error) {
      this.dataManager.showToast('❌ Error refreshing data', 'error');
    }
  }

  sendAllPendingEmails() {
    const studentCounts = {};
    this.infraData.forEach(item => studentCounts[item.student] = (studentCounts[item.student] || 0) + 1);
    
    const pendingStudents = Object.keys(studentCounts).filter(studentId => {
      const step = this.calculateStep(studentCounts[studentId]);
      const record = this.infraData.find(item => item.student === studentId); 
      const parentEmail = this.parentEmails[studentId]?.email;
      return step > 0 && (!record || !record.emailedSteps || !record.emailedSteps[step]) && parentEmail;
    });

    if (pendingStudents.length === 0) {
      this.dataManager.showToast('⚠️ No pending emails to send', 'warning');
      return;
    }

    if (!confirm('Send step notification emails to ' + pendingStudents.length + ' students? This will open multiple email windows.')) return;

    pendingStudents.forEach((studentId, index) => {
      setTimeout(() => {
        const student = this.students.find(s => s.BCEID1 === studentId);
        const step = this.calculateStep(studentCounts[studentId]);
        const name = (student?.FirstName || '') + ' ' + (student?.LegalSurname1 || '');
        const house = student?.HouseName || 'N/A';
        this.sendStepEmail(studentId, step, name, house);
      }, 1000 * index); 
    });
  }

  previewEmailTemplate() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-content">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title">📧 Email Template Preview</h2>' +
        '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="margin-bottom: 16px;">' +
          '<label>Select Step:</label>' +
          '<select id="templateStepSelect" onchange="adminSystem.showTemplatePreview(this.value)" style="margin-left: 8px; padding: 4px 8px;">' +
            '<option value="1">Step 1 (5 infringements)</option>' +
            '<option value="2">Step 2 (10 infringements)</option>' +
            '<option value="3">Step 3 (15 infringements)</option>' +
            '<option value="4">Step 4 (20 infringements)</option>' +
            '<option value="5">Step 5 (25 infringements)</option>' +
            '<option value="6">Step 6 (30 infringements)</option>' +
            '<option value="affirmation">Affirmation</option>' +
          '</select>' +
        '</div>' +
        '<div id="templatePreview" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 16px; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem; max-height: 400px; overflow-y: auto;">' +
          'Select a step to preview the email template' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">Close</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    this.showTemplatePreview(document.getElementById('templateStepSelect').value);
  }

  showTemplatePreview(stepOrType) {
    const template = this.emailTemplates[stepOrType] || 'Template not found';
    const previewDiv = document.getElementById('templatePreview');
    if (previewDiv) {
      previewDiv.textContent = template;
    }
  }

  exportEmailLog() {
    const emailLog = [];
    this.infraData.forEach(item => {
      if (item.emailedSteps) {
        Object.keys(item.emailedSteps).forEach(step => {
          if (item.emailedSteps[step]) {
            emailLog.push({
              Student: item.name,
              StudentID: item.student,
              House: item.house,
              Step: step,
              EmailSent: 'Yes',
              Date: item.date ? item.date.toLocaleDateString() : 'N/A'
            });
          }
        });
      }
    });

    if (emailLog.length === 0) {
      this.dataManager.showToast('⚠️ No email log data to export', 'warning');
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + 
      "Student,StudentID,House,Step,EmailSent,Date\n" +
      emailLog.map(row => 
        '"' + row.Student + '","' + row.StudentID + '","' + row.House + '","' + row.Step + '","' + row.EmailSent + '","' + row.Date + '"'
      ).join("\n");
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "email_log_export_" + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.dataManager.showToast('📥 Email log exported successfully', 'success');
  }
  
  showLoadingState(show) { document.getElementById('loadingState').style.display = show ? 'block' : 'none'; document.getElementById('mainInterface').style.display = show ? 'none' : 'block'; }
  logout() { this.destroyCharts(); this.dataManager?.logout(); }
  
  filterInfringements = this.dataManager?.debounce(() => {
    const term = document.getElementById('searchInfringements').value.toLowerCase();
    const house = document.getElementById('houseFilterInfr').value;
    const date = document.getElementById('dateFilterInfr').value;
    this.filteredInfraData = this.infraData.filter(item => 
      (!term || item.name.toLowerCase().includes(term) || item.student.includes(term)) &&
      (!house || item.house === house) &&
      this.dataManager.dateFilter(item.date, date)
    );
    this.renderInfringementsTable();
  }, 300);

  filterOutOfClass = this.dataManager?.debounce(() => {
    const term = document.getElementById('searchOutOfClass').value.toLowerCase();
    const house = document.getElementById('houseFilterOut').value;
    const reason = document.getElementById('reasonFilter').value;
    this.filteredOutData = this.outData.filter(item => 
      (!term || item.name.toLowerCase().includes(term) || item.reason.toLowerCase().includes(term)) &&
      (!house || item.house === house) && (!reason || item.reason === reason)
    );
    this.renderOutOfClassTable();
  }, 300);

  filterAffirmations = this.dataManager?.debounce(() => {
    const term = document.getElementById('searchAffirmations').value.toLowerCase();
    const house = document.getElementById('houseFilterAffirmations').value;
    const date = document.getElementById('dateFilterAffirmations').value;
    
    this.filteredAffirmationData = this.affirmationData.filter(item => 
      (!term || item.studentName.toLowerCase().includes(term) || (item.studentBCEID && item.studentBCEID.toLowerCase().includes(term)) || item.affirmationText.toLowerCase().includes(term) || item.staffName.toLowerCase().includes(term)) &&
      (!house || item.house === house) &&
      this.dataManager.dateFilter(item.date, date)
    );
    this.renderAffirmationsTable();
  }, 300);

  renderTable(tbodyId, countId, data, renderRowFunc) {
    const tbody = document.getElementById(tbodyId);
    const countEl = document.getElementById(countId);
    tbody.innerHTML = '';
    if (countEl) countEl.textContent = data.length + ' records';
    
    if (data.length === 0) {
      const colSpan = tbody.closest('table').querySelector('thead tr').children.length;
      let emptyMessage = '';
      
      if (tbodyId === 'infringementsTableBody') {
        emptyMessage = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No infringement records found</div><div class="empty-state-desc">Try adjusting your search filters or date range</div></div>';
      } else if (tbodyId === 'outOfClassTableBody') {
        emptyMessage = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No out-of-class records found</div><div class="empty-state-desc">Try adjusting your search filters</div></div>';
      } else if (tbodyId === 'emailTriggersTableBody') {
        emptyMessage = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">No pending email notifications</div><div class="empty-state-desc">All students are below step thresholds or emails have been sent</div></div>';
      } else if (tbodyId === 'affirmationsTableBody') {
        emptyMessage = '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-title">No affirmations found</div><div class="empty-state-desc">Try adjusting your search filters or date range</div></div>';
      }
      
      tbody.innerHTML = '<tr><td colspan="' + colSpan + '">' + emptyMessage + '</td></tr>';
      return;
    }
    
    data.forEach(item => tbody.appendChild(renderRowFunc(item)));
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return this.dataManager.sanitizeHTML(text);
    
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return this.dataManager.sanitizeHTML(text).replace(regex, '<span class="search-highlight">$1</span>');
  }

  renderInfringementsTable() {
    const studentCounts = {}; 
    this.infraData.forEach(item => studentCounts[item.student] = (studentCounts[item.student] || 0) + 1);
    const searchTerm = document.getElementById('searchInfringements')?.value || '';
    
    this.renderTable('infringementsTableBody', 'infringementsCount', this.filteredInfraData, item => {
      const isSelected = this.selectedInfringements.has(item.id);
      const row = document.createElement('tr');
      if (isSelected) row.classList.add('selected-row');
      const totalInfractions = studentCounts[item.student] || 0;
      const formattedDate = this.dataManager.formatDate(item.date);
      
      row.innerHTML = '<td><input type="checkbox" name="infrCheckbox" value="' + item.id + '" ' + (isSelected ? 'checked' : '') + ' onchange="adminSystem.handleRowSelection(this, \'infringements\')"></td>' +
        '<td><div class="text-strong">' + (formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? formattedDate.split(',')[0] : formattedDate) + '</div><div class="text-muted">' + (item.date && formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? item.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '') + '</div></td>' +
        '<td><div class="text-strong">' + this.highlightSearchTerm(item.name, searchTerm) + '</div><div class="text-muted">' + this.highlightSearchTerm(item.student, searchTerm) + '</div></td>' +
        '<td><span class="badge badge-primary">' + this.dataManager.sanitizeHTML(item.house) + '</span></td>' +
        '<td>' + this.dataManager.sanitizeHTML(item.infringement) + '</td>' +
        '<td><div class="text-strong">' + totalInfractions + '</div><div class="text-muted">total</div></td>' +
        '<td><span class="status-indicator status-step-' + item.step + '">Step ' + item.step + '</span></td>' +
        '<td class="text-muted">' + this.dataManager.sanitizeHTML(item.staff) + '</td>' +
        '<td><button class="btn btn-danger" onclick="adminSystem.confirmDelete(\'infringement\', () => adminSystem.deleteInfringement(\'' + item.id + '\'))">🗑️</button></td>';
      return row;
    });
  }

  renderOutOfClassTable() {
    const searchTerm = document.getElementById('searchOutOfClass')?.value || '';
    
    this.renderTable('outOfClassTableBody', 'outOfClassCount', this.filteredOutData, item => {
      const isSelected = this.selectedOutOfClass.has(item.id);
      const row = document.createElement('tr');
      if (isSelected) row.classList.add('selected-row');

      const studentLogCount = this.outOfClassCounts[item.student] || 0;
      if (studentLogCount >= 5) {
        row.classList.add('row-warning');
      }

      const formattedDate = this.dataManager.formatDate(item.date);
      
      row.innerHTML = '<td><input type="checkbox" name="outCheckbox" value="' + item.id + '" ' + (isSelected ? 'checked' : '') + ' onchange="adminSystem.handleRowSelection(this, \'outofclass\')"></td>' +
        '<td><div class="text-strong">' + (formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? formattedDate.split(',')[0] : formattedDate) + '</div><div class="text-muted">' + (item.date && formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? item.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '') + '</div></td>' +
        '<td><div class="text-strong">' + this.highlightSearchTerm(item.name, searchTerm) + '</div><div class="text-muted">' + this.highlightSearchTerm(item.student, searchTerm) + '</div></td>' +
        '<td><span class="badge badge-primary">' + this.dataManager.sanitizeHTML(item.house) + '</span></td>' +
        '<td>' + this.dataManager.sanitizeHTML(item.reason) + '</td>' +
        '<td class="text-muted">' + this.dataManager.sanitizeHTML(item.details || '—') + '</td>' +
        '<td class="text-muted">' + this.dataManager.sanitizeHTML(item.staff) + '</td>' +
        '<td><button class="btn btn-danger" onclick="adminSystem.confirmDelete(\'out-of-class log\', () => adminSystem.deleteOutOfClass(\'' + item.id + '\'))">🗑️</button></td>';
      return row;
    });
  }

  renderAffirmationsTable() {
    const searchTerm = document.getElementById('searchAffirmations')?.value || '';
    this.renderTable('affirmationsTableBody', 'affirmationsCount', this.filteredAffirmationData, item => {
      const row = document.createElement('tr');
      const formattedDate = this.dataManager.formatDate(item.date);
      const emailButtonIcon = item.ui_emailSent ? '✅' : '📧';
      const emailButtonTitle = item.ui_emailSent ? 'Email Sent (Session)' : 'Send Affirmation Email';
      const emailButtonClass = item.ui_emailSent ? 'btn-secondary' : 'btn-success';


      row.innerHTML = 
        '<td><div class="text-strong">' + (formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? formattedDate.split(',')[0] : formattedDate) + '</div><div class="text-muted">' + (item.date && formattedDate !== "N/A" && formattedDate !== "Invalid Date" ? item.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '') + '</div></td>' +
        '<td><div class="text-strong">' + this.highlightSearchTerm(item.studentName, searchTerm) + '</div><div class="text-muted">' + this.highlightSearchTerm(item.studentBCEID, searchTerm) + '</div></td>' +
        '<td><span class="badge badge-primary">' + this.dataManager.sanitizeHTML(item.house) + '</span></td>' +
        '<td style="white-space: pre-wrap; max-width: 400px; word-break: break-word;">' + this.highlightSearchTerm(item.affirmationText, searchTerm) + '</td>' +
        '<td class="text-muted">' + this.dataManager.sanitizeHTML(item.staffName) + '</td>' +
        '<td>' +
          '<button class="btn ' + emailButtonClass + '" style="margin-right: 8px;" onclick="adminSystem.sendAffirmationEmail(\'' + item.id + '\')" title="' + emailButtonTitle + '">' + emailButtonIcon + '</button>' +
          '<button class="btn btn-danger" onclick="adminSystem.confirmDelete(\'affirmation\', () => adminSystem.deleteAffirmation(\'' + item.id + '\'))" title="Delete Affirmation">🗑️</button>' +
        '</td>';
      return row;
    });
  }
  
  async deleteAffirmation(id) { 
    try { 
        await this.dataManager.db.collection('affirmations').doc(id).delete(); 
        this.dataManager.showToast('✅ Affirmation deleted', 'success'); 
    } catch (e) { 
        this.dataManager.showToast('❌ Error deleting affirmation', 'error'); 
        console.error("Error deleting affirmation:", e);
    } 
  }

  sendAffirmationEmail(affirmationId) {
    const affirmation = this.affirmationData.find(aff => aff.id === affirmationId);
    if (!affirmation) {
        this.dataManager.showToast('❌ Affirmation not found.', 'error');
        return;
    }

    const template = this.emailTemplates.affirmation;
    if (!template) {
        this.dataManager.showToast('📧 Affirmation email template not found.', 'error');
        return;
    }
    
    const studentDetails = this.students.find(s => s.BCEID1 === affirmation.studentBCEID);
    const studentEmail = studentDetails?.BCEEmail1;
    const parentData = this.parentEmails[affirmation.studentBCEID];
    const parentEmail = parentData?.email;
    const companion = this.companions[affirmation.house];
    const companionEmail = companion?.email;

    if (!studentEmail) {
        this.dataManager.showToast(`📧 No email address found for student ${affirmation.studentName}.`, 'error');
        return;
    }
    
    const studentNameToUse = (studentDetails && studentDetails.FirstName && studentDetails.LegalSurname1) 
                           ? `${studentDetails.FirstName} ${studentDetails.LegalSurname1}` 
                           : affirmation.studentName;

    const variables = {
        parentName: parentData?.name || 'Parent/Guardian', // Use parent name if available for salutation
        studentName: studentNameToUse,
        affirmationText: affirmation.affirmationText,
        staffName: affirmation.staffName 
    };

    const { subject, body } = this.processEmailTemplate(template, variables);

    const toEmail = studentEmail;
    const ccEmails = [parentEmail, companionEmail].filter(Boolean); // Filter out any null/undefined emails

    this.showEmailConfirmationModal(
        affirmation.studentName,
        'Affirmation',
        subject,
        body,
        toEmail,
        ccEmails.join(','), // Join CC emails with a comma
        () => {
            let mailto = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            if (ccEmails.length > 0) {
                mailto += `&cc=${encodeURIComponent(ccEmails.join(','))}`;
            }
            window.open(mailto);
            this.dataManager.showToast(`📧 Affirmation email for ${affirmation.studentName} opened.`, 'success');
            affirmation.ui_emailSent = true;
            this.renderAffirmationsTable();
            this.updateAffirmationsTabWarning();
        }
    );
  }


  renderEmailTriggers() {
    const studentCounts = {};
    this.infraData.forEach(item => studentCounts[item.student] = (studentCounts[item.student] || 0) + 1);
    const triggers = Object.entries(studentCounts).map(([studentId, count]) => {
      const step = this.calculateStep(count);
      if (step === 0) return null;
      const student = this.students.find(s => s.BCEID1 === studentId) || {};
      const latestRecord = this.infraData.find(item => item.student === studentId); 
      const emailSent = latestRecord?.emailedSteps?.[step]; 
      const parentData = this.parentEmails[studentId];
      return { 
        studentId, 
        name: (student.FirstName || '') + ' ' + (student.LegalSurname1 || ''), 
        house: student.HouseName || 'N/A', 
        step, 
        count, 
        emailSent, 
        email: parentData?.email 
      };
    }).filter(Boolean);
    
    const pendingCount = triggers.filter(t => !t.emailSent && t.email).length;
    document.getElementById('emailTriggersCount').textContent = pendingCount + ' pending';
    
    this.renderTable('emailTriggersTableBody', null, triggers, trigger => {
      const row = document.createElement('tr');
      const emailStatus = trigger.emailSent ? '<span class="email-sent">✅ Sent</span>' : 
        trigger.email ? '<span class="badge badge-warning">⏳ Pending</span>' : 
        '<span class="badge badge-danger">❌ No Email</span>';
      
      const actionButton = !trigger.emailSent && trigger.email ? 
        '<button class="btn btn-success" onclick="adminSystem.sendStepEmail(\'' + trigger.studentId + '\', ' + trigger.step + ', \'' + trigger.name.replace(/'/g, "\\'") + '\', \'' + trigger.house + '\')">📧 Send</button>' :
        '<span class="text-muted">—</span>';
      
      row.innerHTML = '<td><div class="text-strong">' + this.dataManager.sanitizeHTML(trigger.name) + '</div><div class="text-muted">' + this.dataManager.sanitizeHTML(trigger.studentId) + '</div></td>' +
        '<td><span class="badge badge-primary">' + this.dataManager.sanitizeHTML(trigger.house) + '</span></td>' +
        '<td><span class="status-indicator status-step-' + trigger.step + '">Step ' + trigger.step + '</span></td>' +
        '<td><div class="text-strong">' + trigger.count + '</div></td>' +
        '<td>' + emailStatus + '</td>' +
        '<td>' + actionButton + '</td>';
      return row;
    });
  }

  populateReasonFilter() {
    const reasons = [...new Set(this.outData.map(item => item.reason))].filter(Boolean).sort();
    this.dataManager.populateSelect('reasonFilter', reasons, 'All Reasons');
  }

  handleRowSelection(checkbox, type) {
    const id = checkbox.value;
    const set = type === 'infringements' ? this.selectedInfringements : this.selectedOutOfClass;
    checkbox.checked ? set.add(id) : set.delete(id);
    checkbox.closest('tr').classList.toggle('selected-row', checkbox.checked);
    this.updateBulkActionsBar(type);
  }
  
  updateBulkActionsBar(type) {
    const set = type === 'infringements' ? this.selectedInfringements : this.selectedOutOfClass;
    const bar = document.getElementById(type === 'infringements' ? 'bulkActionsBar' : 'bulkActionsBarOut');
    const countEl = document.getElementById(type === 'infringements' ? 'selectedCount' : 'selectedCountOut');
    bar.style.display = set.size > 0 ? 'flex' : 'none';
    countEl.textContent = set.size;
  }

  confirmDelete(type, cb) { if (confirm(`Delete this ${type}? This action cannot be undone.`)) cb(); }
  async deleteInfringement(id) { try { await this.dataManager.db.collection('infringements').doc(id).delete(); this.dataManager.showToast('✅ Infringement deleted', 'success'); } catch (e) { this.dataManager.showToast('❌ Error deleting', 'error'); } }
  async deleteOutOfClass(id) { try { await this.dataManager.db.collection('outofclass').doc(id).delete(); this.dataManager.showToast('✅ Log deleted', 'success'); } catch (e) { this.dataManager.showToast('❌ Error deleting', 'error'); } }
  
  sendStepEmail(studentId, step, studentName, house) {
    const template = this.emailTemplates[step];
    if (!template) return this.dataManager.showToast('📧 Template not found for Step ' + step, 'error');
    const parentData = this.parentEmails[studentId];
    if (!parentData?.email) return this.dataManager.showToast('📧 No parent email for ' + studentName, 'warning');
    const companion = this.companions[house];
    const variables = { 
      parentName: parentData.name || 'Parent/Guardian', 
      studentName, 
      houseCompanion: companion?.name || (house + ' House Companion'), 
      date: this.getNextSchoolDay(), 
      startTime: '3:30 PM', 
      endTime: '4:30 PM' 
    };
    const { subject, body } = this.processEmailTemplate(template, variables);
    this.showEmailConfirmationModal(studentName, step, subject, body, parentData.email, companion?.email, () => {
        const mailto = 'mailto:' + parentData.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + (companion?.email ? '&cc=' + encodeURIComponent(companion.email) : '');
        window.open(mailto);
        this.markEmailAsSent(studentId, step);
        this.dataManager.showToast('📧 Step ' + step + ' email for ' + studentName + ' opened', 'success');
    });
  }
  
  processEmailTemplate(template, variables) {
    let processed = Object.entries(variables).reduce((acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), value || ''), template);
    const [subjectLine, ...bodyLines] = processed.split('\n');
    const subject = subjectLine.startsWith('Subject:') ? subjectLine.replace('Subject: ', '') : 'Notification'; 
    return { subject, body: bodyLines.join('\n').trim() };
  }
  
  getNextSchoolDay() { 
    const d = new Date(); 
    d.setDate(d.getDate() + (d.getDay() === 5 ? 3 : d.getDay() === 6 ? 2 : 1)); 
    return d.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); 
  }
  
  showEmailConfirmationModal(studentName, typeOrStep, subject, body, to, cc, onConfirm) { 
    document.getElementById('emailConfirmModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'emailConfirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-content">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title">Email Confirmation</h2>' +
        '<button class="modal-close" onclick="adminSystem.closeEmailConfirmModal()">×</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<p>Send ' + (typeof typeOrStep === 'number' ? `Step ${typeOrStep}` : typeOrStep) + ' notification for <strong>' + studentName + '</strong>?</p>' +
        '<div style="background:var(--gray-50);border-left:4px solid var(--primary-maroon);padding:16px;margin:20px 0;border-radius:8px;">' +
          '<h4 style="margin:0 0 12px 0;color:var(--primary-maroon);">Recipients</h4>' +
          '<div style="margin:6px 0;">📧 TO: ' + to + '</div>' +
          (cc ? '<div style="margin:6px 0;">📬 CC: ' + cc + '</div>' : '') +
        '</div>' +
        '<div style="border:1px solid var(--gray-200);border-radius:8px;margin:20px 0;overflow:hidden;">' +
          '<div style="background:var(--gray-50);padding:12px 16px;border-bottom:1px solid var(--gray-200);"><strong>Subject:</strong> ' + subject + '</div>' +
          '<div style="padding:16px;white-space:pre-wrap;max-height:200px;overflow-y:auto;">' + body + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" onclick="adminSystem.closeEmailConfirmModal()">Cancel</button>' +
        '<button class="btn btn-primary" onclick="adminSystem.confirmSendStepEmail()">📧 Send Email</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    window.currentEmailCallback = onConfirm;
  }
  
  closeEmailConfirmModal() { document.getElementById('emailConfirmModal')?.remove(); window.currentEmailCallback = null; }
  confirmSendStepEmail() { if (window.currentEmailCallback) window.currentEmailCallback(); this.closeEmailConfirmModal(); }

  async markEmailAsSent(studentId, step) {
    const studentInfringements = this.infraData.filter(item => item.student === studentId).sort((a,b) => b.date - a.date);
    if (studentInfringements.length > 0) {
        const latestRecordId = studentInfringements[0].id;
        try { 
            const updateField = `emailedSteps.step${step}`; 
            const updateObj = {};
            updateObj[updateField] = true;
            await this.dataManager.db.collection('infringements').doc(latestRecordId).update(updateObj); 
            console.log(`Marked email sent for student ${studentId}, step ${step} on record ${latestRecordId}`);
        } catch (e) { 
            console.error(`Error marking email as sent for student ${studentId}, step ${step}:`, e);
            this.dataManager.showToast('⚠️ Failed to mark email as sent in DB', 'warning'); 
        }
    } else {
        console.warn(`No infringement records found for student ${studentId} to mark email as sent.`);
    }
  }

  renderCharts() {
    if (typeof Chart === 'undefined') {
      console.error('❌ Chart.js not loaded');
      this.dataManager.showToast('❌ Chart library not available', 'error');
      return;
    }

    if (this.infraData.length === 0 && this.outData.length === 0 && this.affirmationData.length === 0) {
      console.log('📊 No data available for any charts');
      this.showEmptyChartsMessage();
      return;
    }

    console.log('📊 Rendering analytics charts...');
    
    this.showChartLoadingStates();
    
    try {
      this.destroyCharts(); 
      setTimeout(() => { 
        this.renderHouseChart();
        this.renderInfringementTypesChart();
        this.renderTopStudentsChart();
        this.renderOutOfClassReasonChart();
        this.renderOutOfClassHouseChart();
        this.renderTrendsChart(); 
        this.renderAffirmationsByHouseChart();
        this.renderTopStaffAffirmationsChart();
        this.renderLateToClassByHouseChart();
        this.renderTopLateStudentsChart();
        
        this.hideChartLoadingStates();
        this.dataManager.showToast('📊 Analytics loaded successfully', 'success');
      }, 100);
    } catch (error) {
      console.error('❌ Error rendering charts:', error);
      this.hideChartLoadingStates();
      this.dataManager.showToast('❌ Error loading analytics', 'error');
    }
  }

  showChartLoadingStates() {
    const chartCards = document.querySelectorAll('.chart-card');
    chartCards.forEach(card => {
      if (!card.querySelector('.chart-loading')) {
        const loading = document.createElement('div');
        loading.className = 'chart-loading';
        loading.innerHTML = '<div class="loading-spinner"></div>';
        card.appendChild(loading);
      }
    });
  }

  hideChartLoadingStates() {
    const loadingElements = document.querySelectorAll('.chart-loading');
    loadingElements.forEach(el => el.remove());
  }

  showEmptyChartsMessage() {
    const chartContexts = {
        houseChart: this.infraData.length > 0,
        infrTypeChart: this.infraData.length > 0,
        topStudentsChart: this.infraData.length > 0,
        outReasonChart: this.outData.length > 0,
        outHouseChart: this.outData.length > 0,
        trendsChart: this.infraData.length > 0 || this.outData.length > 0 || this.affirmationData.length > 0,
        affirmationsByHouseChart: this.affirmationData.length > 0,
        topStaffAffirmationsChart: this.affirmationData.length > 0,
        lateByHouseChart: this.infraData.some(i => i.infringement === 'Late to Class'),
        topLateStudentsChart: this.infraData.some(i => i.infringement === 'Late to Class')
    };

    Object.entries(chartContexts).forEach(([canvasId, hasData]) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const parent = canvas.parentElement;
        const existingMsg = parent.querySelector('.empty-chart-message');

        if (hasData) {
            canvas.style.display = '';
            if (existingMsg) existingMsg.remove();
        } else {
            canvas.style.display = 'none';
            if (!existingMsg) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-chart-message';
                emptyMsg.innerHTML = '<div>📊</div><div>No data available for this chart</div>';
                parent.appendChild(emptyMsg);
            }
        }
    });
  }

  renderHouseChart() {
    const houseData = {};
    this.infraData.forEach(item => houseData[item.house] = (houseData[item.house] || 0) + 1);
    const ctx = document.getElementById('houseChart');
    if (!ctx || Object.keys(houseData).length === 0) {
      this.showEmptyChartsMessage(); 
      return;
    }
    this.charts.house = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(houseData),
        datasets: [{ data: Object.values(houseData), backgroundColor: this.getChartColors(Object.keys(houseData).length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  renderInfringementTypesChart() {
    const typeData = {};
    this.infraData.forEach(item => typeData[item.infringement] = (typeData[item.infringement] || 0) + 1);
    const ctx = document.getElementById('infrTypeChart');
     if (!ctx || Object.keys(typeData).length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.infrType = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(typeData),
        datasets: [{ data: Object.values(typeData), backgroundColor: this.getChartColors(Object.keys(typeData).length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

  renderTopStudentsChart() {
    const studentCounts = {};
    this.infraData.forEach(item => studentCounts[item.name] = (studentCounts[item.name] || 0) + 1);
    const sortedStudents = Object.entries(studentCounts).sort(([,a], [,b]) => b - a).slice(0, 10);
    const ctx = document.getElementById('topStudentsChart');
    if (!ctx || sortedStudents.length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.topStudents = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedStudents.map(([name]) => name),
        datasets: [{ data: sortedStudents.map(([,count]) => count), backgroundColor: this.getChartColors(sortedStudents.length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

  renderOutOfClassReasonChart() {
    const reasonData = {};
    this.outData.forEach(item => reasonData[item.reason] = (reasonData[item.reason] || 0) + 1);
    const ctx = document.getElementById('outReasonChart');
    if (!ctx || Object.keys(reasonData).length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.outReason = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(reasonData),
        datasets: [{ data: Object.values(reasonData), backgroundColor: this.getChartColors(Object.keys(reasonData).length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  renderOutOfClassHouseChart() {
    const houseData = {};
    this.outData.forEach(item => houseData[item.house] = (houseData[item.house] || 0) + 1);
    const ctx = document.getElementById('outHouseChart');
    if (!ctx || Object.keys(houseData).length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.outHouse = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(houseData),
        datasets: [{ data: Object.values(houseData), backgroundColor: this.getChartColors(Object.keys(houseData).length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
  
  renderAffirmationsByHouseChart() {
    const houseData = {};
    this.affirmationData.forEach(item => houseData[item.house] = (houseData[item.house] || 0) + 1);
    const ctx = document.getElementById('affirmationsByHouseChart');
    if (!ctx || Object.keys(houseData).length === 0) {
        this.showEmptyChartsMessage();
        return;
    }
    this.charts.affirmationsByHouse = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(houseData),
            datasets: [{ data: Object.values(houseData), backgroundColor: this.getChartColors(Object.keys(houseData).length, true) }] 
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  renderTopStaffAffirmationsChart() {
      const staffCounts = {};
      this.affirmationData.forEach(item => staffCounts[item.staffName] = (staffCounts[item.staffName] || 0) + 1);
      const sortedStaff = Object.entries(staffCounts).sort(([,a], [,b]) => b - a).slice(0, 10);
      const ctx = document.getElementById('topStaffAffirmationsChart');
      if (!ctx || sortedStaff.length === 0) {
          this.showEmptyChartsMessage();
          return;
      }
      this.charts.topStaffAffirmations = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: sortedStaff.map(([name]) => name),
              datasets: [{ label: 'Affirmations Submitted', data: sortedStaff.map(([,count]) => count), backgroundColor: this.getChartColors(sortedStaff.length, true) }]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

  renderLateToClassByHouseChart() {
    const lateData = this.infraData.filter(item => item.infringement === 'Late to Class');
    const houseData = {};
    lateData.forEach(item => houseData[item.house] = (houseData[item.house] || 0) + 1);
    const ctx = document.getElementById('lateByHouseChart');
    if (!ctx || Object.keys(houseData).length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.lateByHouse = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(houseData),
        datasets: [{ data: Object.values(houseData), backgroundColor: this.getChartColors(Object.keys(houseData).length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  renderTopLateStudentsChart() {
    const lateData = this.infraData.filter(item => item.infringement === 'Late to Class');
    const studentCounts = {};
    lateData.forEach(item => studentCounts[item.name] = (studentCounts[item.name] || 0) + 1);
    const sortedStudents = Object.entries(studentCounts).sort(([,a], [,b]) => b - a).slice(0, 10);
    const ctx = document.getElementById('topLateStudentsChart');
    if (!ctx || sortedStudents.length === 0) {
      this.showEmptyChartsMessage();
      return;
    }
    this.charts.topLateStudents = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedStudents.map(([name]) => name),
        datasets: [{ label: 'Late to Class Count', data: sortedStudents.map(([,count]) => count), backgroundColor: this.getChartColors(sortedStudents.length) }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

  renderTrendsChart() {
    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last7Days.push(date);
    }
    
    const infraTrends = last7Days.map(date => {
      const dayStr = date.toDateString();
      return this.infraData.filter(item => item.date && item.date.toDateString() === dayStr).length;
    });
    
    const outTrends = last7Days.map(date => {
      const dayStr = date.toDateString();
      return this.outData.filter(item => item.date && item.date.toDateString() === dayStr).length;
    });

    const affirmationTrends = last7Days.map(date => {
        const dayStr = date.toDateString();
        return this.affirmationData.filter(item => item.date && item.date.toDateString() === dayStr).length;
    });

    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;
    this.charts.trends = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7Days.map(date => date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })),
        datasets: [
          { label: 'Infringements', data: infraTrends, borderColor: '#660000', backgroundColor: 'rgba(102, 0, 0, 0.1)', tension: 0.4 },
          { label: 'Out-of-Class', data: outTrends, borderColor: '#003057', backgroundColor: 'rgba(0, 48, 87, 0.1)', tension: 0.4 },
          { label: 'Affirmations', data: affirmationTrends, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', tension: 0.4 } 
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

  destroyCharts() {
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    this.charts = {};
  }

  getChartColors(count, useSecondaryPalette = false) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const primaryLight = ['#660000', '#003057', '#059669', '#d97706', '#dc2626', '#0284c7', '#7c3aed', '#db2777', '#16a34a', '#ea580c'];
    const primaryDark = ['#993333', '#2a5298', '#36a281', '#f0a500', '#ff5252', '#3b9eff', '#a06cd5', '#f06292', '#4caf50', '#ff8f00'];
    
    const secondaryLight = ['#065f46', '#0c4a6e', '#7c2d12', '#581c87', '#9f1239', '#047857', '#0369a1', '#854d0e', '#4a044e', '#881337'];
    const secondaryDark = ['#34d399', '#38bdf8', '#fb923c', '#c084fc', '#f472b6', '#2dd4bf', '#2563eb', '#f59e0b', '#a855f7', '#e11d48'];

    let baseColors;
    if (useSecondaryPalette) {
        baseColors = isDarkMode ? secondaryDark : secondaryLight;
    } else {
        baseColors = isDarkMode ? primaryDark : primaryLight;
    }
    
    return Array.from({length: count}, (_, i) => baseColors[i % baseColors.length]);
  }
}

// Global navigation and utility functions
function navigate(url) { window.location.href = url; }

const THEME_KEY = 'sophia_admin_theme';

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = isDark ? '☀️' : '🌓';
    themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }
  if (adminSystem && adminSystem.charts && document.getElementById('analytics-tab')?.classList.contains('active')) {
    adminSystem.renderCharts(); 
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const themeToggle = document.getElementById('themeToggle');

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    if (themeToggle) themeToggle.textContent = '🌓';
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) { 
      document.body.classList.toggle('dark-mode', e.matches);
      if (themeToggle) themeToggle.textContent = e.matches ? '☀️' : '🌓';
       if (adminSystem && adminSystem.charts && document.getElementById('analytics-tab')?.classList.contains('active')) {
        adminSystem.renderCharts();
      }
    }
  });
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

function switchTab(tabName, buttonElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName + '-tab')?.classList.add('active');
  buttonElement?.classList.add('active');
  if (tabName === 'analytics' && adminSystem) setTimeout(() => adminSystem.renderCharts(), 100);
}

// COMPLETE bulk operation functions
function toggleSelectAll(type) {
  const checkbox = document.getElementById(type === 'infringements' ? 'selectAllInfr' : 'selectAllOut');
  const isChecked = checkbox.checked;
  
  if (type === 'infringements') {
    const checkboxes = document.querySelectorAll('input[name="infrCheckbox"]');
    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) {
        adminSystem.selectedInfringements.add(cb.value);
        cb.closest('tr').classList.add('selected-row');
      } else {
        adminSystem.selectedInfringements.delete(cb.value);
        cb.closest('tr').classList.remove('selected-row');
      }
    });
    adminSystem.updateBulkActionsBar('infringements');
  } else {
    const checkboxes = document.querySelectorAll('input[name="outCheckbox"]');
    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) {
        adminSystem.selectedOutOfClass.add(cb.value);
        cb.closest('tr').classList.add('selected-row');
      } else {
        adminSystem.selectedOutOfClass.delete(cb.value);
        cb.closest('tr').classList.remove('selected-row');
      }
    });
    adminSystem.updateBulkActionsBar('outofclass');
  }
}

function selectAllInfringements() {
  document.getElementById('selectAllInfr').checked = true;
  toggleSelectAll('infringements');
}

function clearSelectionInfringements() {
  document.getElementById('selectAllInfr').checked = false;
  adminSystem.selectedInfringements.clear();
  document.querySelectorAll('input[name="infrCheckbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('tr').classList.remove('selected-row');
  });
  adminSystem.updateBulkActionsBar('infringements');
}

function selectAllOutOfClass() {
  document.getElementById('selectAllOut').checked = true;
  toggleSelectAll('outofclass');
}

function clearSelectionOutOfClass() {
  document.getElementById('selectAllOut').checked = false;
  adminSystem.selectedOutOfClass.clear();
  document.querySelectorAll('input[name="outCheckbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('tr').classList.remove('selected-row');
  });
  adminSystem.updateBulkActionsBar('outofclass');
}

async function bulkDeleteInfringements() {
  if (adminSystem.selectedInfringements.size === 0) {
    adminSystem.dataManager.showToast('⚠️ No items selected for deletion', 'warning');
    return;
  }
  
  if (!confirm('Are you sure you want to delete ' + adminSystem.selectedInfringements.size + ' selected infringement(s)? This action cannot be undone.')) return;
  
  adminSystem.dataManager.showToast('🗑️ Deleting selected infringements...', 'info');
  
  try {
    const deletePromises = Array.from(adminSystem.selectedInfringements).map(id => 
      adminSystem.dataManager.db.collection('infringements').doc(id).delete()
    );
    
    await Promise.all(deletePromises);
    adminSystem.dataManager.showToast('✅ ' + adminSystem.selectedInfringements.size + ' infringements deleted successfully', 'success');
    clearSelectionInfringements();
  } catch (error) {
    console.error('Error bulk deleting:', error);
    adminSystem.dataManager.showToast('❌ Error deleting some infringements', 'error');
  }
}

async function bulkDeleteOutOfClass() {
  if (adminSystem.selectedOutOfClass.size === 0) {
    adminSystem.dataManager.showToast('⚠️ No items selected for deletion', 'warning');
    return;
  }
  
  if (!confirm('Are you sure you want to delete ' + adminSystem.selectedOutOfClass.size + ' selected out-of-class log(s)? This action cannot be undone.')) return;
  
  adminSystem.dataManager.showToast('🗑️ Deleting selected logs...', 'info');
  
  try {
    const deletePromises = Array.from(adminSystem.selectedOutOfClass).map(id => 
      adminSystem.dataManager.db.collection('outofclass').doc(id).delete()
    );
    
    await Promise.all(deletePromises);
    adminSystem.dataManager.showToast('✅ ' + adminSystem.selectedOutOfClass.size + ' logs deleted successfully', 'success');
    clearSelectionOutOfClass();
  } catch (error) {
    console.error('Error bulk deleting:', error);
    adminSystem.dataManager.showToast('❌ Error deleting some logs', 'error');
  }
}

function bulkEmailParents() {
  if (adminSystem.selectedInfringements.size === 0) {
    adminSystem.dataManager.showToast('⚠️ No items selected for email notifications', 'warning');
    return;
  }
  
  const selectedRecords = adminSystem.infraData.filter(item => 
    adminSystem.selectedInfringements.has(item.id)
  );
  
  const studentSteps = {};
  selectedRecords.forEach(record => {
    if (!studentSteps[record.student]) {
      const parentData = adminSystem.parentEmails[record.student];
      studentSteps[record.student] = {
        name: record.name,
        house: record.house,
        step: record.step,
        email: parentData ? parentData.email : null
      };
    }
  });
  
  const eligibleStudents = Object.values(studentSteps).filter(student => 
    student.step > 0 && student.email
  );
  
  if (eligibleStudents.length === 0) {
    adminSystem.dataManager.showToast('⚠️ No eligible students for step emails found', 'warning');
    return;
  }
  
  const confirmMessage = 'Send step notification emails to ' + eligibleStudents.length + ' student(s)?\n\n' +
    eligibleStudents.map(s => '• ' + s.name + ' (Step ' + s.step + ')').join('\n');
  
  if (!confirm(confirmMessage)) return;
  
  eligibleStudents.forEach((student, index) => {
    setTimeout(() => {
      const studentId = Object.keys(studentSteps).find(id => 
        studentSteps[id] === student
      );
      adminSystem.sendStepEmail(studentId, student.step, student.name, student.house);
    }, 500 * index);
  });
  
  adminSystem.dataManager.showToast('📧 Initiating step emails for ' + eligibleStudents.length + ' students', 'info');
}

function exportInfringements() {
  const csvContent = "data:text/csv;charset=utf-8," + 
    "Date,Student,House,Infringement,Step,Staff\n" +
    adminSystem.filteredInfraData.map(item => 
      '"' + item.date.toLocaleDateString() + '","' + item.name + '","' + item.house + '","' + item.infringement + '",' + item.step + ',"' + item.staff + '"'
    ).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "infringements_export_" + new Date().toISOString().split('T')[0] + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  adminSystem.dataManager.showToast('📥 Data exported successfully', 'success');
}

function exportOutOfClass() {
  const csvContent = "data:text/csv;charset=utf-8," + 
    "Date,Student Name,House,Reason,Details,Staff\n" +
    adminSystem.filteredOutData.map(item => 
      '"' + item.date.toLocaleDateString() + '","' + item.name + '","' + item.house + '","' + item.reason + '","' + item.details.replace(/"/g, '""') + '","' + item.staff + '"'
    ).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "outofclass_export_" + new Date().toISOString().split('T')[0] + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  adminSystem.dataManager.showToast('📥 Data exported successfully', 'success');
}

function exportAffirmations() {
    if (adminSystem.filteredAffirmationData.length === 0) {
        adminSystem.dataManager.showToast('⚠️ No affirmation data to export', 'warning');
        return;
    }
    const csvContent = "data:text/csv;charset=utf-8," +
        "Date,Student Name,Student ID,House,Affirmation,Submitted By\n" +
        adminSystem.filteredAffirmationData.map(item =>
            '"' + (item.date ? item.date.toLocaleDateString() : 'N/A') + '",' +
            '"' + item.studentName.replace(/"/g, '""') + '",' +
            '"' + item.studentBCEID.replace(/"/g, '""') + '",' +
            '"' + item.house.replace(/"/g, '""') + '",' +
            '"' + item.affirmationText.replace(/"/g, '""') + '",' +
            '"' + item.staffName.replace(/"/g, '""') + '"'
        ).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "affirmations_export_" + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    adminSystem.dataManager.showToast('📥 Affirmations exported successfully', 'success');
}


function showSemesterWipeWarning() {
  const warningMessage = '⚠️ CRITICAL WARNING ⚠️\n\n' +
    '🚨 SEMESTER WIPE OPERATION 🚨\n\n' +
    'This action will:\n' +
    '✅ Export ALL current data to CSV\n' +
    '❌ PERMANENTLY DELETE all infringement records\n' +
    '❌ PERMANENTLY DELETE all out-of-class records\n' +
    '🔄 Reset system for new semester\n\n' +
    '⚠️ THIS ACTION CANNOT BE UNDONE ⚠️\n\n' +
    'Are you absolutely certain you want to proceed?\n\n' +
    'This should only be done at the end of a semester when you need to start fresh with new data.';

  if (confirm(warningMessage)) {
    exportAndWipeData();
  }
}

async function exportAndWipeData() {
  const confirmMessage = '🚨 SEMESTER WIPE CONFIRMATION 🚨\n\n' +
    'This action will:\n' +
    '1. Export ALL data to CSV files\n' +
    '2. PERMANENTLY DELETE all infringement records\n' +
    '3. PERMANENTLY DELETE all out-of-class records\n' +
    '4. PERMANENTLY DELETE all affirmation records\n' +
    '5. PERMANENTLY DELETE all re-engagement referrals\n' +
    '6. PERMANENTLY DELETE all email logs\n' +
    '7. Clear the system for a new semester\n\n' +
    '⚠️ THIS CANNOT BE UNDONE ⚠️\n\n' +
    'Are you absolutely sure you want to proceed?\n\n' +
    'Type "CONFIRM WIPE" in the prompt that follows if you are certain.';
  
  if (!confirm(confirmMessage)) return;
  
  const confirmText = prompt('Type "CONFIRM WIPE" to proceed with semester wipe:');
  if (confirmText !== 'CONFIRM WIPE') {
    adminSystem.dataManager.showToast('❌ Semester wipe cancelled', 'warning');
    return;
  }
  
  adminSystem.dataManager.showToast('📤 Exporting all data and preparing for semester wipe...', 'info');
  
  try {
    // Fetch all data from Firebase collections
    const [
      infringementsSnapshot,
      outOfClassSnapshot, 
      affirmationsSnapshot,
      referralsSnapshot,
      emailLogsSnapshot
    ] = await Promise.all([
      adminSystem.dataManager.db.collection('infringements').get(),
      adminSystem.dataManager.db.collection('outofclass').get(),
      adminSystem.dataManager.db.collection('affirmations').get(),
      adminSystem.dataManager.db.collection('referrals').get(),
      adminSystem.dataManager.db.collection('stepEmailsLog').get()
    ]);

    // Calculate student infringement counts
    const studentCounts = {};
    infringementsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const studentId = data.student;
      studentCounts[studentId] = (studentCounts[studentId] || 0) + 1;
    });
    
    // Prepare comprehensive export data
    const exportData = [];
    
    // Add infringement data with steps
    infringementsSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
      const totalCount = studentCounts[item.student];
      const step = adminSystem.calculateStep(totalCount);
      
      exportData.push({
        Type: 'Infringement',
        Date: date.toLocaleDateString(),
        Time: date.toLocaleTimeString(),
        StudentID: item.student,
        StudentName: item.name,
        House: item.house,
        Details: item.infringement,
        Staff: item.staff,
        TotalCount: totalCount,
        Step: step,
        StepDescription: step > 0 ? 'Step ' + step + ' (' + totalCount + ' infringements)' : 'No step reached',
        DocumentID: doc.id
      });
    });
    
    // Add out-of-class data
    outOfClassSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
      
      exportData.push({
        Type: 'Out-of-Class',
        Date: date.toLocaleDateString(),
        Time: date.toLocaleTimeString(),
        StudentID: item.student,
        StudentName: item.name,
        House: item.house,
        Details: item.reason + (item.details ? ' - ' + item.details : ''),
        Staff: item.staff,
        TotalCount: '',
        Step: '',
        StepDescription: '',
        DocumentID: doc.id
      });
    });

    // Add affirmation data
    affirmationsSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
      
      exportData.push({
        Type: 'Affirmation',
        Date: date.toLocaleDateString(),
        Time: date.toLocaleTimeString(),
        StudentID: item.studentId,
        StudentName: item.studentName,
        House: item.house,
        Details: item.affirmationText,
        Staff: item.staffName,
        TotalCount: '',
        Step: '',
        StepDescription: '',
        DocumentID: doc.id
      });
    });

    // Add referral data
    referralsSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      
      exportData.push({
        Type: 'Re-Engagement Referral',
        Date: date.toLocaleDateString(),
        Time: date.toLocaleTimeString(),
        StudentID: item.studentId,
        StudentName: item.studentName,
        House: item.house,
        Details: item.behaviorType + (item.notes ? ' - ' + item.notes : ''),
        Staff: item.staffName,
        TotalCount: '',
        Step: '',
        StepDescription: '',
        DocumentID: doc.id
      });
    });

    // Add email log data
    emailLogsSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      
      exportData.push({
        Type: 'Email Log',
        Date: date.toLocaleDateString(),
        Time: date.toLocaleTimeString(),
        StudentID: item.studentId,
        StudentName: item.studentName,
        House: '',
        Details: 'Step ' + item.step + ' email - ' + item.status,
        Staff: item.staffName,
        TotalCount: item.totalCount,
        Step: item.step,
        StepDescription: 'Step ' + item.step + ' (' + item.totalCount + ' infringements)',
        DocumentID: doc.id
      });
    });
    
    // Create CSV content
    const headers = ['Type', 'Date', 'Time', 'StudentID', 'StudentName', 'House', 'Details', 'Staff', 'TotalCount', 'Step', 'StepDescription', 'DocumentID'];
    const csvContent = "data:text/csv;charset=utf-8," + 
      headers.join(',') + '\n' +
      exportData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          return '"' + value.toString().replace(/"/g, '""') + '"';
        }).join(',')
      ).join('\n');
    
    // Download the export
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "semester_complete_export_" + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    adminSystem.dataManager.showToast('📥 Data exported successfully! Starting system wipe...', 'success');
    
    // Now delete all data from all collections
    setTimeout(async () => {
      try {
        const collectionsToWipe = ['infringements', 'outofclass', 'affirmations', 'referrals', 'stepEmailsLog'];
        const deletePromises = [];

        for (const collectionName of collectionsToWipe) {
          const promise = adminSystem.dataManager.db.collection(collectionName).get().then(snapshot => {
            if (snapshot.docs.length > 0) {
              const batch = adminSystem.dataManager.db.batch();
              snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              return batch.commit();
            }
            return Promise.resolve();
          });
          deletePromises.push(promise);
        }
        
        await Promise.all(deletePromises);
        
        adminSystem.dataManager.showToast('🎉 Semester wipe completed! All data exported and system cleared for new semester.', 'success');
        
        // Reset local data
        adminSystem.infraData = [];
        adminSystem.outData = [];
        adminSystem.affirmationData = [];
        adminSystem.filteredInfraData = [];
        adminSystem.filteredOutData = [];
        adminSystem.filteredAffirmationData = [];
        adminSystem.selectedInfringements.clear();
        adminSystem.selectedOutOfClass.clear();
        
        // Update UI
        adminSystem.updateStats();
        adminSystem.renderInfringementsTable();
        adminSystem.renderOutOfClassTable();
        adminSystem.renderAffirmationsTable();
        adminSystem.renderEmailTriggers();
        adminSystem.renderCharts();
        
      } catch (error) {
        console.error('Error during semester wipe:', error);
        adminSystem.dataManager.showToast('❌ Error during semester wipe: ' + error.message + '. Some data may remain.', 'error');
      }
    }, 2000);

  } catch (error) {
    console.error('Error during data export:', error);
    adminSystem.dataManager.showToast('❌ Error during data export: ' + error.message, 'error');
  }
}

// COMPLETE Table sorting functionality
function sortTable(tableType, column) {
  // Update sort indicators
  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  
  let direction = 'asc';
  if (adminSystem.currentSort.column === column && adminSystem.currentSort.table === tableType && adminSystem.currentSort.direction === 'asc') {
    direction = 'desc';
  }
  
  adminSystem.currentSort = { column: column, direction: direction, table: tableType };
  
  // Add sort indicator to clicked header
  event.target.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
  
  // Sort the data
  if (tableType === 'infringements') {
    sortInfringements(column, direction);
  } else if (tableType === 'outofclass') {
    sortOutOfClass(column, direction);
  } else if (tableType === 'affirmations') { 
    sortAffirmations(column, direction);
  }
}

function sortInfringements(column, direction) {
  // Calculate infractions count for each record
  const studentCounts = {};
  adminSystem.infraData.forEach(item => {
    studentCounts[item.student] = (studentCounts[item.student] || 0) + 1;
  });
  
  adminSystem.filteredInfraData.sort((a, b) => {
    let aVal, bVal;
    
    switch(column) {
      case 'date':
        aVal = a.date ? a.date.getTime() : 0;
        bVal = b.date ? b.date.getTime() : 0;
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'house':
        aVal = a.house.toLowerCase();
        bVal = b.house.toLowerCase();
        break;
      case 'infringement':
        aVal = a.infringement.toLowerCase();
        bVal = b.infringement.toLowerCase();
        break;
      case 'infractions':
        aVal = studentCounts[a.student] || 0;
        bVal = studentCounts[b.student] || 0;
        break;
      case 'step':
        aVal = a.step;
        bVal = b.step;
        break;
      case 'staff':
        aVal = a.staff.toLowerCase();
        bVal = b.staff.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  adminSystem.renderInfringementsTable();
}

function sortOutOfClass(column, direction) {
  adminSystem.filteredOutData.sort((a, b) => {
    let aVal, bVal;
    
    switch(column) {
      case 'date':
        aVal = a.date ? a.date.getTime() : 0;
        bVal = b.date ? b.date.getTime() : 0;
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'house':
        aVal = a.house.toLowerCase();
        bVal = b.house.toLowerCase();
        break;
      case 'reason':
        aVal = a.reason.toLowerCase();
        bVal = b.reason.toLowerCase();
        break;
      case 'details':
        aVal = (a.details || '').toLowerCase();
        bVal = (b.details || '').toLowerCase();
        break;
      case 'staff':
        aVal = a.staff.toLowerCase();
        bVal = b.staff.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  adminSystem.renderOutOfClassTable();
}

function sortAffirmations(column, direction) {
  adminSystem.filteredAffirmationData.sort((a, b) => {
    let aVal, bVal;
    switch(column) {
      case 'date': aVal = a.date ? a.date.getTime() : 0; bVal = b.date ? b.date.getTime() : 0; break;
      case 'studentName': aVal = a.studentName.toLowerCase(); bVal = b.studentName.toLowerCase(); break;
      case 'house': aVal = a.house.toLowerCase(); bVal = b.house.toLowerCase(); break;
      case 'affirmationText': aVal = a.affirmationText.toLowerCase(); bVal = b.affirmationText.toLowerCase(); break;
      case 'staffName': aVal = a.staffName.toLowerCase(); bVal = b.staffName.toLowerCase(); break;
      default: return 0;
    }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  adminSystem.renderAffirmationsTable();
}

// Initialize system
let adminSystem;
document.addEventListener('DOMContentLoaded', async () => {
  const currentPage = window.location.pathname.split('/').pop();
  const links = document.querySelectorAll('.dropdown-content a');
  links.forEach(link => {
      const linkPage = link.getAttribute('href');
      if (linkPage === currentPage) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'page');
      }
  });

  initializeTheme(); // Initialize theme first
  console.log('🚀 Initializing Enhanced Admin Dashboard...');
  adminSystem = new AdminDashboardSystem();
  await adminSystem.initialize();
  window.adminSystem = adminSystem;

  // Initialize connection status listener
  if (adminSystem && adminSystem.dataManager && typeof adminSystem.dataManager.listenToConnectionStatus === 'function') {
    adminSystem.dataManager.listenToConnectionStatus(
      document.getElementById('connectionStatus'),
      document.getElementById('connectionText')
    );
  } else if (adminSystem && adminSystem.dataManager) { // Fallback if listenToConnectionStatus is not on dataManager directly
     // Attempt to use a generic Firebase listener if SophiaDataManager doesn't have a specific method
    if (typeof firebase !== 'undefined' && firebase.database) {
        const connectedRef = firebase.database().ref(".info/connected");
        const statusElement = document.getElementById('connectionStatus');
        const textElement = document.getElementById('connectionText');

        if (statusElement && textElement) {
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    statusElement.className = 'connection-status online';
                    textElement.textContent = 'Connected';
                    statusElement.style.display = 'block';
                    setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
                } else {
                    statusElement.className = 'connection-status offline';
                    textElement.textContent = 'Offline';
                    statusElement.style.display = 'block';
                }
            });
        }
    } else {
        console.warn("Firebase Database SDK not available for connection status or listenToConnectionStatus not found.");
    }
  }
});

// Handle window resize for chart responsiveness
window.addEventListener('resize', () => {
  if (adminSystem && adminSystem.charts) {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      Object.values(adminSystem.charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    }, 250);
  }
});

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (adminSystem && adminSystem.dataManager) {
    adminSystem.dataManager.showToast('An error occurred. Please refresh if issues persist.', 'error');
  }
});
