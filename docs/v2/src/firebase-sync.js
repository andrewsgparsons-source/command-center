// Firebase Realtime Database Sync Module
// Shared across all dashboards — real-time cross-device sync

(function(window) {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDWRe9KV1ZDtUnGt8-EzQzrgxeNKLmXBn8",
    authDomain: "dashboards-5c2fb.firebaseapp.com",
    databaseURL: "https://dashboards-5c2fb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dashboards-5c2fb",
    storageBucket: "dashboards-5c2fb.firebasestorage.app",
    messagingSenderId: "858589888633",
    appId: "1:858589888633:web:ab02389e42e6c4347454a8"
  };

  // ─── Firebase SDK (compat mode via CDN) ───
  let db = null;
  let ready = false;
  const readyCallbacks = [];

  // Load Firebase SDK from CDN
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    try {
      await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js');

      const app = firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      ready = true;

      console.log('[FireSync] Connected to Firebase');
      readyCallbacks.forEach(cb => cb(db));
      readyCallbacks.length = 0;
    } catch(err) {
      console.error('[FireSync] Failed to init Firebase:', err);
    }
  }

  function onReady(cb) {
    if (ready) cb(db);
    else readyCallbacks.push(cb);
  }

  // ─── Task CRUD ───

  // Get all tasks (one-time)
  function getTasks(path, callback) {
    onReady(() => {
      db.ref(path).once('value', snap => {
        callback(snap.val() || {});
      });
    });
  }

  // Listen for real-time changes
  function onTasks(path, callback) {
    onReady(() => {
      db.ref(path).on('value', snap => {
        callback(snap.val() || {});
      });
    });
  }

  // Add a task
  function addTask(path, task) {
    onReady(() => {
      const ref = db.ref(path).push();
      task.id = ref.key;
      task.createdAt = task.createdAt || new Date().toISOString();
      ref.set(task);
      return ref.key;
    });
  }

  // Update a task
  function updateTask(path, taskId, updates) {
    onReady(() => {
      updates.updatedAt = new Date().toISOString();
      db.ref(path + '/' + taskId).update(updates);
    });
  }

  // Delete a task
  function deleteTask(path, taskId) {
    onReady(() => {
      db.ref(path + '/' + taskId).remove();
    });
  }

  // Move task to a new status
  function moveTask(path, taskId, newStatus) {
    const updates = { status: newStatus };
    if (newStatus === 'done') {
      updates.completedAt = new Date().toISOString();
    }
    updateTask(path, taskId, updates);
  }

  // ─── Convenience: Attention Items ───
  // These are the "Needs Your Attention" items in the Solution Planner

  const TASKS_PATH = 'tasks';
  const ATTENTION_PATH = 'attention';

  function onAttentionItems(callback) {
    onTasks(ATTENTION_PATH, callback);
  }

  function addAttentionItem(item) {
    // item: { title, detail, biz, priority, status }
    item.status = item.status || 'active';
    addTask(ATTENTION_PATH, item);
  }

  function completeAttentionItem(id) {
    moveTask(ATTENTION_PATH, id, 'done');
  }

  function dismissAttentionItem(id) {
    moveTask(ATTENTION_PATH, id, 'dismissed');
  }

  // ─── General task paths per business ───
  function onBusinessTasks(bizKey, callback) {
    onTasks('business/' + bizKey + '/tasks', callback);
  }

  function addBusinessTask(bizKey, task) {
    task.status = task.status || 'backlog';
    addTask('business/' + bizKey + '/tasks', task);
  }

  function moveBusinessTask(bizKey, taskId, newStatus) {
    moveTask('business/' + bizKey + '/tasks', taskId, newStatus);
  }

  // ─── User Identity ───
  const USER_KEY = 'firesync-user';
  const KNOWN_USERS = ['Andrew', 'Nicki', 'Hilary', 'James'];

  function getUser() {
    return localStorage.getItem(USER_KEY) || null;
  }

  function setUser(name) {
    localStorage.setItem(USER_KEY, name);
  }

  function ensureUser() {
    if (getUser()) return Promise.resolve(getUser());

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:white;border-radius:16px;padding:28px;max-width:360px;width:100%;text-align:center;font-family:Inter,sans-serif;">
          <div style="font-size:28px;margin-bottom:8px;">👋</div>
          <h2 style="font-family:Playfair Display,serif;margin:0 0 8px;font-size:1.3rem;">Who are you?</h2>
          <p style="color:#57534E;font-size:14px;margin:0 0 20px;">This helps everyone know who made changes.</p>
          <div id="userButtons" style="display:flex;flex-direction:column;gap:8px;">
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const btnContainer = overlay.querySelector('#userButtons');
      KNOWN_USERS.forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.style.cssText = 'padding:12px;border-radius:10px;border:1.5px solid #E7E0D8;background:#F5F0EB;font-size:15px;font-family:Inter,sans-serif;cursor:pointer;transition:all 0.15s';
        btn.addEventListener('mouseover', () => { btn.style.background = '#B45309'; btn.style.color = 'white'; btn.style.borderColor = '#B45309'; });
        btn.addEventListener('mouseout', () => { btn.style.background = '#F5F0EB'; btn.style.color = '#1C1917'; btn.style.borderColor = '#E7E0D8'; });
        btn.addEventListener('click', () => {
          setUser(name);
          overlay.remove();
          resolve(name);
        });
        btnContainer.appendChild(btn);
      });
    });
  }

  // ─── Activity Feed ───
  const ACTIVITY_PATH = 'activity';

  function logActivity(action, details) {
    onReady(() => {
      const entry = {
        user: getUser() || 'Unknown',
        action: action,
        details: details || {},
        timestamp: new Date().toISOString(),
        dashboard: document.title || 'Unknown'
      };
      db.ref(ACTIVITY_PATH).push(entry);
    });
  }

  // Listen for recent activity
  function onActivity(callback, limit) {
    onReady(() => {
      db.ref(ACTIVITY_PATH).orderByChild('timestamp').limitToLast(limit || 50).on('value', snap => {
        callback(snap.val() || {});
      });
    });
  }

  // ─── Wrap CRUD with activity logging ───
  const _origAddTask = addTask;
  const _origUpdateTask = updateTask;
  const _origDeleteTask = deleteTask;
  const _origMoveTask = moveTask;

  function addTaskLogged(path, task) {
    task.createdBy = getUser() || 'Unknown';
    _origAddTask(path, task);
    logActivity('added', { path: path, title: task.title || task.text || '' });
  }

  function updateTaskLogged(path, taskId, updates) {
    _origUpdateTask(path, taskId, updates);
    logActivity('updated', { path: path, taskId: taskId, fields: Object.keys(updates) });
  }

  function deleteTaskLogged(path, taskId) {
    _origDeleteTask(path, taskId);
    logActivity('deleted', { path: path, taskId: taskId });
  }

  function moveTaskLogged(path, taskId, newStatus) {
    _origMoveTask(path, taskId, newStatus);
    logActivity('moved', { path: path, taskId: taskId, newStatus: newStatus });
  }

  // Override attention helpers to use logged versions
  function addAttentionItemLogged(item) {
    item.status = item.status || 'active';
    item.createdBy = getUser() || 'Unknown';
    addTaskLogged(ATTENTION_PATH, item);
  }

  function completeAttentionItemLogged(id) {
    moveTaskLogged(ATTENTION_PATH, id, 'done');
    logActivity('completed', { itemId: id });
  }

  function dismissAttentionItemLogged(id) {
    moveTaskLogged(ATTENTION_PATH, id, 'dismissed');
    logActivity('dismissed', { itemId: id });
  }

  // ─── Export ───
  window.FireSync = {
    init,
    onReady,
    db: () => db,

    // User
    getUser,
    setUser,
    ensureUser,
    KNOWN_USERS,

    // Generic (with logging)
    getTasks,
    onTasks,
    addTask: addTaskLogged,
    updateTask: updateTaskLogged,
    deleteTask: deleteTaskLogged,
    moveTask: moveTaskLogged,

    // Raw (no logging) — for internal use
    _addTask: _origAddTask,
    _updateTask: _origUpdateTask,
    _deleteTask: _origDeleteTask,
    _moveTask: _origMoveTask,

    // Attention items (with logging)
    onAttentionItems,
    addAttentionItem: addAttentionItemLogged,
    completeAttentionItem: completeAttentionItemLogged,
    dismissAttentionItem: dismissAttentionItemLogged,

    // Activity feed
    logActivity,
    onActivity,
    ACTIVITY_PATH,

    // Business tasks
    onBusinessTasks,
    addBusinessTask,
    moveBusinessTask,

    // Constants
    TASKS_PATH,
    ATTENTION_PATH,
  };

  // Auto-init
  init();

})(window);
