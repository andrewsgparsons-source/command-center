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

  // ─── Export ───
  window.FireSync = {
    init,
    onReady,
    db: () => db,

    // Generic
    getTasks,
    onTasks,
    addTask,
    updateTask,
    deleteTask,
    moveTask,

    // Attention items
    onAttentionItems,
    addAttentionItem,
    completeAttentionItem,
    dismissAttentionItem,

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
