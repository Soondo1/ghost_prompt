"""
execution/build_popup.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Build the popup UI via Vite and validate the output build artifacts.
Inputs:  None
Outputs: Built popup files in dist/popup/, exit code (0 on success, 1 on build failure/validation failure).
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import argparse
import logging
import subprocess
from datetime import datetime

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"build_popup_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def run_build():
    """Runs the npm build command to compile the React popup."""
    logging.info("Starting popup build process...")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    logging.info(f"Target build directory: {project_root}")
    
    try:
        # Run npm run build
        res = subprocess.run(
            ["npm", "run", "build"], 
            cwd=project_root, 
            capture_output=True, 
            text=True, 
            shell=True,
            check=True
        )
        logging.info("npm run build output:")
        logging.info(res.stdout)
        logging.info("Vite compilation completed successfully.")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"Build failed with exit code {e.returncode}")
        logging.error("Stdout:")
        logging.error(e.stdout)
        logging.error("Stderr:")
        logging.error(e.stderr)
        return False

def validate_output():
    """Validates that the output files have been built correctly."""
    logging.info("Validating build artifacts...")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dist_dir = os.path.join(project_root, "dist", "popup")
    
    if not os.path.exists(dist_dir):
        logging.error(f"Build output directory does not exist: {dist_dir}")
        return False
        
    html_path = os.path.join(dist_dir, "index.html")
    if not os.path.exists(html_path):
        logging.error(f"Expected index.html file not found at: {html_path}")
        return False
        
    assets_dir = os.path.join(dist_dir, "assets")
    if not os.path.exists(assets_dir) or not os.listdir(assets_dir):
        logging.error(f"Expected compiled assets directory not found or empty at: {assets_dir}")
        return False
        
    logging.info("Build artifacts validation passed.")
    return True

def main():
    parser = argparse.ArgumentParser(description="Build and validate Prompt Ghost popup React UI.")
    parser.add_argument("--dry-run", action="store_true", help="Execute in dry-run mode without running build commands.")
    args = parser.parse_args()

    if args.dry_run:
        logging.info("Dry run requested. No changes made.")
        return 0

    try:
        if run_build() and validate_output():
            logging.info("Build and validation completed successfully.")
            return 0
        else:
            logging.error("Build validation failed.")
            return 1
    except Exception as e:
        logging.exception(f"Unhandled error during build pipeline: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
