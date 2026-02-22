# CanvasInsight HackUNCP2026 AI in Education

CanvasInsight is a Chrome extension that helps professors understand how well their students are grasping course material by using Claude AI to analyze Canvas discussion posts and generate a detailed comprehension report.

What it does

Professors often have 20–30+ student discussion posts to read after every assignment. CanvasInsight reads all of them automatically and produces an instant report showing: 
- Overall class comprehension score
- Which topics students understood well
- Which topics need to be retaught
- Per-student breakdowns with comprehension scores and intervention recommendations
- Suggested follow-up discussion questions targeting identified gaps
- Action items for the professor

Features

- Automatically scrapes Canvas discussion posts (supports both old and new Canvas UI)
- Optionally includes course materials: syllabus, lecture pages, uploaded files so Claude knows exactly what was taught
- Accepts expected learning outcomes to make analysis more precise
- Per-student recommendations: No Action / Monitor / Follow-up / Intervention
- Beautiful full-page dashboard report
- Saves history of past analyses
- Print / Save as PDF

File Structure

CanvasInsight/
├── manifest.json       # Chrome extension config
├── content.js          # Scrapes Canvas posts + calls Claude AI
├── background.js       # Saves history, opens dashboard
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── dashboard.html      # Full report page
└── dashboard.js        # Dashboard rendering logic

Installation

This extension is not on the Chrome Web Store, it must be loaded manually in Developer Mode.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in the top right)
4. Click **Load Unpacked**
5. Select the folder containing `manifest.json` and all your files
6. The CanvasInsight icon will appear in your toolbar

Setup: Anthropic API Key

CanvasInsight uses the Claude AI API to analyze discussions. You need a free API key from Anthropic.

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account
2. Generate an API key (starts with `sk-ant-`). **COPY THE API KEY BECAUSE YOU WON'T BE ABLE TO SEE IT AGAIN**
3. Click the CanvasInsight extension icon → go to **⚙ Settings**
4. Paste your API key and click **Save**

Supported Canvas Instances

- `*.instructure.com`
- `*.canvas.net`
- `canvas.uncp.edu` / `*.uncp.edu`

Tech Stack

| Technology | Use |
|---|---|
| Chrome Extension (Manifest V3) | Extension platform |
| Claude claude-sonnet-4-20250514 (Anthropic) | AI analysis |
| Canvas LMS REST API | Fetching posts & course materials |
| Vanilla JS / HTML / CSS | UI |

Notes

- Your API key is stored locally in Chrome storage and never sent anywhere except directly to Anthropic's API
- The extension only activates on Canvas discussion pages
- Analysis quality improves significantly when course materials are included

Teams

Shraya Rajkarnikar and
Jebish Bhattarai Khatri 

Built at **HackUNCP 2026** for the AI in Education track.
