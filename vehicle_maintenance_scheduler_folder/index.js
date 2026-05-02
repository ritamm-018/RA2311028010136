const axios = require('axios');
const { Log } = require('../logging_middleware');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://20.207.122.201/evaluation-service';
const AUTH_TOKEN = process.env.ACCESS_TOKEN;

/**
 * Normalizes task data from API
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Normalized tasks with TaskID, Duration, Impact
 */
function normalizeTasks(tasks) {
  return tasks.map((task) => ({
    TaskID: task.TaskID || task.taskID || task.id || null,
    Duration: Number(task.Duration || task.duration || 0),
    Impact: Number(task.Impact || task.impact || 0)
  })).filter((task) => task.TaskID && task.Duration > 0 && task.Impact >= 0);
}

/**
 * Fetches depots from the API
 * @returns {Promise<Array>} Array of depot objects
 */
async function fetchDepots() {
  await Log('backend', 'debug', 'repository', 'Fetching depots from API');

  try {
    const response = await axios.get(`${BASE_URL}/depots`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: 10000
    });

    await Log('backend', 'info', 'repository', `Successfully fetched ${response.data.depots?.length || 0} depots`);
    return response.data.depots || [];
  } catch (error) {
    await Log('backend', 'error', 'repository', `Failed to fetch depots: ${error.message}`);
    throw error;
  }
}

/**
 * Fetches vehicles from the API
 * @returns {Promise<Array>} Array of vehicle task objects
 */
async function fetchVehicles() {
  await Log('backend', 'debug', 'repository', 'Fetching vehicles from API');

  try {
    const response = await axios.get(`${BASE_URL}/vehicles`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: 10000
    });

    await Log('backend', 'info', 'repository', `Successfully fetched ${response.data.vehicles?.length || 0} vehicles`);
    return normalizeTasks(response.data.vehicles || []);
  } catch (error) {
    await Log('backend', 'error', 'repository', `Failed to fetch vehicles: ${error.message}`);
    throw error;
  }
}

/**
 * Solves the 0/1 knapsack problem for vehicle maintenance scheduling
 * @param {Array} vehicles - Array of {TaskID, Duration, Impact}
 * @param {number} budget - Maximum mechanic hours available
 * @returns {Object} Selected vehicles and totals
 */
function solveKnapsack(vehicles, budget) {
  const n = vehicles.length;
  const dp = Array.from({ length: n + 1 }, () => Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= budget; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  const selected = [];
  let w = budget;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  return {
    selected: selected.reverse(),
    totalImpact: dp[n][budget],
    totalDuration: selected.reduce((sum, task) => sum + task.Duration, 0),
    remainingHours: budget - selected.reduce((sum, task) => sum + task.Duration, 0)
  };
}

/**
 * Runs the maintenance scheduler for all depots
 */
async function runScheduler() {
  try {
    await Log('backend', 'info', 'cron_job', 'Starting vehicle maintenance scheduler');

    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    for (const depot of depots) {
      const depotId = depot.ID || depot.id;
      const budget = Number(depot.MechanicHours || depot.mechanicHours || 0);

      await Log('backend', 'debug', 'service', `Processing depot ${depotId} with budget ${budget}`);

      const schedule = solveKnapsack(vehicles, budget);
      const utilization = budget > 0 ? ((schedule.totalDuration / budget) * 100).toFixed(1) : 0;

      console.log(`========== DEPOT ID: ${depotId} ==========`);
      console.log(`Mechanic Hours Budget: ${budget} hours\n`);
      console.log('Selected Vehicles:');
      console.log('----------------------------------------');
      schedule.selected.forEach(vehicle => {
        console.log(`Task ID: ${vehicle.TaskID} | Duration: ${vehicle.Duration}h | Impact: ${vehicle.Impact}`);
      });
      console.log('----------------------------------------');
      console.log(`Total Duration: ${schedule.totalDuration} hours`);
      console.log(`Total Impact Score: ${schedule.totalImpact}`);
      console.log(`Utilization: ${utilization}%`);
      console.log('----------------------------------------\n');

      await Log('backend', 'info', 'service', `Depot ${depotId} optimized: selected ${schedule.selected.length} vehicles, total impact ${schedule.totalImpact}`);

      if (parseFloat(utilization) < 50) {
        await Log('backend', 'warn', 'service', `Depot ${depotId} utilization below 50%`);
      }
    }

    await Log('backend', 'info', 'cron_job', 'Vehicle maintenance scheduler completed');
  } catch (error) {
    await Log('backend', 'error', 'cron_job', `Vehicle maintenance scheduler failed: ${error.message}`);
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runScheduler();
}

module.exports = { runScheduler, solveKnapsack, normalizeTasks };
