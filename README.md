# ⚡ Command Center — Andrew & James

A meta-dashboard that aggregates all projects, businesses, and AI coordination into one view.

## Architecture

The Command Center is a **pure client-side aggregator**. It fetches data from child dashboards at load time via their GitHub Pages URLs. No build step, no server — just `fetch()` calls.

### Data Flow

```
Command Center (this repo)
├── fetches → shed-project-board/data/cards.json
├── fetches → whelpley-farm-dashboard/data/cards.json
├── local   → data/james.json (AI coordination)
└── local   → data/config.json (dashboard registry)
```

### Child Dashboards

| Dashboard | Repo | Data |
|-----------|------|------|
| 🏠 Garden Buildings | `shed-project-board` | Kanban cards, deliverables |
| 🌾 Whelpley Farm | `whelpley-farm-dashboard` | Farm operations |

### Sections

- **🎯 Today** — Urgent items pulled from ALL dashboards
- **📊 Businesses** — Overview cards linking to each dashboard
- **🤖 James** — AI assistant story, capabilities, working patterns
- **👤 Personal** — Life admin, goals, notes
- **💡 Ideas** — Cross-project ideas aggregated in one place

## Setup

GitHub Pages serves from `docs/`. No build required.

## Adding a New Dashboard

1. Add entry to `docs/data/config.json` with the dashboard's `dataUrl`
2. Dashboard must expose a JSON file with a `cards` array
3. Command Center auto-fetches and aggregates at load time
