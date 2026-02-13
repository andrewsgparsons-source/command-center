# Solution Planner — Architecture

## Purpose
The Solution Planner is Andrew's single pane of glass across all projects, businesses, and ideas. It is **not** a data store for established projects — it's a **viewer** with one exception.

## Two Roles

### 1. Viewer (Established Projects)
For projects that have their own dashboards (shed configurator, Whelpley Farm, Forge AI, GrowCabin, etc.):

- **Data lives on the project dashboard** — that's the source of truth
- Solution Planner **fetches and displays** data from each dashboard's `cards.json` (or equivalent)
- Changes are made on the project dashboard, never in the planner
- If a user writes something in the planner that belongs to a specific project, it **pushes down** to that project's dashboard automatically
- The planner never becomes the canonical store for project data

### 2. Incubator (Embryonic Ideas)
For ideas and concepts that are too early to have their own dashboard:

- The planner **hosts** this data locally in `data/incubator.json`
- Ideas can be developed, fleshed out, and discussed here
- When an idea matures enough to become a real project with its own dashboard:
  1. A new project dashboard is created
  2. The idea's data migrates to that dashboard
  3. The planner switches from hosting to viewing
- The incubator is the **one place** where the planner owns the data — but only temporarily

## Data Flow

```
┌─────────────────────────────────────────────┐
│              SOLUTION PLANNER               │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Viewer  │  │ Viewer  │  │ Viewer  │    │
│  │  Shed   │  │  Farm   │  │ Forge   │    │
│  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │fetch        │fetch       │fetch     │
│       ▼             ▼            ▼          │
│  [cards.json]  [cards.json]  [cards.json]  │
│  (on GitHub    (on GitHub    (on GitHub    │
│   Pages)        Pages)        Pages)       │
│                                             │
│  ┌──────────────────────────────────┐      │
│  │         INCUBATOR                │      │
│  │   (local data/incubator.json)    │      │
│  │                                  │      │
│  │   Embryonic ideas live HERE      │      │
│  │   until they graduate to own     │      │
│  │   dashboard                      │      │
│  └──────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

## Lifecycle of an Idea

1. **Born** → Created in the Incubator section
2. **Developing** → Notes, concept, early planning happen in the Incubator
3. **Graduating** → Reaches critical mass, deserves its own dashboard
4. **Migrated** → Data moves to new project dashboard
5. **Viewed** → Planner now fetches from the project dashboard instead

## Sections

| Section | Role | Data Source |
|---------|------|-------------|
| Today | Viewer | Aggregates from all dashboards + incubator |
| Businesses | Viewer | Dashboard cards.json files |
| Incubator | Owner | Local `data/incubator.json` |
| Ideas | Viewer | Aggregates "ideas" status from all sources |
| James | Local | `data/james.json` |
| Personal | Local | `data/personal.json` |

## Push-Down Rule
If a task/note is created in the planner that clearly belongs to an established project:
- It should be automatically added to that project's dashboard
- Not stored in the planner itself
- (Future: API integration for write-back; for now, flagged for manual sync)

## Tech
- Static site on GitHub Pages
- Vanilla JS, no build step
- Fetches cross-origin JSON from other GitHub Pages dashboards
- localStorage for user preferences and incubator data (with JSON export)

---

*Documented: 2026-02-13 by James*
