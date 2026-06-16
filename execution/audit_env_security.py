"""
execution/audit_env_security.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Scans local files and repository commit log history to audit for credentials leakages.
Inputs:  --repo-path (defaults to current project root)
Outputs: Security risk summary report saved to .tmp/ directory, console alerts.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import json
import re
import argparse
import logging
import subprocess
from datetime import datetime, timezone

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"audit_env_security_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

# Common regex patterns for secrets
SECRET_PATTERNS = {
    "Google API Key": re.compile(r"AIzaSy[A-Za-z0-9_-]{33}"),
    "Generic Private Key": re.compile(r"-----BEGIN [A-Z]+ PRIVATE KEY-----"),
    "Supabase Secret Key": re.compile(r"sbp_[a-zA-Z0-9]{40}")
}

def check_gitignore(repo_path, findings):
    """Checks if .gitignore properly ignores sensitive folders and files."""
    gitignore_path = os.path.join(repo_path, ".gitignore")
    if not os.path.exists(gitignore_path):
        findings.append({
            "severity": "CRITICAL",
            "file": ".gitignore",
            "message": "Missing .gitignore file entirely. Secrets could easily be committed."
        })
        return

    with open(gitignore_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith("#")]
    
    required_ignores = [".env", ".tmp", "node_modules", "dist"]
    for item in required_ignores:
        found = False
        for line in lines:
            if item in line or line.rstrip("/") == item:
                found = True
                break
        if not found:
            findings.append({
                "severity": "HIGH",
                "file": ".gitignore",
                "message": f"'{item}' is not ignored in .gitignore."
            })

def check_tracked_files(repo_path, findings):
    """Verifies that no .env or .tmp files are currently tracked by git."""
    try:
        # Run git ls-files to see if any .env or .tmp files are tracked
        res = subprocess.run(
            ["git", "ls-files"], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True
        )
        tracked_files = res.stdout.splitlines()
        for f in tracked_files:
            if ".env" in f or f.startswith(".tmp/"):
                findings.append({
                    "severity": "CRITICAL",
                    "file": f,
                    "message": "File is currently tracked by Git. Run 'git rm --cached <file>' to un-track it."
                })
    except subprocess.CalledProcessError as e:
        logging.warning(f"Git command failed: {e}. Skipping tracked files check.")
    except FileNotFoundError:
        logging.warning("git executable not found. Skipping tracked files check.")

def check_git_history(repo_path, findings):
    """Checks git history to see if .env or similar secrets files were ever committed."""
    try:
        res = subprocess.run(
            ["git", "log", "--all", "--full-history", "--name-only", "--format="],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=True
        )
        committed_files = set(res.stdout.splitlines())
        for f in committed_files:
            if ".env" in f and not f.endswith(".example") and not f.endswith(".template"):
                findings.append({
                    "severity": "CRITICAL",
                    "file": f,
                    "message": f"Historical trace of '{f}' detected in Git commit logs. The file was committed previously."
                })
    except subprocess.CalledProcessError as e:
        logging.warning(f"Git command failed: {e}. Skipping git history check.")
    except FileNotFoundError:
        logging.warning("git executable not found. Skipping git history check.")

def scan_codebase_for_secrets(repo_path, findings):
    """Scans all non-ignored codebase files for hardcoded secrets matching patterns."""
    exclude_dirs = {".git", "node_modules", "dist", ".tmp"}
    
    for root, dirs, files in os.walk(repo_path):
        # Modify dirs in-place to exclude unwanted directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, repo_path)
            
            # Skip checking .env itself and the security script to avoid false positives
            if rel_path == ".env" or rel_path == "execution/audit_env_security.py":
                continue
                
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        for label, pattern in SECRET_PATTERNS.items():
                            match = pattern.search(line)
                            if match:
                                findings.append({
                                    "severity": "CRITICAL",
                                    "file": rel_path,
                                    "line": line_num,
                                    "message": f"Potential {label} hardcoded: '{match.group(0)[:6]}...'"
                                })
            except Exception as e:
                logging.debug(f"Could not read file {rel_path} for secret scan: {e}")

def run_security_audit(repo_path):
    """Executes checks on git index and committed code history to identify credentials issues."""
    logging.info(f"Targeting audit repository: {repo_path}")
    findings = []
    
    check_gitignore(repo_path, findings)
    check_tracked_files(repo_path, findings)
    check_git_history(repo_path, findings)
    scan_codebase_for_secrets(repo_path, findings)
    
    logging.info(f"Audit completed. Found {len(findings)} vulnerability issue(s):")
    for item in findings:
        line_info = f" (Line {item['line']})" if "line" in item else ""
        logging.warning(f" [%s] File: %s%s -> %s", item["severity"], item["file"], line_info, item["message"])
        
    report = {
        "metadata": {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "repo_scanned": repo_path
        },
        "issues": findings
    }
    return report

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parser = argparse.ArgumentParser(description="Scan project files and git logs for secrets exposure.")
    parser.add_argument("--repo-path", default=project_root, help="Root directory of the git repo.")
    args = parser.parse_args()

    try:
        report = run_security_audit(args.repo_path)
        report_file = os.path.join(project_root, ".tmp", "security_audit_report.json")
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        logging.info(f"Vulnerability report written to: {report_file}")
        
        # Exit code 1 if CRITICAL or HIGH findings exist
        has_critical = any(x["severity"] in ("CRITICAL", "HIGH") for x in report["issues"])
        return 1 if has_critical else 0
    except Exception as e:
        logging.exception(f"Unhandled error during security scan: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
