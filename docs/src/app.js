/* ============================================================
   Solution Planner — app.js
   Aggregates data from child dashboards, renders unified view
   ============================================================ */

(function () {
  "use strict";

  // ── State ──
  var config = null;
  var dashboardData = {}; // { shed: {cards:[]}, farm: {cards:[]} }
  var jamesData = null;
  var currentView = localStorage.getItem("cc-view") || "today";

  // ── Load all data ──
  function init() {
    Promise.all([
      fetch("data/config.json").then(function (r) { return r.json(); }),
      fetch("data/james.json").then(function (r) { return r.json(); })
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
        // Tool/app entries without card data (e.g. configurator)
        dashboardData[dash.id] = { cards: [] };
        // Optionally fetch build info
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

    // Main sections
    config.sections.forEach(function (s) {
      var badge = "";
      if (s.id === "today") {
        var urgentCount = getUrgentCount();
        if (urgentCount > 0) badge = '<span class="nav-badge urgent">' + urgentCount + "</span>";
      }
      html += '<div class="nav-item' + (s.id === currentView ? " active" : "") + '" data-view="' + s.id + '">' +
        '<span class="nav-icon">' + s.icon + "</span>" +
        '<span class="nav-label">' + s.label + "</span>" +
        badge +
        "</div>";
    });

    // Separator + dashboard links
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

    // Click handlers
    nav.querySelectorAll(".nav-item").forEach(function (el) {
      el.addEventListener("click", function () {
        switchView(el.getAttribute("data-view"));
        closeMobileSidebar();
      });
    });

    // Mobile menu
    document.getElementById("menuBtn").addEventListener("click", toggleMobileSidebar);
  }

  function switchView(viewName) {
    currentView = viewName;
    localStorage.setItem("cc-view", viewName);

    // Update nav
    document.querySelectorAll(".nav-item").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-view") === viewName);
    });

    var main = document.getElementById("mainContent");

    if (viewName === "today") renderToday(main);
    else if (viewName === "businesses") renderBusinesses(main);
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
    document.getElementById("sidebarStatus").textContent = total + " items across " + dashCount + " dashboards";
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

    var html = '<div class="view-header">' +
      '<h1 class="view-title">🎯 Today</h1>' +
      '<p class="view-subtitle">What matters right now — across everything</p>' +
      '</div>';

    // KPIs
    html += '<div class="kpi-grid">';
    html += kpi("🔨", inProgress.length, "In Progress", "blue");
    html += kpi("🔴", highBacklog.length, "High Priority", "red");
    html += kpi("✅", doneCards, "Completed", "green");
    html += kpi("📈", pct + "%", "Overall Progress", "purple");
    html += '</div>';

    // In Progress
    if (inProgress.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">🔨 In Progress</span></div>';
      html += '<div class="panel-body no-pad">';
      inProgress.forEach(function (c) { html += taskItem(c); });
      html += '</div></div>';
    }

    // High priority backlog
    if (highBacklog.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">🔴 High Priority Backlog</span><span class="panel-action">' + highBacklog.length + ' items</span></div>';
      html += '<div class="panel-body no-pad">';
      highBacklog.slice(0, 10).forEach(function (c) { html += taskItem(c); });
      if (highBacklog.length > 10) html += '<div class="task-item"><div class="task-info"><span class="task-meta">+ ' + (highBacklog.length - 10) + ' more...</span></div></div>';
      html += '</div></div>';
    }

    // Recent completions
    if (recentDone.length > 0) {
      html += '<div class="panel">';
      html += '<div class="panel-header"><span class="panel-title">✅ Recently Completed</span></div>';
      html += '<div class="panel-body no-pad">';
      recentDone.forEach(function (c) { html += taskItem(c); });
      html += '</div></div>';
    }

    container.innerHTML = html;
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
        // Tool/app card — show build info instead of task stats
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

    // Click handlers
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

  // ── VIEW: Dashboard detail ──
  function renderDashDetail(container, dashId) {
    var dash = config.dashboards.find(function (d) { return d.id === dashId; });
    if (!dash) return renderToday(container);

    var data = dashboardData[dashId] || { cards: [] };
    var cards = data.cards || [];

    var html = '<div class="view-header">' +
      '<h1 class="view-title">' + dash.emoji + ' ' + esc(dash.name) + '</h1>' +
      '<p class="view-subtitle">' + esc(dash.description) + ' — ' + cards.length + ' items</p>' +
      '</div>';

    // Stats
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

    // Working patterns
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

    // Capabilities
    html += '<div class="section-header">Capabilities</div>';
    html += '<div class="tag-grid">';
    jamesData.capabilities.forEach(function (cap) {
      html += '<div class="tag">' + esc(cap) + '</div>';
    });
    html += '</div>';

    // Story timeline
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
      // Group by source
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

  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  document.addEventListener("DOMContentLoaded", init);

})();
