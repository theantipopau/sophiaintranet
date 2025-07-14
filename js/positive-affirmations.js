'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const affirmationContainer = document.getElementById('positive-affirmation-container');

  if (affirmationContainer) {
    fetchAndDisplayAffirmation();
  }

  async function fetchAndDisplayAffirmation() {
    try {
      const affirmations = await getWeeklyAffirmations();
      if (affirmations.length > 0) {
        affirmations.forEach(displayAffirmation);
      } else {
        affirmationContainer.innerHTML = '<p>No positive affirmations found for this week.</p>';
      }
    } catch (error) {
      console.error('Error fetching affirmations:', error);
      affirmationContainer.innerHTML = '<p>Could not load affirmations.</p>';
    }
  }

  async function getWeeklyAffirmations() {
    const db = firebase.firestore();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const snapshot = await db.collection('affirmations').where('timestamp', '>=', weekAgo.toISOString()).get();
    return snapshot.docs.map(doc => doc.data());
  }

  function displayAffirmation(affirmation) {
    const affirmationElement = document.createElement('div');
    affirmationElement.className = 'affirmation';
    affirmationElement.innerHTML = `
      <p class="affirmation-text">"${affirmation.affirmation}"</p>
      <p class="affirmation-author">- ${affirmation.studentName}</p>
    `;
    affirmationContainer.appendChild(affirmationElement);
  }
});
