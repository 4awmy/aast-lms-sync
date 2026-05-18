<div align="center">

# AAST LMS Sync

**Automated course material synchronization for AAST Moodle LMS**

[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![Puppeteer](https://img.shields.io/badge/Powered%20by-Puppeteer-40B5A4?style=flat-square&logo=googlechrome&logoColor=white)](https://pptr.dev)
[![AI Skill](https://img.shields.io/badge/AI%20Skill-Gemini%20%2F%20MCP-4285F4?style=flat-square&logo=google&logoColor=white)](SKILL.md)

Eliminates the manual effort of downloading and organizing lectures, sections, and assignments from the AAST LMS. Supports delta sync, intelligent categorization, Google Drive integration, and AI agent control via the Gemini CLI.

</div>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [AI Skill Integration](#ai-skill-integration)
- [Security & Privacy](#security--privacy)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Automated Sync** | Pulls course materials directly from the AAST LMS (Moodle) |
| **Course Discovery** | Auto-detects enrolled courses and their LMS IDs |
| **Smart Categorization** | Sorts resources into `Lectures/`, `Sections/`, and `Assignments/` |
| **Standardized Naming** | Applies `Week XX — [Resource Name]` prefix from LMS section structure |
| **Delta Sync** | Only downloads new or modified files — saves time and bandwidth |
| **Google Drive Support** | Syncs supplementary materials from Drive links via `gdown` |
| **Session Persistence** | Caches authenticated sessions to minimize login frequency |

---

## Architecture

```
aast-lms-sync/
├── scripts/
│   ├── discover.cjs        # Dashboard scraper — extracts course names & LMS IDs
│   ├── lms_sync.cjs        # Core sync engine — auth, parsing, download pipeline
│   └── parse_portal.cjs    # AAST portal utilities & data extraction
├── courses.json            # Course ID mapping (created from example)
├── courses.json.example    # Template for courses.json
├── SKILL.md                # AI agent skill definition (Gemini / MCP)
└── package.json
```

### Data Flow

```
Credentials  ──►  Authentication  ──►  Session Cache (session.json)
                       │
                       ▼
              Course ID Resolution
             (courses.json / Discovery)
                       │
                       ▼
              Delta Analysis
         (remote metadata vs local state)
                       │
              ┌────────┴────────┐
              ▼                 ▼
         LMS Download     Google Drive
         (axios/fetch)      (gdown)
              │                 │
              └────────┬────────┘
                       ▼
              Post-Processing
         (rename → Week XX prefix → categorize)
```

---

## Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org) | v16+ | Runtime environment |
| [Puppeteer](https://pptr.dev) | bundled via npm | Headless browser for Moodle login & AJAX pages |
| [gdown](https://github.com/wkentaro/gdown) | latest | Downloads files/folders from Google Drive |
| Chrome / Chromium | any recent | Browser engine used by Puppeteer |

Install `gdown` via pip:
```bash
pip install gdown
```

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/4awmy/aast-lms-sync.git
cd aast-lms-sync
npm install
```

### 2. Create Credentials File

Create `lms_creds.txt` in your `Uni` directory:
```
your_lms_username
your_lms_password
```

> [!IMPORTANT]
> Each credential must be on its own line. Do **not** include labels or extra whitespace.

### 3. Configure Environment

Create a `.env` file in the project root:
```env
BASE_DIR="C:/Users/YourUser/OneDrive/Desktop/Uni"
CRED_FILE="C:/Users/YourUser/OneDrive/Desktop/Uni/lms_creds.txt"
GDOWN_PATH="gdown"
PUPPETEER_EXECUTABLE_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
```

---

## Configuration

### Course Mapping

Copy the example and populate your courses:
```bash
cp courses.json.example courses.json
```

Edit `courses.json`:
```json
{
  "Numerical Methods": { "id": "1523" },
  "System Modeling And Simulation": {
    "id": "10227",
    "extra_sources": {
      "Sections": "https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
    }
  },
  "Computing Algorithms": { "id": "10230" }
}
```

> **Tip:** Don't know your course IDs? Run the discovery script:
> ```bash
> npm run discover
> ```

---

## Usage

### Sync a Specific Course
```bash
node scripts/lms_sync.cjs "Numerical Methods"
```

### Discover All Enrolled Courses
```bash
npm run discover
```

### Output Structure

After a sync, materials are organized as:
```
Uni/
└── Numerical Methods/
    ├── Lectures/
    │   ├── Week 01 — Introduction to Numerical Methods.pdf
    │   └── Week 02 — Error Analysis.pdf
    ├── Sections/
    │   └── Week 01 — Section Practice.pdf
    └── Assignments/
        └── Week 03 — Assignment 1.pdf
```

---

## AI Skill Integration

`aast-lms-sync` is designed as an **AI Skill** compatible with the Gemini CLI and MCP-based agents. The [`SKILL.md`](SKILL.md) file provides agents with the context to:

- Understand when to trigger a sync
- Map natural language course names to script parameters
- Handle local filesystem paths according to the user's workspace

### Example Agent Commands
```
"Sync my Computing Algorithms course."
"Check for new assignments in Numerical Methods."
"Download all missing materials for this week."
```

---

## Security & Privacy

> [!CAUTION]
> **Protect Your Credentials**
>
> - **`lms_creds.txt`** — Contains your plaintext LMS password. Store it in a secure location and **never** commit it to version control. It is listed in `.gitignore` by default.
> - **`session.json`** — Contains active session cookies. Treat it with the same security level as your password.
> - **`.env`** — Contains filesystem paths. Do not commit.
>
> **Compliance:** Use this tool in accordance with AAST's Acceptable Use Policy. Avoid excessive scraping that may trigger rate limits or security flags.

---

## License

This project is licensed under the [ISC License](LICENSE).

---

<div align="center">
  <sub>Built for AAST students, by an AAST student.</sub>
</div>
