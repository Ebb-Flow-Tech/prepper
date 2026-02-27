#!/usr/bin/env python3
"""PDF Report Generator — produces a formatted PDF from structured findings.

Usage:
    python generate_report.py [--input findings.json] [--output report.pdf] [--title "Report Title"] [--project "Project Name"]

If --input is omitted, reads JSON from stdin.
If --output is omitted, saves to ~/Downloads/optimisation-report.pdf.

Expected JSON structure:
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
  },
  ...
]
"""

import argparse
import json
import os
import sys
from datetime import date

try:
    from fpdf import FPDF
except ImportError:
    print("fpdf2 not installed. Installing...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2", "--quiet"])
    from fpdf import FPDF


# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------
SEVERITY_COLOURS = {
    "HIGH": (220, 38, 38),      # red
    "MEDIUM": (234, 138, 0),    # orange
    "MED": (234, 138, 0),       # alias
    "LOW": (22, 163, 74),       # green
}

HEADER_BG = (30, 41, 59)       # slate-800
HEADER_FG = (255, 255, 255)
ROW_ALT_BG = (241, 245, 249)   # slate-100
BORDER_CLR = (203, 213, 225)    # slate-300
ACCENT = (59, 130, 246)         # blue-500


class ReportPDF(FPDF):
    """Custom PDF with header/footer and helper methods."""

    def __init__(self, report_title: str, project_name: str):
        super().__init__()
        self.report_title = report_title
        self.project_name = project_name

    # -- Page footer ----------------------------------------------------------

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    # -- Title page -----------------------------------------------------------

    def add_title_page(self, total_findings: int):
        self.add_page()
        self.ln(60)
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(*ACCENT)
        self.cell(0, 14, self.report_title, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_font("Helvetica", "", 14)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, f"Project: {self.project_name}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 10, f"Date: {date.today().isoformat()}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 10, f"Total findings: {total_findings}", align="C", new_x="LMARGIN", new_y="NEXT")

    # -- Summary table --------------------------------------------------------

    def add_summary_table(self, findings: list[dict]):
        self.add_page()
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(0, 0, 0)
        self.cell(0, 12, "Summary", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

        col_widths = [12, 55, 25, 0]  # last column fills remaining space
        col_widths[3] = self.epw - sum(col_widths[:3])
        headers = ["#", "Category", "Severity", "Title"]

        # Header row
        self.set_font("Helvetica", "B", 10)
        self.set_fill_color(*HEADER_BG)
        self.set_text_color(*HEADER_FG)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 8, header, border=1, fill=True, align="C")
        self.ln()

        # Data rows
        self.set_font("Helvetica", "", 9)
        for idx, f in enumerate(findings, 1):
            is_alt = idx % 2 == 0
            if is_alt:
                self.set_fill_color(*ROW_ALT_BG)

            self.set_text_color(0, 0, 0)
            self.cell(col_widths[0], 7, str(idx), border=1, fill=is_alt, align="C")
            self.cell(col_widths[1], 7, f.get("category", ""), border=1, fill=is_alt)

            # Severity with colour
            sev = f.get("severity", "").upper()
            sev_colour = SEVERITY_COLOURS.get(sev, (0, 0, 0))
            self.set_text_color(*sev_colour)
            self.cell(col_widths[2], 7, sev, border=1, fill=is_alt, align="C")

            self.set_text_color(0, 0, 0)
            title_text = f.get("title", "")[:80]
            self.cell(col_widths[3], 7, title_text, border=1, fill=is_alt)
            self.ln()

    # -- Individual finding ---------------------------------------------------

    def add_finding(self, index: int, finding: dict):
        self.add_page()

        # Finding header
        sev = finding.get("severity", "").upper()
        sev_colour = SEVERITY_COLOURS.get(sev, (0, 0, 0))

        self.set_font("Helvetica", "B", 16)
        self.set_text_color(0, 0, 0)
        self.cell(0, 10, f"Finding #{index}", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

        # Meta line: category + severity badge
        self.set_font("Helvetica", "", 11)
        self.set_text_color(80, 80, 80)
        self.cell(30, 7, "Category:")
        self.set_text_color(0, 0, 0)
        self.cell(60, 7, finding.get("category", "N/A"), new_x="LMARGIN", new_y="NEXT")

        self.set_text_color(80, 80, 80)
        self.cell(30, 7, "Severity:")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*sev_colour)
        self.cell(60, 7, sev, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

        # Subsections
        sections = [
            ("Location", finding.get("location", "")),
            ("Problem", finding.get("problem", "")),
            ("Impact", finding.get("impact", "")),
            ("Proposed Fix", finding.get("proposed_fix", "")),
            ("Safety Guarantee", finding.get("safety_guarantee", "")),
        ]

        for label, body in sections:
            if not body:
                continue
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(*ACCENT)
            self.cell(0, 8, label, new_x="LMARGIN", new_y="NEXT")

            self.set_font("Helvetica", "", 10)
            self.set_text_color(40, 40, 40)
            self.multi_cell(0, 5, body)
            self.ln(3)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate a PDF report from structured findings.")
    parser.add_argument("--input", "-i", help="Path to JSON findings file (reads stdin if omitted)")
    parser.add_argument("--output", "-o", help="Output PDF path (default: ~/Downloads/optimisation-report.pdf)")
    parser.add_argument("--title", "-t", default="Performance Optimisation Report", help="Report title")
    parser.add_argument("--project", "-p", default="Prepper", help="Project name")
    args = parser.parse_args()

    # Load findings
    if args.input:
        with open(args.input) as f:
            findings = json.load(f)
    else:
        findings = json.load(sys.stdin)

    if not isinstance(findings, list):
        print("Error: JSON input must be a list of finding objects.", file=sys.stderr)
        sys.exit(1)

    # Resolve output path
    output_path = args.output or os.path.join(os.path.expanduser("~"), "Downloads", "optimisation-report.pdf")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Build PDF
    pdf = ReportPDF(report_title=args.title, project_name=args.project)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)

    pdf.add_title_page(len(findings))
    pdf.add_summary_table(findings)

    for idx, finding in enumerate(findings, 1):
        pdf.add_finding(idx, finding)

    pdf.output(output_path)
    print(f"Report saved to: {output_path}")
    print(f"Size: {os.path.getsize(output_path):,} bytes")


if __name__ == "__main__":
    main()
