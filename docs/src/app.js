/* ============================================================
   Solution Planner — app.js
   
   Businesses are solutions to problems. This tool structures 
   the plan to solve them.
   
   Architecture:
   - TODAY: What needs attention right now
   - 8 QUESTIONS: Everything you need to know about your businesses
   - JAMES: AI partner status and our story
   - INCUBATOR: Ideas not yet graduated to their own dashboard
   
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
      buildMobileNav();
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

    if (viewName === "today") renderTodayV2(main);
    else if (viewName === "questions") renderQuestions(main);
    else if (viewName === "businesses") renderBusinesses(main);
    else if (viewName === "incubator") renderIncubator(main);
    else if (viewName === "james") renderJames(main);
    else if (viewName === "personal") renderPersonal(main);
    else if (viewName === "ideas") renderIdeas(main);
    else if (viewName.indexOf("dash-") === 0) renderDashDetail(main, viewName.replace("dash-", ""));
    else if (viewName.indexOf("q-") === 0) renderQuestionDetail(main, viewName.replace("q-", ""));
    else renderTodayV2(main);

    // Update mobile bottom nav
    updateMobileNav(viewName);

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

  // ── VIEW: Today (legacy, kept for reference) ──
  function renderToday(container) { renderTodayV2(container); }

  // ── VIEW: Today V2 — 3-section layout ──
  function renderTodayV2(container) {
    var all = getAllCards();
    var inProgress = all.filter(function (c) { return c.status === "in-progress"; });
    var highBacklog = all.filter(function (c) { return c.priority === "high" && c.status === "backlog"; });
    var recentDone = all.filter(function (c) { return c.status === "done" && c.completedAt; })
      .sort(function (a, b) { return b.completedAt.localeCompare(a.completedAt); })
      .slice(0, 3);
    var totalCards = all.length;
    var doneCards = all.filter(function (c) { return c.status === "done"; }).length;
    var incCount = incubatorData ? incubatorData.ideas.length : 0;
    var urgentItems = inProgress.concat(highBacklog);

    // Time-based greeting
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    var html = '<div class="v2-today">';

    // Header
    html += '<div class="v2-greeting">';
    html += '<h1>' + greeting + ', Andrew</h1>';
    html += '<p class="v2-date">' + new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + '</p>';
    html += '</div>';

    // Section 1: NEEDS ATTENTION
    html += '<div class="v2-section v2-urgent">';
    html += '<div class="v2-section-header">';
    html += '<span class="v2-section-icon">🔴</span>';
    html += '<span class="v2-section-title">Needs Attention</span>';
    html += '<span class="v2-section-count">' + urgentItems.length + '</span>';
    html += '</div>';

    if (urgentItems.length === 0) {
      html += '<div class="v2-empty">All clear — nothing urgent right now ✓</div>';
    } else {
      html += '<div class="v2-items">';
      urgentItems.slice(0, 8).forEach(function (c) {
        var statusIcon = c.status === "in-progress" ? "🔨" : "⚠️";
        html += '<div class="v2-item">';
        html += '<span class="v2-item-icon">' + statusIcon + '</span>';
        html += '<div class="v2-item-body">';
        html += '<div class="v2-item-title">' + esc(c.title) + '</div>';
        html += '<div class="v2-item-meta">' + (c._sourceEmoji || "") + ' ' + (c._sourceName || "") + (c.priority === "high" ? ' · <span class="v2-priority-high">HIGH</span>' : '') + '</div>';
        html += '</div></div>';
      });
      if (urgentItems.length > 8) {
        html += '<div class="v2-item v2-more">+ ' + (urgentItems.length - 8) + ' more items</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Section 2: JAMES STATUS
    html += '<div class="v2-section v2-james">';
    html += '<div class="v2-section-header">';
    html += '<span class="v2-section-icon">🤖</span>';
    html += '<span class="v2-section-title">James</span>';
    html += '</div>';

    html += '<div class="v2-james-card">';
    html += '<div class="v2-james-working">';
    html += '<div class="v2-james-label">Working on</div>';
    html += '<div class="v2-james-task">Business OS Research</div>';
    html += '<div class="v2-progress-bar"><div class="v2-progress-fill" style="width: 80%"></div></div>';
    html += '<div class="v2-james-label" style="margin-top:4px;font-size:11px">8 of 10 research phases complete</div>';
    html += '</div>';

    // Decisions needed from Andrew
    var decisionsNeeded = all.filter(function(c) { 
      return c.status === "backlog" && c.priority === "high" && 
        (c.title.toLowerCase().indexOf("decision") > -1 || c.title.toLowerCase().indexOf("choose") > -1 || c.title.toLowerCase().indexOf("approve") > -1);
    });
    if (decisionsNeeded.length > 0) {
      html += '<div class="v2-james-needs">';
      html += '<div class="v2-james-label">Needs from you</div>';
      decisionsNeeded.slice(0, 3).forEach(function(c) {
        html += '<div class="v2-james-need">• ' + esc(c.title) + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    // Section 3: MONEY (lightweight)
    html += '<div class="v2-section v2-money">';
    html += '<div class="v2-section-header">';
    html += '<span class="v2-section-icon">💰</span>';
    html += '<span class="v2-section-title">Money</span>';
    html += '</div>';
    html += '<div class="v2-money-grid">';
    html += '<div class="v2-money-item v2-money-green"><div class="v2-money-value">—</div><div class="v2-money-label">This month</div></div>';
    html += '<div class="v2-money-item v2-money-red"><div class="v2-money-value">—</div><div class="v2-money-label">Overdue</div></div>';
    html += '<div class="v2-money-item v2-money-grey"><div class="v2-money-value">—</div><div class="v2-money-label">Pipeline</div></div>';
    html += '</div>';
    html += '<div class="v2-money-note">Connect financial data to populate</div>';
    html += '</div>';

    // Quick stats strip
    html += '<div class="v2-stats-strip">';
    html += '<div class="v2-stat"><span class="v2-stat-value">' + totalCards + '</span><span class="v2-stat-label">Total items</span></div>';
    html += '<div class="v2-stat"><span class="v2-stat-value">' + doneCards + '</span><span class="v2-stat-label">Done</span></div>';
    html += '<div class="v2-stat"><span class="v2-stat-value">' + incCount + '</span><span class="v2-stat-label">Ideas</span></div>';
    html += '<div class="v2-stat"><span class="v2-stat-value">' + config.dashboards.length + '</span><span class="v2-stat-label">Dashboards</span></div>';
    html += '</div>';

    // Recently completed (collapsed by default)
    if (recentDone.length > 0) {
      html += '<div class="v2-section v2-done">';
      html += '<div class="v2-section-header v2-collapsible" data-target="recentDone">';
      html += '<span class="v2-section-icon">✅</span>';
      html += '<span class="v2-section-title">Recently Completed</span>';
      html += '<span class="v2-chevron">▸</span>';
      html += '</div>';
      html += '<div class="v2-items v2-collapsed" id="recentDone">';
      recentDone.forEach(function (c) {
        html += '<div class="v2-item">';
        html += '<span class="v2-item-icon">✓</span>';
        html += '<div class="v2-item-body">';
        html += '<div class="v2-item-title">' + esc(c.title) + '</div>';
        html += '<div class="v2-item-meta">' + (c._sourceEmoji || "") + ' ' + (c._sourceName || "") + '</div>';
        html += '</div></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Wire collapsible sections
    container.querySelectorAll(".v2-collapsible").forEach(function(el) {
      el.addEventListener("click", function() {
        var target = document.getElementById(el.getAttribute("data-target"));
        if (target) {
          target.classList.toggle("v2-collapsed");
          el.querySelector(".v2-chevron").textContent = target.classList.contains("v2-collapsed") ? "▸" : "▾";
        }
      });
    });
  }

  // ── VIEW: 8 Questions ──
  function renderQuestions(container) {
    var all = getAllCards();
    var inProgress = all.filter(function (c) { return c.status === "in-progress"; });
    var backlog = all.filter(function (c) { return c.status === "backlog"; });
    var ideas = all.filter(function (c) { return c.status === "ideas"; });
    var incCount = incubatorData ? incubatorData.ideas.length : 0;

    var questions = [
      { id: "work", icon: "📋", question: "What am I working on?", 
        stat: inProgress.length + " active · " + backlog.length + " backlog",
        color: "var(--cc-primary)" },
      { id: "money", icon: "💰", question: "How's my money?", 
        stat: "Connect financial data",
        color: "var(--cc-green)" },
      { id: "customers", icon: "👥", question: "Who are my customers?", 
        stat: "Coming soon",
        color: "var(--cc-amber)" },
      { id: "materials", icon: "📦", question: "What do I need?", 
        stat: "Coming soon",
        color: "var(--cc-purple)" },
      { id: "direction", icon: "🧭", question: "Where am I heading?", 
        stat: config.dashboards.length + " businesses active",
        color: "var(--cc-primary-dark)" },
      { id: "people", icon: "🤝", question: "Who's helping?", 
        stat: "Coming soon",
        color: "var(--cc-green)" },
      { id: "waste", icon: "♻️", question: "What am I wasting?", 
        stat: "Coming soon",
        color: "var(--cc-red)" },
      { id: "new", icon: "💡", question: "What's new?", 
        stat: ideas.length + " ideas · " + incCount + " incubating",
        color: "var(--cc-purple)" }
    ];

    var html = '<div class="v2-questions">';
    html += '<div class="v2-greeting">';
    html += '<h1>The 8 Questions</h1>';
    html += '<p class="v2-date">Everything you need to know about your businesses</p>';
    html += '</div>';

    questions.forEach(function (q) {
      var hasDetail = (q.id === "work" || q.id === "new" || q.id === "direction");
      html += '<div class="v2-question-card' + (hasDetail ? ' v2-clickable' : '') + '" data-question="' + q.id + '">';
      html += '<div class="v2-question-icon" style="background:' + q.color + '">' + q.icon + '</div>';
      html += '<div class="v2-question-body">';
      html += '<div class="v2-question-text">' + q.question + '</div>';
      html += '<div class="v2-question-stat">' + q.stat + '</div>';
      html += '</div>';
      if (hasDetail) html += '<div class="v2-question-arrow">›</div>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Wire clickable questions
    container.querySelectorAll(".v2-clickable").forEach(function(el) {
      el.addEventListener("click", function() {
        switchView("q-" + el.getAttribute("data-question"));
      });
    });
  }

  // ── VIEW: Question detail ──
  function renderQuestionDetail(container, questionId) {
    var all = getAllCards();

    var html = '<div class="v2-question-detail">';
    html += '<div class="v2-back" id="qBack">← Back to Questions</div>';

    if (questionId === "work") {
      var inProgress = all.filter(function (c) { return c.status === "in-progress"; });
      var backlog = all.filter(function (c) { return c.status === "backlog"; });
      var doneRecent = all.filter(function (c) { return c.status === "done" && c.completedAt; })
        .sort(function (a, b) { return b.completedAt.localeCompare(a.completedAt); }).slice(0, 5);

      html += '<div class="v2-greeting"><h1>📋 What am I working on?</h1></div>';

      // Mini kanban
      html += '<div class="v2-mini-kanban">';
      html += '<div class="v2-kanban-col"><div class="v2-kanban-header v2-kanban-doing">Doing · ' + inProgress.length + '</div>';
      inProgress.slice(0, 10).forEach(function(c) {
        html += '<div class="v2-kanban-card">' + (c._sourceEmoji || "") + ' ' + esc(c.title) + '</div>';
      });
      html += '</div>';
      html += '<div class="v2-kanban-col"><div class="v2-kanban-header v2-kanban-next">Next Up · ' + Math.min(backlog.length, 10) + '</div>';
      backlog.filter(function(c) { return c.priority === "high"; }).slice(0, 5).forEach(function(c) {
        html += '<div class="v2-kanban-card">' + (c._sourceEmoji || "") + ' ' + esc(c.title) + '</div>';
      });
      html += '</div>';
      html += '<div class="v2-kanban-col"><div class="v2-kanban-header v2-kanban-done">Done · ' + doneRecent.length + '</div>';
      doneRecent.forEach(function(c) {
        html += '<div class="v2-kanban-card v2-done-card">' + (c._sourceEmoji || "") + ' ' + esc(c.title) + '</div>';
      });
      html += '</div>';
      html += '</div>';

      // By business
      html += '<div class="v2-section"><div class="v2-section-header"><span class="v2-section-title">By Business</span></div>';
      config.dashboards.forEach(function(dash) {
        var cards = (dashboardData[dash.id] || {}).cards || [];
        var active = cards.filter(function(c) { return c.status === "in-progress"; }).length;
        var bl = cards.filter(function(c) { return c.status === "backlog"; }).length;
        var dn = cards.filter(function(c) { return c.status === "done"; }).length;
        if (cards.length === 0) return;
        html += '<div class="v2-biz-row">';
        html += '<span class="v2-biz-name">' + dash.emoji + ' ' + esc(dash.name) + '</span>';
        html += '<span class="v2-biz-stats">' + active + ' active · ' + bl + ' backlog · ' + dn + ' done</span>';
        html += '</div>';
      });
      html += '</div>';

    } else if (questionId === "new") {
      var ideas = all.filter(function (c) { return c.status === "ideas"; });
      var incIdeas = incubatorData ? incubatorData.ideas : [];

      html += '<div class="v2-greeting"><h1>💡 What\'s new?</h1></div>';

      if (incIdeas.length > 0) {
        html += '<div class="v2-section"><div class="v2-section-header"><span class="v2-section-title">🧪 Incubator</span><span class="v2-section-count">' + incIdeas.length + '</span></div>';
        html += '<div class="v2-items">';
        incIdeas.forEach(function(idea) {
          var stageEmoji = { concept: "💭", developing: "🔬", ready: "🚀" };
          html += '<div class="v2-item">';
          html += '<span class="v2-item-icon">' + (stageEmoji[idea.stage] || "💭") + '</span>';
          html += '<div class="v2-item-body">';
          html += '<div class="v2-item-title">' + esc(idea.title) + '</div>';
          html += '<div class="v2-item-meta">' + (idea.stage || "concept") + '</div>';
          html += '</div></div>';
        });
        html += '</div></div>';
      }

      if (ideas.length > 0) {
        html += '<div class="v2-section"><div class="v2-section-header"><span class="v2-section-title">💡 Ideas from Dashboards</span><span class="v2-section-count">' + ideas.length + '</span></div>';
        html += '<div class="v2-items">';
        ideas.slice(0, 15).forEach(function(c) {
          html += '<div class="v2-item">';
          html += '<span class="v2-item-icon">' + (c._sourceEmoji || "💡") + '</span>';
          html += '<div class="v2-item-body">';
          html += '<div class="v2-item-title">' + esc(c.title) + '</div>';
          html += '<div class="v2-item-meta">' + (c._sourceName || "") + '</div>';
          html += '</div></div>';
        });
        html += '</div></div>';
      }

    } else if (questionId === "direction") {
      html += '<div class="v2-greeting"><h1>🧭 Where am I heading?</h1></div>';
      html += '<div class="v2-section">';
      config.dashboards.forEach(function(dash) {
        var data = dashboardData[dash.id] || { cards: [] };
        var cards = data.cards || [];
        var total = cards.length;
        var done = cards.filter(function(c) { return c.status === "done"; }).length;
        var pct = total ? Math.round((done / total) * 100) : 0;

        html += '<div class="v2-direction-card">';
        html += '<div class="v2-direction-header">' + dash.emoji + ' ' + esc(dash.name) + '</div>';
        html += '<div class="v2-direction-desc">' + esc(dash.description) + '</div>';
        html += '<div class="v2-progress-bar"><div class="v2-progress-fill" style="width:' + pct + '%"></div></div>';
        html += '<div class="v2-direction-stats">' + done + '/' + total + ' complete (' + pct + '%)</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    var backBtn = document.getElementById("qBack");
    if (backBtn) backBtn.addEventListener("click", function() { switchView("questions"); });
  }

  // ── Mobile bottom nav ──
  function buildMobileNav() {
    if (document.getElementById("mobileBottomNav")) return;
    if (!config || !config.mobileNav) return;

    var nav = document.createElement("nav");
    nav.id = "mobileBottomNav";
    nav.className = "v2-bottom-nav";

    var html = '';
    config.mobileNav.forEach(function(item) {
      html += '<div class="v2-bnav-item" data-view="' + item.id + '">';
      html += '<span class="v2-bnav-icon">' + item.icon + '</span>';
      html += '<span class="v2-bnav-label">' + item.label + '</span>';
      html += '</div>';
    });
    nav.innerHTML = html;
    document.body.appendChild(nav);

    nav.querySelectorAll(".v2-bnav-item").forEach(function(el) {
      el.addEventListener("click", function() {
        var view = el.getAttribute("data-view");
        if (view === "businesses") {
          // "More" button toggles sidebar on mobile
          toggleMobileSidebar();
        } else {
          switchView(view);
          closeMobileSidebar();
        }
      });
    });
  }

  function updateMobileNav(viewName) {
    var nav = document.getElementById("mobileBottomNav");
    if (!nav) return;
    nav.querySelectorAll(".v2-bnav-item").forEach(function(el) {
      el.classList.toggle("active", el.getAttribute("data-view") === viewName);
    });
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
