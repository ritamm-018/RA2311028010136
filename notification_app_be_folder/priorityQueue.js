const axios = require('axios');
require('dotenv').config({ path: '../.env' });
const { Log } = require('../logging_middleware');

const BASE_URL = process.env.BASE_URL || 'http://20.207.122.201/evaluation-service';
const AUTH_TOKEN = process.env.ACCESS_TOKEN;

/**
 * Calculates priority score for a notification
 * @param {Object} notification - Notification object with type, timestamp
 * @returns {number} Priority score
 */
function calculatePriority(notification) {
  const typeWeight = {
    'placement': 3,
    'result': 2,
    'event': 1
  }[(notification.Type || notification.type || '').toLowerCase()] || 1;

  const daysSince = (Date.now() - new Date(notification.Timestamp || notification.timestamp)) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - (daysSince / 30)); // Decay over 30 days

  return typeWeight * recencyScore;
}

/**
 * Fetches notifications from the API
 * @returns {Promise<Array>} Array of notification objects
 */
async function fetchNotifications() {
  await Log('backend', 'debug', 'repository', 'Fetching notifications from API');

  try {
    const response = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: 10000
    });

    await Log('backend', 'info', 'repository', `Successfully fetched ${response.data.notifications?.length || 0} notifications`);
    return response.data.notifications || [];
  } catch (error) {
    await Log('backend', 'error', 'repository', `Failed to fetch notifications: ${error.message}`);
    throw error;
  }
}

/**
 * Gets top N priority notifications
 * @param {number} n - Number of top notifications to return (default 10)
 * @returns {Promise<Array>} Top N notifications sorted by priority
 */
async function getTopPriorityNotifications(n = 10) {
  try {
    const notifications = await fetchNotifications();

    // Calculate priorities
    const prioritized = notifications.map(notification => ({
      ...notification,
      priority: calculatePriority(notification)
    }));

    // Sort by priority descending
    prioritized.sort((a, b) => b.priority - a.priority);

    // Return top N
    const topN = prioritized.slice(0, n);

    await Log('backend', 'info', 'service', `Retrieved top ${topN.length} priority notifications`);

    return topN;
  } catch (error) {
    await Log('backend', 'error', 'service', `Failed to get priority notifications: ${error.message}`);
    throw error;
  }
}

/**
 * Prints top priority notifications in formatted output
 * @param {number} n - Number of notifications to display
 */
async function printTopPriorityNotifications(n = 10) {
  try {
    const topNotifications = await getTopPriorityNotifications(n);

    console.log(`========== TOP ${n} PRIORITY NOTIFICATIONS ==========`);
    console.log('Rank | Priority Score | Type      | Timestamp           | Message');
    console.log('-----|----------------|-----------|---------------------|--------');

    topNotifications.forEach((notification, index) => {
      const rank = (index + 1).toString().padStart(4);
      const score = notification.priority.toFixed(2).padStart(14);
      const type = (notification.Type || notification.type || '').padEnd(9);
      const timestamp = new Date(notification.Timestamp || notification.timestamp).toISOString().slice(0, 19).replace('T', ' ');
      const message = notification.Message || notification.message || '';

      console.log(`${rank} | ${score} | ${type} | ${timestamp} | ${message}`);
    });

    console.log('==================================================');
  } catch (error) {
    console.error('Error printing priority notifications:', error.message);
  }
}

if (require.main === module) {
  const n = process.argv[2] ? parseInt(process.argv[2]) : 10;
  printTopPriorityNotifications(n);
}

module.exports = {
  getTopPriorityNotifications,
  printTopPriorityNotifications,
  calculatePriority,
  fetchNotifications
};