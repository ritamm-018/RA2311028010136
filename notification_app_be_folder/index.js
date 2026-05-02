const express = require('express');
const { randomUUID } = require('crypto');
const { Log, requestLogger } = require('../logging_middleware');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(requestLogger);

const notificationStore = {};
const SAMPLE_NOTIFICATIONS = [
  {
    id: 'd146905a-dd8f-dd44-9609-3908a1a576bc',
    type: 'result',
    message: 'mid-sem',
    isRead: false,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'b2823218-ce5a-4b7c-9109-1f2f2e6d64b0',
    type: 'placement',
    message: 'CSX Corporation hiring',
    isRead: false,
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'b1520a8a-04ff-9554-f52f055588e8',
    type: 'event',
    message: 'farewell',
    isRead: true,
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
];

Object.keys(SAMPLE_NOTIFICATIONS).forEach((idx) => {
  const notif = SAMPLE_NOTIFICATIONS[idx];
  notificationStore[notif.id] = notif;
});

function requireJsonFields(body, requiredFields) {
  const missing = requiredFields.filter((field) => !(field in body));
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

app.post('/logs', async (req, res) => {
  try {
    const { stack, level, package: pkg, message } = req.body;
    await Log(stack, level, pkg, message);
    const logID = `dad4b226-1508-4211-8569-98f5d7c02c02`;
    res.status(200).json({ logID, message: 'log created successfully' });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.post('/notifications', async (req, res) => {
  try {
    requireJsonFields(req.body, ['userId', 'type', 'message']);

    const notificationId = randomUUID();
    const notification = {
      id: notificationId,
      userId: req.body.userId,
      type: req.body.type,
      message: req.body.message,
      isRead: false,
      timestamp: new Date().toISOString()
    };

    notificationStore[notificationId] = notification;
    await Log('backend', 'info', 'service', `Notification created: ${notificationId}`);
    res.status(201).json({ notification });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get('/notifications', async (req, res) => {
  try {
    const userId = req.query.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    let notifications = Object.values(notificationStore);
    if (userId) {
      notifications = notifications.filter((n) => n.userId === userId);
    }

    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = notifications.length;
    const start = (page - 1) * limit;
    const paginated = notifications.slice(start, start + limit);

    await Log('backend', 'info', 'service', `Retrieved ${paginated.length} notifications`);
    res.status(200).json({ notifications: paginated, total, page, limit });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /notifications/:id/read - Marks a notification as read
 */
app.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (!notificationStore[id]) {
      const error = new Error('Notification not found');
      error.status = 404;
      throw error;
    }

    notificationStore[id].isRead = true;
    await Log('backend', 'info', 'service', `Notification ${id} marked as read`);
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

/**
 * PUT /notifications/read-all - Marks all notifications as read for a user
 */
app.put('/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      const error = new Error('userId is required');
      error.status = 400;
      throw error;
    }

    let count = 0;
    Object.values(notificationStore).forEach(notification => {
      if (notification.userId === userId && !notification.isRead) {
        notification.isRead = true;
        count++;
      }
    });

    await Log('backend', 'info', 'service', `Marked ${count} notifications as read for user ${userId}`);
    res.status(200).json({ message: `${count} notifications marked as read` });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

/**
 * DELETE /notifications/:id - Deletes a notification
 */
app.delete('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!notificationStore[id]) {
      const error = new Error('Notification not found');
      error.status = 404;
      throw error;
    }

    delete notificationStore[id];
    await Log('backend', 'info', 'service', `Notification ${id} deleted`);
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

/**
 * GET /notifications/unread-count - Gets unread count for a user
 */
app.get('/notifications/unread-count', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      const error = new Error('userId query parameter is required');
      error.status = 400;
      throw error;
    }

    const unreadCount = Object.values(notificationStore).filter(
      n => n.userId === userId && !n.isRead
    ).length;

    await Log('backend', 'info', 'service', `Unread count for user ${userId}: ${unreadCount}`);
    res.status(200).json({ unreadCount });
  } catch (error) {
    await Log('backend', 'error', 'handler', error.message).catch(() => {});
    res.status(error.status || 400).json({ error: error.message });
  }
});

function computeMaintenanceSchedule(tasks, capacity) {
  const n = tasks.length;
  const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      if (Duration > w) {
        dp[i][w] = dp[i - 1][w];
      } else {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  const selected = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  return {
    selected: selected.reverse(),
    totalImpact: dp[n][capacity],
    totalDuration: selected.reduce((sum, task) => sum + task.Duration, 0),
    remainingHours: capacity - selected.reduce((sum, task) => sum + task.Duration, 0)
  };
}

app.post('/maintenance/schedule', async (req, res) => {
  try {
    requireJsonFields(req.body, ['vehicles', 'availableHours']);
    const tasks = req.body.vehicles;
    if (!Array.isArray(tasks)) {
      throw new Error('vehicles must be an array');
    }
    const availableHours = Number(req.body.availableHours);
    if (!Number.isInteger(availableHours) || availableHours < 0) {
      throw new Error('availableHours must be a non-negative integer');
    }

    const schedule = computeMaintenanceSchedule(tasks, availableHours);
    await Log('backend', 'info', 'service', 'Maintenance schedule computed');
    res.status(200).json({ schedule });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  Log('backend', 'error', 'middleware', err.message).catch(() => {});
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Notification backend listening on port ${PORT}`);
  Log('backend', 'info', 'service', `Backend service started on port ${PORT}`).catch(() => {});
});
