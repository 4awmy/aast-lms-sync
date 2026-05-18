# aast-lms-sync

A professional automation tool to synchronize, categorize, and organize AAST LMS course materials into structured local directories.

## Overview

`aast-lms-sync` automates the tedious process of downloading and organizing university course materials. It scrapes the AAST LMS, identifies resource types (Lectures, Sections, Assignments), and organizes them into a clean folder structure with consistent naming conventions.

## Features

- **Automated Scraping**: Extracts course structure and resource links directly from the LMS.
- **Smart Categorization**: Automatically sorts files into `Lectures`, `Sections`, and `Assignments`.
- **Consistent Naming**: Prefixes files with `Week XX -` based on their position in the LMS.
- **Delta Sync**: Only downloads new or updated files to save bandwidth and time.
- **Extra Sources**: Support for external links (e.g., Google Drive) for supplementary materials.
- **Discovery Mode**: Easily find your Course IDs with the discovery tool.

## Prerequisites

- **Node.js**: Version 16 or higher.
- **Google Cloud SDK**: Required for certain integrations.
- **gdown**: Required for downloading from Google Drive sources.
- **Chrome/Chromium**: Required for Puppeteer-based scraping.

## Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd aast-lms-sync
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file or set the following environment variables:
   - `SKILL_DIR`: Path to this skill directory.
   - `BASE_DIR`: Your primary University folder (e.g., `C:/Users/omarh/OneDrive/Desktop/Uni`).
   - `CRED_FILE`: Path to your `lms_creds.txt` (Format: Line 1: Username, Line 2: Password).
   - `GDOWN_PATH`: Path to the `gdown` executable.
   - `PUPPETEER_EXECUTABLE_PATH`: Path to your Chrome/Chromium executable.
   - `SCREENSHOT_PATH`: Directory for debugging screenshots.

4. **Configure Courses**:
   Copy `courses.json.example` to `courses.json` and fill in your course details.
   ```bash
   cp courses.json.example courses.json
   ```

## Usage

### Discovery Tool
To find the IDs of the courses you are currently enrolled in:
```bash
npm run discover
```

### Synchronizing a Course
Run the sync script with the Course ID and the target local directory:
```bash
node scripts/lms_sync.cjs <course_id> <local_dir_path>
```

## Gemini CLI Integration (AI Skill)

This project is designed to work as a Gemini CLI skill. When integrated, you can use natural language to manage your course materials.

**Example Commands:**
- "Sync my Computing Algorithms course."
- "Check for new assignments in Numerical Methods."
- "Organize my Uni folder."

The skill uses the `SKILL.md` definition to understand its capabilities and how to interface with the scripts.

## Configuration (`courses.json`)

The `courses.json` file maps course names to their LMS IDs and optional extra sources.

```json
{
  "Numerical Methods (CCS3002)": { "id": "1523" },
  "System Modeling": { 
    "id": "10227",
    "extra_sources": {
      "Sections": "https://drive.google.com/drive/folders/..."
    }
  }
}
```

## Privacy & Security Warning

> [!IMPORTANT]
> **Handle your credentials with care.**
> - Never commit `lms_creds.txt` or `courses.json` containing sensitive information to public repositories.
> - This tool uses Puppeteer to automate LMS interactions. Ensure your usage complies with your institution's IT policies.
> - Your LMS session data is stored locally in `session.json`. Do not share this file.

## License

This project is licensed under the ISC License.
