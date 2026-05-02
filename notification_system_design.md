# Notification System Design Document

## Stage 1: REST API Design

### Core Endpoints

#### GET /notifications
- **Method**: GET
- **Headers**: Authorization: Bearer {token}, Content-Type: application/json
- **Query Parameters**:
  - userId (string, required): Student ID to filter notifications
  - page (integer, optional, default: 1): Page number for pagination
  - limit (integer, optional, default: 20, max: 100): Items per page
- **Response Body**:
  ```json
  {
    "notifications": [
      {
        "id": "uuid",
        "userId": "1042",
        "type": "placement",
        "message": "CSX Corporation hiring",
        "isRead": false,
        "timestamp": "2026-05-02T10:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
  ```
- **Status Codes**: 200 (success), 400 (bad request), 401 (unauthorized)

#### POST /notifications
- **Method**: POST
- **Headers**: Authorization: Bearer {token}, Content-Type: application/json
- **Request Body**:
  ```json
  {
    "userId": "1042",
    "type": "placement",
    "message": "New placement opportunity"
  }
  ```
- **Response Body**:
  ```json
  {
    "notification": {
      "id": "uuid",
      "userId": "1042",
      "type": "placement",
      "message": "New placement opportunity",
      "isRead": false,
      "timestamp": "2026-05-02T10:00:00.000Z"
    }
  }
  ```
- **Status Codes**: 201 (created), 400 (bad request), 401 (unauthorized)

#### PUT /notifications/:id/read
- **Method**: PUT
- **Headers**: Authorization: Bearer {token}
- **URL Parameters**: id (string): Notification ID
- **Response Body**: `{"message": "Notification marked as read"}`
- **Status Codes**: 200 (success), 404 (not found), 401 (unauthorized)

#### PUT /notifications/read-all
- **Method**: PUT
- **Headers**: Authorization: Bearer {token}, Content-Type: application/json
- **Request Body**: `{"userId": "1042"}`
- **Response Body**: `{"message": "5 notifications marked as read"}`
- **Status Codes**: 200 (success), 400 (bad request), 401 (unauthorized)

#### DELETE /notifications/:id
- **Method**: DELETE
- **Headers**: Authorization: Bearer {token}
- **URL Parameters**: id (string): Notification ID
- **Response Body**: `{"message": "Notification deleted"}`
- **Status Codes**: 200 (success), 404 (not found), 401 (unauthorized)

#### GET /notifications/unread-count
- **Method**: GET
- **Headers**: Authorization: Bearer {token}
- **Query Parameters**: userId (string, required): Student ID
- **Response Body**: `{"unreadCount": 3}`
- **Status Codes**: 200 (success), 400 (bad request), 401 (unauthorized)

### Real-time Notification Mechanism
**Chosen Approach**: WebSockets with fallback to Server-Sent Events (SSE)

**Why WebSockets?**
- Bidirectional communication for instant delivery
- Lower latency than polling
- Connection stays open, reducing overhead
- Better for real-time features like typing indicators

**Fallback to SSE:**
- For browsers without WebSocket support
- Simpler server implementation
- Unidirectional but sufficient for notifications

**Tradeoffs:**
- WebSockets: Higher server resource usage, more complex
- SSE: Simpler, but unidirectional only
- Polling: Highest latency, most resource-intensive

## Stage 2: Database Selection & Schema

### Database Choice: MongoDB (NoSQL Document Store)

**Justification:**
- **Read/Write Patterns**: Notifications are write-heavy with variable schemas. MongoDB handles unstructured data well.
- **Scalability**: Horizontal scaling via sharding supports millions of notifications across distributed clusters.
- **Consistency**: Eventual consistency acceptable for notifications; strict ACID not required.
- **Use Case**: 50,000+ students generating notifications daily. Document model fits notification payloads perfectly.

**Why not SQL?**
- Fixed schema too rigid for evolving notification types
- JOINs unnecessary for notification queries
- Vertical scaling limits growth potential

### Schema Design

#### notifications Collection
```javascript
{
  _id: ObjectId,
  userId: String, // indexed
  type: String, // "placement", "result", "event"
  message: String,
  isRead: Boolean, // indexed
  timestamp: Date, // indexed
  priority: Number, // calculated field for sorting
  metadata: Object // flexible additional data
}
```

#### Indexes
- Compound index: `{userId: 1, isRead: 1, timestamp: -1}`
- Single indexes: `{timestamp: -1}`, `{type: 1}`

### Query Implementations

#### GET /notifications
```javascript
db.notifications.find(
  { userId: "1042" },
  { _id: 0 }
).sort({ timestamp: -1 }).skip(0).limit(20)
```

#### POST /notifications
```javascript
db.notifications.insertOne({
  userId: "1042",
  type: "placement",
  message: "New opportunity",
  isRead: false,
  timestamp: new Date(),
  priority: calculatePriority("placement")
})
```

#### PUT /notifications/:id/read
```javascript
db.notifications.updateOne(
  { _id: ObjectId(id) },
  { $set: { isRead: true } }
)
```

#### PUT /notifications/read-all
```javascript
db.notifications.updateMany(
  { userId: "1042", isRead: false },
  { $set: { isRead: true } }
)
```

#### DELETE /notifications/:id
```javascript
db.notifications.deleteOne({ _id: ObjectId(id) })
```

#### GET /notifications/unread-count
```javascript
db.notifications.countDocuments({
  userId: "1042",
  isRead: false
})
```

### Scalability Concerns & Solutions

**Problem 1: Hotspot on recent notifications**
- **Issue**: All queries sort by timestamp, causing index contention
- **Solution**: Implement time-based sharding with compound shard key `(userId, timestamp)`

**Problem 2: Growing unread indexes**
- **Issue**: Unread notifications accumulate, slowing queries
- **Solution**: Archive read notifications older than 30 days to separate collection

**Problem 3: Write amplification**
- **Issue**: Bulk read operations during peak times
- **Solution**: Read replicas for GET operations, write to primary only

## Stage 3: Query Optimization

### Original Query Analysis
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Why slow with 5M notifications:**
- No index on `(studentID, isRead, createdAt)` - full table scan required
- `SELECT *` fetches all columns, increasing I/O
- Sorting 5M rows without index is O(n log n)
- No LIMIT clause returns all matching rows

**Accuracy:** Query is semantically correct but inefficient.

### Optimized Query
```sql
SELECT id, type, message, timestamp
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC
LIMIT 50;
```

**Performance improvement:**
- Uses compound index: O(log n) lookup
- LIMIT reduces result set size
- Selective column projection reduces I/O
- New complexity: O(log n + k) where k = LIMIT

### Index Strategy
**Recommended indexes:**
- Primary: `(studentID, isRead, createdAt DESC)`
- Secondary: `(createdAt DESC)` for time-based queries
- Partial index on unread: `{studentID: 1, isRead: 1, createdAt: -1}` where `isRead = false`

**Why not "index every column":**
- Storage overhead (indexes can be 2-3x table size)
- Write performance degradation (every insert updates all indexes)
- Query optimizer confusion with too many index choices
- Maintenance complexity

### Additional Query: Placement Notifications in Last 7 Days
```sql
SELECT COUNT(*) as placement_count
FROM notifications
WHERE studentID = 1042
  AND type = 'placement'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## Stage 4: Performance Improvement

### Problem Analysis
Database overwhelmed because notifications fetch on EVERY page load creates excessive read load.

### Solution Strategies (Ranked by Effectiveness)

#### 1. Redis Caching (Most Effective)
**Implementation:**
- Cache unread notifications for each user with 5-minute TTL
- Cache pagination results with 1-minute TTL
- Invalidate cache on new notification creation

**Tradeoffs:**
- Reduces DB load by 80-90%
- Sub-millisecond response times
- Cache invalidation complexity
- Additional infrastructure cost

#### 2. Pagination with Infinite Scroll
**Implementation:**
- Return 20 notifications per page
- Client loads more on scroll
- Server provides cursor-based pagination

**Tradeoffs:**
- Reduces initial payload size
- Better user experience
- More complex client-side logic
- Potential for duplicate loads

#### 3. Read Replicas
**Implementation:**
- Route all SELECT queries to read replicas
- Write operations go to primary
- Use connection pooling

**Tradeoffs:**
- Distributes read load
- Improves query performance
- Replication lag (eventual consistency)
- Higher infrastructure cost

#### 4. Lazy Loading
**Implementation:**
- Load notification summaries first
- Fetch full content on demand
- Use virtual scrolling

**Tradeoffs:**
- Faster initial page loads
- Reduced bandwidth
- Multiple round trips
- Complex state management

#### 5. Queue-Based Processing
**Implementation:**
- Queue notification creation jobs
- Batch DB writes
- Use background workers

**Tradeoffs:**
- Smooths write load spikes
- Better resource utilization
- Increased latency for new notifications
- Additional queue infrastructure

**Ranking for this use case:** 1. Caching, 2. Read replicas, 3. Pagination, 4. Lazy loading, 5. Queuing

## Stage 5: Batch Notification Reliability

### Original Pseudocode Problems
```javascript
function notify_all(student_ids, message):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

**Issues:**
1. **Failure cascade**: If email fails for student 200, loop stops, remaining students not processed
2. **Partial failures**: DB saved but email failed - inconsistent state
3. **No retries**: Single failure blocks entire batch
4. **Sequential processing**: Slow for large batches
5. **No idempotency**: Retries could duplicate notifications

**DB save before email?**
- **Arguments for DB first**: Ensures notification recorded even if email fails
- **Arguments against**: Creates notifications for failed deliveries, requires cleanup
- **Better approach**: Save to DB, then queue email job separately

### Redesigned Solution

#### Message Queue Architecture
- **RabbitMQ/SQS** for reliable job queuing
- **Dead letter queue** for failed jobs
- **Retry with exponential backoff** (3 retries, 1s, 4s, 16s delays)
- **Idempotency keys** to prevent duplicates

#### Revised Pseudocode
```javascript
async function notify_all(student_ids, message):
    // Step 1: Bulk save to database
    const notifications = student_ids.map(id => ({
        studentId: id,
        message: message,
        status: 'pending',
        idempotencyKey: generateKey()
    }))

    await bulkInsertNotifications(notifications)

    // Step 2: Queue email jobs
    for notification in notifications:
        await queueService.publish('email-queue', {
            notificationId: notification.id,
            email: getStudentEmail(notification.studentId),
            message: message,
            retryCount: 0
        })

    // Step 3: Send push notifications in parallel
    await Promise.allSettled(
        student_ids.map(id => sendPushNotification(id, message))
    )

// Email worker (separate process)
async function processEmailJob(job):
    try:
        await sendEmail(job.email, job.message)
        await updateNotificationStatus(job.notificationId, 'sent')
    except error:
        if job.retryCount < 3:
            await queueService.publishDelayed(
                'email-queue',
                { ...job, retryCount: job.retryCount + 1 },
                calculateDelay(job.retryCount)
            )
        else:
            await queueService.publish('dead-letter-queue', job)
            await updateNotificationStatus(job.notificationId, 'failed')
```

**Benefits:**
- **Reliability**: Failed emails don't stop batch processing
- **Consistency**: DB state maintained regardless of email status
- **Performance**: Parallel push notifications, queued email processing
- **Observability**: Dead letter queue for failed jobs analysis

## Stage 6: Priority Inbox Implementation

### Priority Algorithm
```javascript
function calculatePriority(notification) {
    const typeWeights = {
        'placement': 3,
        'result': 2,
        'event': 1
    };

    const weight = typeWeights[notification.type.toLowerCase()] || 1;
    const daysSince = (Date.now() - new Date(notification.timestamp)) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (daysSince / 30)); // 30-day decay

    return weight * recencyScore;
}
```

### Implementation (Actual Code)
```javascript
// priorityQueue.js
const axios = require('axios');
const { Log } = require('../logging_middleware');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://20.207.122.201/evaluation-service';
const AUTH_TOKEN = process.env.ACCESS_TOKEN;

function calculatePriority(notification) {
  const typeWeights = { 'placement': 3, 'result': 2, 'event': 1 };
  const weight = typeWeights[notification.type.toLowerCase()] || 1;
  const daysSince = (Date.now() - new Date(notification.timestamp)) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - (daysSince / 30));
  return weight * recencyScore;
}

async function fetchNotifications() {
  await Log('backend', 'debug', 'repository', 'Fetching notifications from API');
  try {
    const response = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: 10000
    });
    await Log('backend', 'info', 'repository', `Fetched ${response.data.notifications?.length || 0} notifications`);
    return response.data.notifications || [];
  } catch (error) {
    await Log('backend', 'error', 'repository', `Failed to fetch notifications: ${error.message}`);
    throw error;
  }
}

async function getTopPriorityNotifications(n = 10) {
  try {
    const notifications = await fetchNotifications();
    const prioritized = notifications.map(notification => ({
      ...notification,
      priority: calculatePriority(notification)
    }));
    prioritized.sort((a, b) => b.priority - a.priority);
    const topN = prioritized.slice(0, n);
    await Log('backend', 'info', 'service', `Retrieved top ${topN.length} priority notifications`);
    return topN;
  } catch (error) {
    await Log('backend', 'error', 'service', `Failed to get priority notifications: ${error.message}`);
    throw error;
  }
}

async function printTopPriorityNotifications(n = 10) {
  try {
    const topNotifications = await getTopPriorityNotifications(n);
    console.log(`========== TOP ${n} PRIORITY NOTIFICATIONS ==========`);
    console.log('Rank | Priority Score | Type      | Timestamp           | Message');
    console.log('-----|----------------|-----------|---------------------|--------');
    topNotifications.forEach((notification, index) => {
      const rank = (index + 1).toString().padStart(4);
      const score = notification.priority.toFixed(2).padStart(14);
      const type = notification.type.padEnd(9);
      const timestamp = new Date(notification.timestamp).toISOString().slice(0, 19).replace('T', ' ');
      const message = notification.message || '';
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

module.exports = { getTopPriorityNotifications, printTopPriorityNotifications, calculatePriority, fetchNotifications };
```

### Efficient Updates for Top 10
**Current limitation:** Full re-sort on every new notification (O(n log n))

**Optimized approach:**
1. **Min-heap of size 10**: Maintains top 10 priorities efficiently
2. **Insertion complexity**: O(log k) where k=10, vs O(n log n) for full sort
3. **Data structure**: Use a min-heap to track lowest priority in top 10
4. **New notification**: Calculate priority, compare with heap minimum
   - If higher, replace minimum and re-heapify
   - If lower, discard

**Benefits:**
- Constant space (O(k) vs O(n))
- Fast insertions (O(log k) vs O(n log n))
- Perfect for real-time priority inbox updates

### Sample Output
```
========== TOP 10 PRIORITY NOTIFICATIONS ==========
Rank | Priority Score | Type      | Timestamp           | Message
1    | 2.95           | placement | 2026-04-22 17:51:18 | CSX Corporation hiring.
2    | 2.87           | placement | 2026-04-22 11:30:00 | AMD hiring.
3    | 1.92           | result    | 2026-04-22 17:56:42 | mid-sem results
...
==================================================
```