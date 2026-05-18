# AAST LMS Sync

A high-fidelity automation tool designed to synchronize, categorize, and organize AAST LMS course materials into structured local directories.

## Overview

`aast-lms-sync` is a professional-grade synchronization engine that automates the management of university course materials. By bridging the AAST LMS (Moodle-based) with your local filesystem, it eliminates the manual effort of downloading and organizing lectures, sections, and assignments. It features intelligent resource detection, standardized naming conventions, and support for external cloud sources.

## Key Features

- **Automated Synchronization**: Seamlessly pulls course materials directly from the AAST LMS.
- **Course Discovery**: Built-in module to automatically identify enrolled courses and their corresponding LMS IDs.
- **Intelligent Categorization**: Automatically sorts resources into `Lectures`, `Sections`, and `Assignments` subfolders.
- **Standardized Naming**: Applies a consistent `Week XX - [Resource Name]` prefix based on the LMS section structure.
- **Delta Sync Engine**: Performs state analysis to only download new or modified files, saving time and bandwidth.
- **External Source Integration**: Native support for synchronizing supplementary materials from Google Drive links.

## Prerequisites & Rationale

To ensure reliable performance across dynamic web environments, the following dependencies are required:

- **Node.js (v16+)**: The primary runtime environment for the sync engine.
- **Puppeteer**: Required for handling the dynamic rendering of Moodle's login flows and AJAX-heavy dashboards.
- **gdown**: A specialized CLI tool required for downloading files and folders from external Google Drive links commonly used in course sections.
- **Chrome/Chromium**: The underlying browser engine used by Puppeteer for headless automation.

## Architecture

The tool is built on a modular architecture to ensure maintainability and extensibility:

1.  **Discovery Module (`scripts/discover.cjs`)**: Responsible for scraping the user's LMS dashboard to extract course names and their internal IDs.
2.  **Sync Engine (`scripts/lms_sync.cjs`)**: The core logic that handles authentication, course page parsing, resource extraction, and the download pipeline.
3.  **Portal Parser (`scripts/parse_portal.cjs`)**: A utility module for handling specific AAST portal interactions and data extraction.

## Data Flow

The synchronization process follows a rigorous 5-step data flow:

1.  **Authentication**: The engine reads credentials from `lms_creds.txt`, performs a headless login, and persists the session in `session.json` to minimize login frequency.
2.  **Mapping**: Resolves the target course name to its LMS ID using `courses.json` or the Discovery Module.
3.  **Delta Analysis**: Scrapes the course page to build a metadata map of all resources and compares it against the local directory state.
4.  **Fetching**: Downloads files directly from the LMS. If an external Google Drive link is detected, it delegates the download to the `gdown` utility.
5.  **Post-Processing**: Sanitizes filenames, applies the `Week XX` prefix, and moves files into their respective category folders (`Lectures`, `Sections`, `Assignments`).

## Gemini CLI / AI Skill Integration

`aast-lms-sync` is designed to function as an **AI Skill (MCP Server)**. This allows AI agents (like Gemini) to interact with your university materials through natural language.

### Developer Integration
The skill is defined in `SKILL.md`, which provides the agent with the necessary context to:
- Understand when to trigger a synchronization.
- Map user-friendly course names to the underlying script parameters.
- Handle the local filesystem paths according to the user's workspace.

### Example Agent Interactions
- *"Sync my Computing Algorithms course."*
- *"Check for any new assignments in Numerical Methods."*
- *"Organize my Uni folder and download missing materials."*

## Setup & Configuration

### 1. Installation
```bash
git clone <repository-url>
cd lms-sync-skill
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory with the following variables:
```env
BASE_DIR="C:/Users/YourUser/OneDrive/Desktop/Uni"
CRED_FILE="C:/Users/YourUser/OneDrive/Desktop/Uni/lms_creds.txt"
GDOWN_PATH="gdown"
PUPPETEER_EXECUTABLE_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
```

### 3. Course Mapping
Copy the example configuration and add your courses:
```bash
cp courses.json.example courses.json
```
Edit `courses.json` to include your course IDs (found via `npm run discover`):
```json
{
  "Numerical Methods": { "id": "1523" },
  "System Modeling": { 
    "id": "10227",
    "extra_sources": {
      "Sections": "https://drive.google.com/drive/folders/..."
    }
  }
}
```

## Privacy & Security

> [!CAUTION]
> **Protect Your Credentials**
> - **`lms_creds.txt`**: This file contains your plaintext LMS password. Ensure it is stored in a secure location and **never** committed to version control.
> - **`session.json`**: Contains active session cookies. Treat this file with the same level of security as your password.
> - **Compliance**: Use this tool in accordance with your institution's Acceptable Use Policy. Excessive scraping may trigger rate limits or security flags.

## License

This project is licensed under the ISC License.
