---
name: pdf-report-generator
description: 'Generate a formatted PDF report from structured findings and save it to ~/Downloads/. Use when you need to produce a downloadable PDF document from analysis results, audit reports, or optimisation findings. Handles dependency installation, PDF layout, and file output.'
license: MIT
allowed-tools: Bash, Write, Read
---

# PDF Report Generator

## Overview

Generate a well-formatted PDF report from structured data (e.g. performance findings, audit results) and save it to the user's `~/Downloads/` folder.

## How to Use

When invoked, you will receive structured findings data as context. Generate a Python script that produces a PDF using `fpdf2`, then execute it.

## Steps

### 1. Ensure `fpdf2` is available

```bash
pip install fpdf2 --quiet
```

If running inside a virtual environment, install there. Otherwise install globally with `--user`. The script auto-installs `fpdf2` if missing, but pre-installing avoids delays.

### 2. Prepare findings as JSON

Write the findings data to a temporary JSON file at `/tmp/report_findings.json`. The expected structure:

```json
[
  {
    "title": "Finding title",
    "category": "Database",
    "severity": "HIGH",
    "location": "file.py:42",
    "problem": "Description of the problem...",
    "impact": "What impact this has...",
    "proposed_fix": "How to fix it...",
    "safety_guarantee": "Why this is safe to change..."
  }
]
```

Severity values: `HIGH`, `MEDIUM` (or `MED`), `LOW`.

### 3. Execute the script

The generator script lives at `.agents/skills/pdf-report-generator/generate_report.py`.

```bash
python .agents/skills/pdf-report-generator/generate_report.py \
  --input /tmp/report_findings.json \
  --title "Performance Optimisation Report" \
  --project "Prepper"
```

Optional flags:
- `--input / -i` — path to JSON file (reads stdin if omitted)
- `--output / -o` — output PDF path (default: `~/Downloads/optimisation-report.pdf`)
- `--title / -t` — report title (default: `"Performance Optimisation Report"`)
- `--project / -p` — project name (default: `"Prepper"`)

### 4. Confirm output

The script prints the file path and size. Verify if needed:

```bash
ls -la ~/Downloads/optimisation-report.pdf
```

Report the file path and size to the user.

### 5. Cleanup

```bash
rm /tmp/report_findings.json
```

## PDF Layout Reference

```
┌─────────────────────────────┐
│        TITLE PAGE           │
│  "Performance Optimisation  │
│        Report"              │
│  Project: Prepper           │
│  Date: YYYY-MM-DD           │
│  Total findings: N          │
├─────────────────────────────┤
│      SUMMARY TABLE          │
│  # │ Category │ Sev │ Title │
│  1 │ Database │ HIGH│ ...   │
│  2 │ Frontend │ MED │ ...   │
├─────────────────────────────┤
│      FINDING #1             │
│  Category: Database         │
│  Severity: HIGH             │
│                             │
│  Location:                  │
│    file.py:42               │
│                             │
│  Problem:                   │
│    Description here...      │
│                             │
│  Impact:                    │
│    Detailed impact...       │
│                             │
│  Proposed Fix:              │
│    Fix description...       │
│                             │
│  Safety Guarantee:          │
│    Why outputs unchanged... │
├─────────────────────────────┤
│      FINDING #2             │
│  ...                        │
└─────────────────────────────┘
```

## Important Notes

- The generator script at `.agents/skills/pdf-report-generator/generate_report.py` is reusable — do NOT delete it.
- Write findings to a temp JSON file and pass via `--input`. Clean up the temp JSON after.
- Always expand `~` to the full home directory path.
- If `fpdf2` installation fails, fall back to `reportlab` as an alternative.
- The filename should be `optimisation-report.pdf` unless otherwise specified via `--output`.
