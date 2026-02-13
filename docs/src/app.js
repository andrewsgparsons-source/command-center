/* ============================================================
   Solution Planner — app.js
   
   Architecture:
   - VIEWER: Fetches & displays data from project dashboards
   - INCUBATOR: Hosts embryonic ideas locally until they graduate
   
   Data lives with the project. The planner is a lens, not a notebook.
   ============================================================ */

(function () {
  "use strict";

  // ── State ──
  var config = null;
  var dashboardData = {};
  var jamesData = null;
  var incubatorData = null;
  var currentView = localStorage.getItem("cc-view") || "today";

  // ── Incubator persistence (localStorage + JSON file fallback) ──
  var INCUBATOR_KEY = "solution-planner-incubator";

  function loadIncubator() {
    // Try localStorage first (has latest edits)
    var stored = localStorage.getItem(INCUBATOR_KEY);
    if (stored) {
      try {
        incubatorData = JSON.parse(stored);
        return Promise.resolve();
      } catch (e) { /* fall through */ }
    }
    // Fall back to JSON file
    return fetch("data/incubator.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        incubatorData = data;
        saveIncubator();
      })
      .catch(function () {
        incubatorData = { version: 1, ideas: [] };
        saveIncubator();
      });
  }

  function saveIncubator() {
    incubatorData.lastUpdated = new Date().toISOString();
    localStorage.setItem(INCUBATOR_KEY, JSON.stringify(incubatorData));
  }

  function nextIncubatorId() {
    var max = 0;
    incubatorData.ideas.forEach(function (idea) {
      var n = parseInt(idea.id, 10);
      if (n > max) max = n;
    });
    return String(max + 1);
  }

  // ── Load all data ──
  function init() {
    Promise.all([
      fetch("data/config.json").then(function (r) { return r.json(); }),
      fetch("data/james.json").then(function (r) { return r.json(); }),
      loadIncubator()
    ]).then(function (results) {
      config = results[0];
      jamesData = results[1];
      return loadDashboards();
    }).then(function () {
      buildSidebar();
      switchView(currentView);
      updateFooter();
    }).catch(function (err) {
      console.error("Init failed:", err);
      document.getElementById("mainContent").innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load data: ' + err.message + '</p></div>';
    });
  }

  function loadDashboards() {
    var fetches = config.dashboards.map(function (dash) {
      if (!dash.dataUrl) {
        dashboardData[dash.id] = { cards: [] };
        if (dash.buildUrl) {
          return fetch(dash.buildUrl)
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (txt) { dashboardData[dash.id].build = txt.trim(); })
            .catch(function () {});
        }
        return Promise.resolve();
      }
      return fetch(dash.dataUrl)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          dashboardData[dash.id] = data;
        })
        .catch(function (err) {
          console.warn("Could not load " + dash.id + ":", err.message);
          dashboardData[dash.id] = { cards: [] };
        });
    });
    return Promise.all(fetches);
  }

  // ── Sidebar ──
  function buildSidebar() {
    var nav = document.getElementById("sidebarNav");
    var html = "";

    config.sections.forEach(function (s) {
      var badge = "";
      if (s.id === "today") {
        var urgentCount = getUrgentCount();
        if (urgentCount > 0) badge = '<span class="nav-badge urgent">' + urgentCount + "</span>";
      } else if (s.id === "incubator") {
        var incCount = incubatorData ? incubatorData.ideas.length : 0;
        if (incCount > 0) badge = '<span class="nav-badge incubator">' + incCount + "</span>";
      }
      html += '<div class="nav-item' + (s.id === currentView ? " active" : "") + '" data-view="' + s.id + '">' +
        '<span class="nav-icon">' + s.icon + "</span>" +
        '<span class="nav-label">' + s.label + "</span>" +
        badge +
        "</div>";
    });

    html += '<div class="nav-separator"></div>';
    html += '<div class="nav-group-label">Dashboards</div>';

    config.dashboards.forEach(function (dash) {
      var cards = (dashboardData[dash.id] || {}).cards || [];
      var count = cards.length;
      html += '<div class="nav-item" data-view="dash-' + dash.id + '">' +
        '<span class="nav-icon">' + dash.emoji + "</span>" +
        '<span class="nav-label">' + dash.name + "</span>" +
        '<span class="nav-badge">' + count + "</span>" +
        "</div>";
    });

    nav.innerHTML = html;

    nav.querySelectorAll(".nav-item").forEach(function (el) {
      el.addEventListener("click", function () {
        switchView(el.getAttribute("data-view"));
        closeMobileSidebar();
      });
    });

    document.getElementById("menuBtn").addEventListener("click", toggleMobileSidebar);
  }

  function switchView(viewName) {
    currentView = viewName;
    localStorage.setItem("cc-view", viewName);

    document.querySelectorAll(".nav-item").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-view") === viewName);
    });

    var main = document.getElementById("mainContent");

    if (viewName === "today") renderToday(main);
    else if (viewName === "businesses") renderBusinesses(main);
    else if (viewName === "incubator") renderIncubator(main);
    else if (viewName === "james") renderJames(main);
    else if (viewName === "personal") renderPersonal(main);
    else if (viewName === "ideas") renderIdeas(main);
    else if (viewName.indexOf("dash-") === 0) renderDashDetail(main, viewName.replace("dash-", ""));
    else renderToday(main);

    main.scrollTop = 0;
  }

  // ── Mobile sidebar ──
  function toggleMobileSidebar() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", closeMobileSidebar);
    }
    sidebar.classList.toggle("open");
    overlay.classList.toggle("visible");
  }

  function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    var overlay = document.querySelector(".sidebar-overlay");
    if (overlay) overlay.classList.remove("visible");
  }

  // ── Helper: get all cards across dashboards ──
  function getAllCards() {
    var all = [];
    Object.keys(dashboardData).forEach(function (key) {
      var dash = config.dashboards.find(function (d) { return d.id === key; });
      var cards = (dashboardData[key] || {}).cards || [];
      cards.forEach(function (c) {
        all.push(Object.assign({}, c, { _source: key, _sourceEmoji: dash ? dash.emoji : "📋", _sourceName: dash ? dash.name : key }));
      });
    });
    // Also include incubator ideas with "in-progress" or "backlog" mapping
    if (incubatorData && incubatorData.ideas) {
      incubatorData.ideas.forEach(function (idea) {
        all.push(Object.assign({}, {
          id: "inc-" + idea.id,
          title: idea.title,
          description: idea.description,
          status: idea.stage === "concept" ? "backlog" : (idea.stage === "developing" ? "in-progress" : "backlog"),
          priority: idea.priority || "medium",
          category: "incubator",
          createdAt: idea.createdAt,
          _source: "incubator",
          _sourceEmoji: "🧪",
          _sourceName: "Incubator"
        }));
      });
    }
    return all;
  }

  function getUrgentCount() {
    return getAllCards().filter(function (c) {
      return c.status === "in-progress" || (c.priority === "high" && c.status === "backlog");
    }).length;
  }

  function updateFooter() {
    var total = getAllCards().length;
    var dashCount = Object.keys(dashboardData).length;
    var incCount = incubatorData ? incubatorData.ideas.length : 0;
    var suffix = incCount > 0 ? " · " + incCount + " incubating" : "";
    document.getElementById("sidebarStatus").textContent = total + " items across " + dashCount + " dashboards" + suffix;
  }

  // ── VIEW: Today ──
  function renderToday(container) {
    var all = getAllCards();
    var inProgress = all.filter(function (c) { return c.status === "in-progress"; });
    var highBacklog = all.filter(function (c) { return c.priority === "high" && c.status === "backlog"; });
    var recentDone = all.filter(function (c) { return c.status === "done" && c.completedAt; })
      .sort(function (a, b) { return b.completedAt.localeCompare(a.completedAt); })
      .slice(0, 5);

    var totalCards = all.length;
    var doneCards = all.filter(function (c) { return c.status === "done"; }).length;
    var pct = totalCards ? Math.round((doneCards / totalCards) * 100) : 0;
    var incCount = incubatorData ? incubatorData.ideas.length : 0;

    var html = '<div class="view-header">' +
      '<h1 class="view-title">🎯 Today</h1>' +
      '<p class="view-subtitle">What matters right now — across everything</p>' +
      '</div>';

    html += '<div class="kpi-grid">';
    html += kpi("🔨", inProgress.length, "In Progress", "blue");
    html += kpi("🔴", highBacklog.length, "High Priority", "red");
    html += kpi("✅", doneCards, "Completed", "green");
    html += kpi("🧪", incCount, "Incubating", "purple");
    html += '</div>';

    if (inProgress.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">🔨 In Progress</span></div>';
      html += '<div class="panel-body no-pad">';
      inProgress.forEach(function (c) { html += taskItem(c); });
      html += '</div></div>';
    }

    if (highBacklog.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">🔴 High Priority Backlog</span><span class="panel-action">' + highBacklog.length + ' items</span></div>';
      html += '<div class="panel-body no-pad">';
      highBacklog.slice(0, 10).forEach(function (c) { html += taskItem(c); });
      if (highBacklog.length > 10) html += '<div class="task-item"><div class="task-info"><span class="task-meta">+ ' + (highBacklog.length - 10) + ' more...</span></div></div>';
      html += '</div></div>';
    }

    // Incubator preview on Today view
    if (incCount > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">🧪 Incubating Ideas</span><span class="panel-action" id="goToIncubator">' + incCount + ' ideas →</span></div>';
      html += '<div class="panel-body no-pad">';
      incubatorData.ideas.slice(0, 3).forEach(function (idea) {
        html += incubatorItem(idea);
      });
      if (incCount > 3) html += '<div class="task-item"><div class="task-info"><span class="task-meta">+ ' + (incCount - 3) + ' more in incubator...</span></div></div>';
      html += '</div></div>';
    }

    if (recentDone.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">✅ Recently Completed</span></div>';
      html += '<div class="panel-body no-pad">';
      recentDone.forEach(function (c) { html += taskItem(c); });
      html += '</div></div>';
    }

    container.innerHTML = html;

    // Wire up incubator link
    var goBtn = document.getElementById("goToIncubator");
    if (goBtn) goBtn.addEventListener("click", function () { switchView("incubator"); });
  }

  // ── VIEW: Businesses ──
  function renderBusinesses(container) {
    var html = '<div class="view-header">' +
      '<h1 class="view-title">📊 Businesses</h1>' +
      '<p class="view-subtitle">All ventures and projects at a glance</p>' +
      '</div>';

    html += '<div class="dashboard-grid">';

    config.dashboards.forEach(function (dash) {
      var data = dashboardData[dash.id] || { cards: [] };
      var cards = data.cards || [];
      var isTool = dash.category === "tool";

      html += '<div class="dash-card" data-dash="' + dash.id + '">';
      html += '<div class="dash-card-header">';
      html += '<div class="dash-card-icon">' + dash.emoji + '</div>';
      html += '<div><div class="dash-card-name">' + esc(dash.name) + '</div>';
      html += '<div class="dash-card-desc">' + esc(dash.description) + '</div></div>';
      html += '</div>';

      if (isTool) {
        var build = data.build || "—";
        html += '<div class="dash-card-stats">';
        html += '<div class="dash-stat"><div class="dash-stat-value" style="font-size:14px;font-family:monospace">' + esc(build) + '</div><div class="dash-stat-label">Build</div></div>';
        html += '<div class="dash-stat"><div class="dash-stat-value" style="color:var(--cc-green)">●</div><div class="dash-stat-label">Live</div></div>';
        html += '</div>';
        html += '<div class="dash-card-link">Open configurator →</div>';
      } else {
        var inProgress = cards.filter(function (c) { return c.status === "in-progress"; }).length;
        var done = cards.filter(function (c) { return c.status === "done"; }).length;
        var backlog = cards.filter(function (c) { return c.status === "backlog"; }).length;
        html += '<div class="dash-card-stats">';
        html += '<div class="dash-stat"><div class="dash-stat-value">' + inProgress + '</div><div class="dash-stat-label">Active</div></div>';
        html += '<div class="dash-stat"><div class="dash-stat-value">' + backlog + '</div><div class="dash-stat-label">Backlog</div></div>';
        html += '<div class="dash-stat"><div class="dash-stat-value">' + done + '</div><div class="dash-stat-label">Done</div></div>';
        html += '<div class="dash-stat"><div class="dash-stat-value">' + cards.length + '</div><div class="dash-stat-label">Total</div></div>';
        html += '</div>';
        html += '<div class="dash-card-link">Open dashboard →</div>';
      }
      html += '</div>';
    });

    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll(".dash-card").forEach(function (el) {
      el.addEventListener("click", function () {
        var dashId = el.getAttribute("data-dash");
        var dash = config.dashboards.find(function (d) { return d.id === dashId; });
        if (dash && dash.boardUrl) {
          window.open(dash.boardUrl, "_blank");
        }
      });
    });
  }

  // ── VIEW: Incubator ──
  function renderIncubator(container) {
    var ideas = incubatorData ? incubatorData.ideas : [];

    // Group by stage
    var stages = {
      concept: { label: "💭 Concept", desc: "Just an idea — barely a sentence", items: [] },
      developing: { label: "🔬 Developing", desc: "Fleshing it out — notes, research, early thinking", items: [] },
      ready: { label: "🚀 Ready to Graduate", desc: "Mature enough for its own project dashboard", items: [] }
    };

    ideas.forEach(function (idea) {
      var stage = idea.stage || "concept";
      if (stages[stage]) stages[stage].items.push(idea);
    });

    var html = '<div class="view-header">' +
      '<h1 class="view-title">🧪 Incubator</h1>' +
      '<p class="view-subtitle">Embryonic ideas that don\'t have their own dashboard yet. When they\'re ready, they graduate.</p>' +
      '</div>';

    // Add new idea button
    html += '<div class="incubator-actions">';
    html += '<button class="inc-btn inc-btn-primary" id="addIdeaBtn">+ New Idea</button>';
    html += '<button class="inc-btn inc-btn-secondary" id="exportIncBtn">📋 Export JSON</button>';
    html += '</div>';

    // Add idea form (hidden initially)
    html += '<div class="panel inc-form-panel" id="addIdeaForm" style="display:none">';
    html += '<div class="panel-header"><span class="panel-title">New Idea</span><span class="panel-action" id="cancelAddIdea">Cancel</span></div>';
    html += '<div class="panel-body">';
    html += '<div class="inc-field"><label>Title</label><input type="text" id="ideaTitle" placeholder="What\'s the idea?" class="inc-input"></div>';
    html += '<div class="inc-field"><label>Description</label><textarea id="ideaDesc" placeholder="Brief description — what is it, why does it matter?" class="inc-textarea" rows="3"></textarea></div>';
    html += '<div class="inc-field-row">';
    html += '<div class="inc-field"><label>Stage</label><select id="ideaStage" class="inc-select"><option value="concept">💭 Concept</option><option value="developing">🔬 Developing</option><option value="ready">🚀 Ready</option></select></div>';
    html += '<div class="inc-field"><label>Priority</label><select id="ideaPriority" class="inc-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>';
    html += '</div>';
    html += '<div class="inc-field"><label>Notes</label><textarea id="ideaNotes" placeholder="Any early thinking, links, references..." class="inc-textarea" rows="4"></textarea></div>';
    html += '<button class="inc-btn inc-btn-primary" id="saveIdeaBtn">Save Idea</button>';
    html += '</div></div>';

    // Render each stage
    ["concept", "developing", "ready"].forEach(function (stageKey) {
      var stage = stages[stageKey];
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">' + stage.label + '</span><span class="panel-action">' + stage.items.length + ' ideas</span></div>';
      
      if (stage.items.length === 0) {
        html += '<div class="panel-body"><p class="inc-empty">' + stage.desc + '</p></div>';
      } else {
        html += '<div class="panel-body no-pad">';
        stage.items.forEach(function (idea) {
          html += incubatorItemFull(idea);
        });
        html += '</div>';
      }
      html += '</div>';
    });

    container.innerHTML = html;

    // Wire up event handlers
    wireIncubatorEvents(container);
  }

  function wireIncubatorEvents(container) {
    var addBtn = document.getElementById("addIdeaBtn");
    var cancelBtn = document.getElementById("cancelAddIdea");
    var saveBtn = document.getElementById("saveIdeaBtn");
    var exportBtn = document.getElementById("exportIncBtn");
    var form = document.getElementById("addIdeaForm");

    if (addBtn) addBtn.addEventListener("click", function () {
      form.style.display = "block";
      addBtn.style.display = "none";
      document.getElementById("ideaTitle").focus();
    });

    if (cancelBtn) cancelBtn.addEventListener("click", function () {
      form.style.display = "none";
      addBtn.style.display = "";
      clearIdeaForm();
    });

    if (saveBtn) saveBtn.addEventListener("click", function () {
      var title = document.getElementById("ideaTitle").value.trim();
      if (!title) { document.getElementById("ideaTitle").focus(); return; }

      var idea = {
        id: nextIncubatorId(),
        title: title,
        description: document.getElementById("ideaDesc").value.trim(),
        stage: document.getElementById("ideaStage").value,
        priority: document.getElementById("ideaPriority").value,
        notes: document.getElementById("ideaNotes").value.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      incubatorData.ideas.push(idea);
      saveIncubator();
      clearIdeaForm();
      renderIncubator(container);
      buildSidebar(); // Update badge count
      updateFooter();
    });

    if (exportBtn) exportBtn.addEventListener("click", function () {
      var json = JSON.stringify(incubatorData, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "incubator-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Stage change, edit, delete, graduate buttons
    container.querySelectorAll(".inc-stage-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-id");
        var newStage = btn.getAttribute("data-stage");
        var idea = incubatorData.ideas.find(function (i) { return i.id === id; });
        if (idea) {
          idea.stage = newStage;
          idea.updatedAt = new Date().toISOString();
          saveIncubator();
          renderIncubator(container);
          buildSidebar();
          updateFooter();
        }
      });
    });

    container.querySelectorAll(".inc-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-id");
        if (!confirm("Delete this idea?")) return;
        incubatorData.ideas = incubatorData.ideas.filter(function (i) { return i.id !== id; });
        saveIncubator();
        renderIncubator(container);
        buildSidebar();
        updateFooter();
      });
    });

    container.querySelectorAll(".inc-graduate-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-id");
        var idea = incubatorData.ideas.find(function (i) { return i.id === id; });
        if (idea) {
          alert("🎓 \"" + idea.title + "\" is ready to graduate!\n\nNext step: Create a dedicated project dashboard for it, then remove it from the incubator.\n\nFor now, it's marked as Ready.");
          idea.stage = "ready";
          idea.updatedAt = new Date().toISOString();
          saveIncubator();
          renderIncubator(container);
          buildSidebar();
          updateFooter();
        }
      });
    });

    // Inline edit toggle
    container.querySelectorAll(".inc-item-expand").forEach(function (el) {
      el.addEventListener("click", function () {
        var details = el.closest(".inc-item").querySelector(".inc-item-details");
        if (details) {
          details.classList.toggle("expanded");
          el.textContent = details.classList.contains("expanded") ? "▲" : "▼";
        }
      });
    });

    // Notes inline edit
    container.querySelectorAll(".inc-notes-edit").forEach(function (textarea) {
      textarea.addEventListener("blur", function () {
        var id = textarea.getAttribute("data-id");
        var idea = incubatorData.ideas.find(function (i) { return i.id === id; });
        if (idea) {
          idea.notes = textarea.value.trim();
          idea.updatedAt = new Date().toISOString();
          saveIncubator();
        }
      });
    });
  }

  function clearIdeaForm() {
    document.getElementById("ideaTitle").value = "";
    document.getElementById("ideaDesc").value = "";
    document.getElementById("ideaStage").value = "concept";
    document.getElementById("ideaPriority").value = "medium";
    document.getElementById("ideaNotes").value = "";
  }

  // ── VIEW: Dashboard detail ──
  function renderDashDetail(container, dashId) {
    var dash = config.dashboards.find(function (d) { return d.id === dashId; });
    if (!dash) return renderToday(container);

    var data = dashboardData[dashId] || { cards: [] };
    var cards = data.cards || [];

    var html = '<div class="view-header">' +
      '<h1 class="view-title">' + dash.emoji + ' ' + esc(dash.name) + '</h1>' +
      '<p class="view-subtitle">' + esc(dash.description) + ' — ' + cards.length + ' items</p>' +
      '<p class="view-meta">Source: <a href="' + dash.boardUrl + '" target="_blank">' + esc(dash.name) + ' dashboard</a> · Data lives there, not here</p>' +
      '</div>';

    var statuses = ["in-progress", "backlog", "done", "ideas"];
    var statusLabels = { "in-progress": "In Progress", backlog: "Backlog", done: "Done", ideas: "Ideas" };

    statuses.forEach(function (status) {
      var filtered = cards.filter(function (c) { return c.status === status; });
      if (filtered.length === 0) return;

      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">' + statusLabels[status] + '</span><span class="panel-action">' + filtered.length + '</span></div>';
      html += '<div class="panel-body no-pad">';
      filtered.forEach(function (c) {
        var enriched = Object.assign({}, c, { _sourceEmoji: dash.emoji, _sourceName: dash.name });
        html += taskItem(enriched, true);
      });
      html += '</div></div>';
    });

    html += '<div style="margin-top:16px"><a href="' + dash.boardUrl + '" target="_blank" class="panel-action" style="font-size:14px">' + dash.emoji + ' Open full ' + esc(dash.name) + ' dashboard →</a></div>';

    container.innerHTML = html;
  }

  // ── VIEW: James ──
  function renderJames(container) {
    var html = '<div class="view-header">' +
      '<h1 class="view-title">🤖 James</h1>' +
      '<p class="view-subtitle">AI assistant — born ' + jamesData.identity.created + ', named by ' + esc(jamesData.identity.creator) + '</p>' +
      '</div>';

    html += '<div class="panel">';
    html += '<div class="panel-header"><span class="panel-title">How We Work</span></div>';
    html += '<div class="panel-body no-pad">';
    Object.keys(jamesData.workingPatterns).forEach(function (key) {
      var label = key.replace(/([A-Z])/g, " $1").replace(/^./, function (s) { return s.toUpperCase(); });
      html += '<div class="task-item">';
      html += '<div class="task-info">';
      html += '<div class="task-title">' + label + '</div>';
      html += '<div class="task-meta">' + esc(jamesData.workingPatterns[key]) + '</div>';
      html += '</div></div>';
    });
    html += '</div></div>';

    html += '<div class="section-header">Capabilities</div>';
    html += '<div class="tag-grid">';
    jamesData.capabilities.forEach(function (cap) {
      html += '<div class="tag">' + esc(cap) + '</div>';
    });
    html += '</div>';

    html += '<div class="section-header">Our Story</div>';
    html += '<ul class="timeline">';
    jamesData.story.slice().reverse().forEach(function (event) {
      html += '<li class="timeline-item">';
      html += '<div class="timeline-date">' + event.date + '</div>';
      html += '<div class="timeline-event-title">' + esc(event.title) + '</div>';
      html += '<div class="timeline-desc">' + esc(event.description) + '</div>';
      html += '</li>';
    });
    html += '</ul>';

    container.innerHTML = html;
  }

  // ── VIEW: Personal ──
  function renderPersonal(container) {
    var html = '<div class="view-header">' +
      '<h1 class="view-title">👤 Personal</h1>' +
      '<p class="view-subtitle">Your space — life admin, health, goals, notes</p>' +
      '</div>';

    html += '<div class="empty-state">';
    html += '<div class="empty-state-icon">🌱</div>';
    html += '<p>This section is ready for you. Add personal goals, reminders, life admin — anything that helps you keep all the plates spinning.</p>';
    html += '</div>';

    container.innerHTML = html;
  }

  // ── VIEW: Ideas ──
  function renderIdeas(container) {
    var all = getAllCards();
    var ideas = all.filter(function (c) { return c.status === "ideas"; });

    var html = '<div class="view-header">' +
      '<h1 class="view-title">💡 Ideas</h1>' +
      '<p class="view-subtitle">Ideas from across all projects — ' + ideas.length + ' total</p>' +
      '</div>';

    if (ideas.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">💭</div><p>No ideas yet. They\'ll appear here as you add them to any dashboard.</p></div>';
    } else {
      var grouped = {};
      ideas.forEach(function (c) {
        if (!grouped[c._source]) grouped[c._source] = [];
        grouped[c._source].push(c);
      });

      Object.keys(grouped).forEach(function (sourceId) {
        var items = grouped[sourceId];
        var first = items[0];
        html += '<div class="panel">';
        html += '<div class="panel-header"><span class="panel-title">' + first._sourceEmoji + ' ' + first._sourceName + '</span><span class="panel-action">' + items.length + ' ideas</span></div>';
        html += '<div class="panel-body no-pad">';
        items.forEach(function (c) { html += taskItem(c, true); });
        html += '</div></div>';
      });
    }

    container.innerHTML = html;
  }

  // ── Shared renderers ──
  function kpi(icon, value, label, color) {
    return '<div class="kpi-card ' + (color || "") + '">' +
      '<div class="kpi-icon">' + icon + '</div>' +
      '<div class="kpi-value">' + value + '</div>' +
      '<div class="kpi-label">' + label + '</div>' +
      '</div>';
  }

  function taskItem(card, hideSource) {
    var source = hideSource ? "" : '<div class="task-source">' + (card._sourceEmoji || "📋") + '</div>';
    var priority = card.priority ? '<span class="task-priority ' + card.priority + '">' + card.priority + '</span> ' : "";
    var meta = priority + (card.category || "") + (!hideSource && card._sourceName ? " · " + card._sourceName : "");

    return '<div class="task-item">' +
      source +
      '<div class="task-info">' +
      '<div class="task-title">' + esc(card.title) + '</div>' +
      '<div class="task-meta">' + meta + '</div>' +
      '</div></div>';
  }

  function incubatorItem(idea) {
    var stageEmoji = { concept: "💭", developing: "🔬", ready: "🚀" };
    var emoji = stageEmoji[idea.stage] || "💭";
    var priority = idea.priority ? '<span class="task-priority ' + idea.priority + '">' + idea.priority + '</span> ' : "";

    return '<div class="task-item">' +
      '<div class="task-source">' + emoji + '</div>' +
      '<div class="task-info">' +
      '<div class="task-title">' + esc(idea.title) + '</div>' +
      '<div class="task-meta">' + priority + (idea.stage || "concept") + ' · Incubator</div>' +
      '</div></div>';
  }

  function incubatorItemFull(idea) {
    var stageEmoji = { concept: "💭", developing: "🔬", ready: "🚀" };
    var emoji = stageEmoji[idea.stage] || "💭";
    var priority = idea.priority ? '<span class="task-priority ' + idea.priority + '">' + idea.priority + '</span> ' : "";
    var created = idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : "";
    var updated = idea.updatedAt ? new Date(idea.updatedAt).toLocaleDateString() : "";

    var html = '<div class="inc-item">';
    html += '<div class="task-item">';
    html += '<div class="task-source">' + emoji + '</div>';
    html += '<div class="task-info">';
    html += '<div class="task-title">' + esc(idea.title) + '</div>';
    html += '<div class="task-meta">' + priority + 'Created ' + created;
    if (updated && updated !== created) html += ' · Updated ' + updated;
    html += '</div>';
    html += '</div>';
    html += '<div class="inc-item-actions">';
    html += '<button class="inc-item-expand" title="Expand">▼</button>';
    html += '</div>';
    html += '</div>';

    // Expandable details
    html += '<div class="inc-item-details">';
    if (idea.description) html += '<div class="inc-detail-desc">' + esc(idea.description) + '</div>';
    html += '<div class="inc-detail-notes"><label>Notes:</label><textarea class="inc-notes-edit" data-id="' + idea.id + '" rows="3">' + esc(idea.notes || "") + '</textarea></div>';
    html += '<div class="inc-detail-actions">';

    // Stage buttons
    if (idea.stage !== "concept") html += '<button class="inc-stage-btn inc-btn-sm" data-id="' + idea.id + '" data-stage="concept">💭 Concept</button>';
    if (idea.stage !== "developing") html += '<button class="inc-stage-btn inc-btn-sm" data-id="' + idea.id + '" data-stage="developing">🔬 Developing</button>';
    if (idea.stage !== "ready") html += '<button class="inc-graduate-btn inc-btn-sm inc-btn-accent" data-id="' + idea.id + '">🚀 Graduate</button>';
    html += '<button class="inc-delete-btn inc-btn-sm inc-btn-danger" data-id="' + idea.id + '">🗑️ Delete</button>';
    html += '</div></div>';

    html += '</div>';
    return html;
  }

  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  document.addEventListener("DOMContentLoaded", init);

})();
