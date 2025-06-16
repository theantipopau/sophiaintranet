/**
 * Data Manager Module
 * Handles all data loading, caching, and Firebase operations
 */

class DataManager {
  constructor() {
    this.cache = new Map();
    this.loadingStates = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }

  // Enhanced CSV loading with caching and error handling
  async loadCSV(filename, useCache = true) {
    const cacheKey = `csv_${filename}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      console.log(`📋 Using cached data for ${filename}`);
      return this.cache.get(cacheKey);
    }

    if (this.loadingStates.get(cacheKey)) {
      console.log(`⏳ Already loading ${filename}, waiting...`);
      return this.loadingStates.get(cacheKey);
    }

    const loadPromise = this._loadCSVWithRetry(filename);
    this.loadingStates.set(cacheKey, loadPromise);

    try {
      const data = await loadPromise;
      this.cache.set(cacheKey, data);
      this.loadingStates.delete(cacheKey);
      this.retryAttempts.delete(filename);
      return data;
    } catch (error) {
      this.loadingStates.delete(cacheKey);
      throw error;
    }
  }

  async _loadCSVWithRetry(filename) {
    const attempts = this.retryAttempts.get(filename) || 0;
    
    try {
      return await new Promise((resolve, reject) => {
        Papa.parse(filename, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn(`⚠️ CSV parsing warnings for ${filename}:`, results.errors);
            }
            console.log(`✅ CSV loaded: ${filename} (${results.data.length} rows)`);
            resolve(results.data);
          },
          error: (error) => {
            console.error(`❌ CSV error for ${filename}:`, error);
            reject(new Error(`Failed to load ${filename}: ${error.message}`));
          }
        });
      });
    } catch (error) {
      if (attempts < this.maxRetries) {
        this.retryAttempts.set(filename, attempts + 1);
        console.log(`🔄 Retrying ${filename} (attempt ${attempts + 1}/${this.maxRetries})`);
        await this._delay(1000 * Math.pow(2, attempts)); // Exponential backoff
        return this._loadCSVWithRetry(filename);
      }
      throw error;
    }
  }

  // Enhanced Firebase operations with pagination
  async getFirebaseData(collection, options = {}) {
    const {
      where = [],
      orderBy = null,
      limit = null,
      startAfter = null,
      useCache = true
    } = options;

    const cacheKey = `firebase_${collection}_${JSON.stringify(options)}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let query = window.db.collection(collection);
      
      // Apply where clauses
      where.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
      
      // Apply ordering
      if (orderBy) {
        const [field, direction = 'asc'] = Array.isArray(orderBy) ? orderBy : [orderBy];
        query = query.orderBy(field, direction);
      }
      
      // Apply pagination
      if (startAfter) {
        query = query.startAfter(startAfter);
      }
      
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const data = [];
      
      snapshot.forEach(doc => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      if (useCache) {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      console.error(`❌ Firebase error for ${collection}:`, error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchWrite(operations) {
    const batch = window.db.batch();
    
    operations.forEach(({ type, ref, data }) => {
      switch (type) {
        case 'set':
          batch.set(ref, data);
          break;
        case 'update':
          batch.update(ref, data);
          break;
        case 'delete':
          batch.delete(ref);
          break;
      }
    });

    return batch.commit();
  }

  // Real-time data subscriptions
  subscribeToCollection(collection, callback, options = {}) {
    let query = window.db.collection(collection);
    
    if (options.where) {
      options.where.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    if (options.orderBy) {
      const [field, direction = 'asc'] = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      query = query.orderBy(field, direction);
    }

    return query.onSnapshot(callback, (error) => {
      console.error('❌ Subscription error:', error);
    });
  }

  // Cache management
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  getCacheSize() {
    return this.cache.size;
  }

  // Utility methods
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Data validation
  validateStudentData(student) {
    const required = ['BCEID1', 'FirstName', 'LegalSurname1'];
    return required.every(field => student[field] && student[field].trim());
  }

  validateReferralData(referral) {
    const required = ['student', 'studentName', 'referralType', 'behaviorType'];
    return required.every(field => referral[field] && referral[field].toString().trim());
  }

  // Data transformation helpers
  transformStudentData(rawData) {
    return rawData
      .filter(this.validateStudentData)
      .map(student => ({
        ...student,
        fullName: `${student.FirstName} ${student.LegalSurname1}`,
        searchName: `${student.LegalSurname1}, ${student.FirstName}`.toLowerCase(),
        houseName: student.HouseName || 'Unassigned'
      }));
  }

  transformReferralData(rawData) {
    return rawData
      .filter(this.validateReferralData)
      .map(referral => ({
        ...referral,
        date: referral.timestamp && referral.timestamp.toDate ? referral.timestamp.toDate() : new Date(0),
        houseName: referral.houseName || 'Unknown'
      }));
  }
}

// Export for use in other modules
window.DataManager = DataManager;
