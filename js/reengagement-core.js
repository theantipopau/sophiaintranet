// reengagement-core.js (Complete)

/**
 * Sophia College Re-Engagement Room System
 * - ES6 class-based structure
 * - CSV loading via PapaParse
 * - Firebase Firestore integration
 * - Mailto-based email sending
 * - Reflection file upload (Base64)
 */
class ReengagementSystem {
  constructor() {
    this.students = [];
    this.classrooms = [];
    this.teachersCsv = [];
    this.teacherEmails = {};
    this.learningAreas = [];
    this.parentEmails = {};
    this.houseCompanions = {};
    this.reflectionBase64 = null;
    this.type = '';

    this.form = document.getElementById('referralForm');
    this.submitBtn = document.getElementById('submitBtn');
    this.toastEl = document.getElementById('toast');
  }

  init() {
    this.initFirebase();
    this.bindUI();
    this.loadAllData();
    this.showToast('System ready!', 'success');
  }

  initFirebase() {
    const config = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      this.db = firebase.firestore();
      this.showToast('Firebase connected', 'success');
    } catch (err) {
      console.error('Firebase init error:', err);
      this.showToast('Firebase init failed', 'error');
    }
  }

  loadCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: err => reject(err)
      });
    });
  }

  async loadAllData() {
    try {
      const [students, barcodes, teachers, areas, parents, companions] = await Promise.all([
        this.loadCSV('students.csv'),
        this.loadCSV('Barcodelocations.csv'),
        this.loadCSV('BCEteacherinfo.csv'),
        this.loadCSV('Learningareacategory.csv'),
        this.loadCSV('parentemail.csv'),
        this.loadCSV('housecompanions.csv')
      ]);

      this.students = students;
      this.classrooms = [...new Set(barcodes.map(b => b.Title))].sort();
      this.populate('classroomSelect', this.classrooms);

      this.teachersCsv = teachers;
      const teacherLabels = teachers.map(t => `${t.Stafffullname} (${t.BCEID})`).sort();
      this.teacherEmails = Object.fromEntries(
        teachers.map(t => [`${t.Stafffullname} (${t.BCEID})`, t.Staffemail])
      );
      this.populate('teacherSelect', teacherLabels);

      this.learningAreas = [...new Set(areas.map(a => a['Learning Area Category']))].sort();
      this.populate('learningAreaSelect', this.learningAreas);

      this.parentEmails = Object.fromEntries(
        parents.map(p => [p.BCEID1, p.ParentEmail])
      );
      this.houseCompanions = Object.fromEntries(
        companions.map(h => [h.housegroup, h.email])
      );

      this.setupStudentSearch();
      this.showToast('Data loaded', 'success');
    } catch (err) {
      console.error('Data load error:', err);
      this.showToast('Data load failed', 'error');
    }
  }

  populate(id, items) {
    const select = document.getElementById(id);
    if (!select) return;
    const placeholder = select.querySelector('option[value=""]')?.textContent || 'Select';
    select.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(item => `<option value="${item}">${item}</option>`).join('');
  }

  setupStudentSearch() {
    const input = document.getElementById('studentSearch');
    const dropdown = document.getElementById('studentDropdown');
    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      if (term.length < 2) { dropdown.style.display = 'none'; return; }
      const matches = this.students.filter(s =>
        s.FirstName.toLowerCase().includes(term) ||
        s.LegalSurname1.toLowerCase().includes(term) ||
        s.BCEID1.toLowerCase().includes(term)
      ).slice(0, 10);
      dropdown.innerHTML = matches.length
        ? matches.map(s => `<div class="student-option" data-id="${s.BCEID1}">${s.FirstName} ${s.LegalSurname1} (${s.BCEID1})</div>`).join('')
        : '<div class="student-option">No matches</div>';
      dropdown.style.display = 'block';
    });
    dropdown.addEventListener('click', e => {
      const id = e.target.dataset.id;
      if (!id) return;
      const student = this.students.find(s => s.BCEID1 === id);
      this.selectStudent(student);
      dropdown.style.display = 'none';
    });
    document.addEventListener('click', e => {
      if (!input.contains(e.target)) dropdown.style.display = 'none';
    });
  }

  selectStudent(s) {
    if (!s) return;
    document.getElementById('selectedStudentId').value = s.BCEID1;
    document.getElementById('studentSearch').value = `${s.FirstName} ${s.LegalSurname1}`;
    document.getElementById('studentPhoto').src = `students/${s.BCEID1}.jpg`;
    ['Name', 'BCEID', 'House', 'HomeGroup', 'YearLevel'].forEach(field => {
      const el = document.getElementById(`student${field}`);
      if (el) el.textContent = s[field] || '';
    });
    document.getElementById('studentProfile').style.display = 'block';
    this.validateForm();
  }

  bindUI() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab, btn)));
    document.querySelectorAll('.type-option').forEach(btn => btn.addEventListener('click', () => this.selectType(btn.dataset.type, btn)));
    document.getElementById('reflectionUpload').addEventListener('change', e => this.handleFile(e));
    ['lessonSelect','classroomSelect','teacherSelect','learningAreaSelect','detailsInput','referralType'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => this.validateForm());
      el.addEventListener('input', () => this.validateForm());
    });
    if (this.form) this.form.addEventListener('submit', e => { e.preventDefault(); this.saveReferral(); });
  }

  switchTab(tab, btn) {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  selectType(type, btn) {
    this.type = type;
    document.getElementById('referralType').value = type;
    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    this.validateForm();
  }

  handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.reflectionBase64 = reader.result; };
    reader.readAsDataURL(file);
  }

  validateForm() {
    const required = ['selectedStudentId','referralType','lessonSelect','classroomSelect','teacherSelect','learningAreaSelect','detailsInput'];
    const valid = required.every(id => {
      const el = document.getElementById(id);
      return el && el.value && el.value.trim();
    });
    this.submitBtn.disabled = !valid;
  }

  async saveReferral() {
    const data = {
      studentId: document.getElementById('selectedStudentId').value,
      referralType: this.type,
      lesson: document.getElementById('lessonSelect').value,
      classroom: document.getElementById('classroomSelect').value,
      teacher: document.getElementById('teacherSelect').value,
      learningArea: document.getElementById('learningAreaSelect').value,
      details: document.getElementById('detailsInput').value,
      reflection: this.reflectionBase64,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await this.db.collection('referrals').add(data);
      this.showToast('Referral saved!', 'success');
      this.sendEmail(data);
      this.form.reset();
      this.submitBtn.disabled = true;
      document.getElementById('studentProfile').style.display = 'none';
    } catch (err) {
      console.error('Save error:', err);
      this.showToast('Save failed', 'error');
    }
  }

  sendEmail(data) {
    const studentId = data.studentId;
    const student = this.students.find(s => s.BCEID1 === studentId) || {};
    const to = this.parentEmails[studentId] || '';
    const cc = this.houseCompanions[student.House] || '';
    const bcc = this.teacherEmails[data.teacher] || '';
    const subject = encodeURIComponent(`Referral for ${student.FirstName} ${student.LegalSurname1}`);
    const body = encodeURIComponent(`Dear Parent/Carer,\n\nPlease see referral for ${student.FirstName} ${student.LegalSurname1}.\n\nRegards,\nSophia College`);
    window.location.href = `mailto:${to}?cc=${cc}&bcc=${bcc}&subject=${subject}&body=${body}`;
  }

  showToast(msg, type='info') {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.className = `toast ${type}`;
    this.toastEl.style.transform = 'translateX(0)';
    setTimeout(() => this.toastEl.style.transform = 'translateX(400px)'), 4000;
  }
}

// Initialize when DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.reengSys = new ReengagementSystem();
  window.reengSys.init();
});