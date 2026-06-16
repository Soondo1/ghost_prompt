"""
execution/package_extension.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Packages the compiled popup UI and the Chrome extension scripts into a deployable ZIP format.
Inputs:  --output (zip file path), --version (optional version string override)
Outputs: Zip file generated in .tmp/ directory, exit code.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import zipfile
import argparse
import logging
from datetime import datetime

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"package_extension_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def package_extension(output_path, project_root):
    """Creates a zip file containing the required Chrome Extension source files and assets."""
    logging.info(f"Target packaging file: {output_path}")
    
    # Required paths to check and add to ZIP, mapping to their respective zip-relative paths
    targets = [
        ("manifest.json", "manifest.json"),
        ("src/content.js", "src/content.js"),
        ("src/background.js", "src/background.js"),
        ("dist/popup", "dist/popup"),
        ("assets", "assets")
    ]
    
    # Ensure all directories/files exist
    for local_rel, zip_rel in targets:
        full_path = os.path.join(project_root, local_rel)
        if not os.path.exists(full_path):
            logging.error(f"Target path does not exist: {full_path}")
            return False

    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for local_rel, zip_rel in targets:
                full_path = os.path.join(project_root, local_rel)
                if os.path.isdir(full_path):
                    for root, dirs, files in os.walk(full_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            # Calculate the path inside the zip file
                            rel_path_in_dir = os.path.relpath(file_path, full_path)
                            zip_path = os.path.join(zip_rel, rel_path_in_dir).replace('\\', '/')
                            logging.info(f"Adding file: {file_path} as {zip_path}")
                            zipf.write(file_path, zip_path)
                else:
                    zip_path = zip_rel.replace('\\', '/')
                    logging.info(f"Adding file: {full_path} as {zip_path}")
                    zipf.write(full_path, zip_path)
                    
        logging.info(f"Successfully created zip payload at: {output_path}")
        return True
    except Exception as e:
        logging.error(f"Error packaging extension files: {e}")
        return False

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    default_output = os.path.join(project_root, ".tmp", "prompt-ghost-v1.0.0.zip")
    
    parser = argparse.ArgumentParser(description="Package Prompt Ghost extension for submission.")
    parser.add_argument("--output", default=default_output, help="Desired path for output ZIP file.")
    parser.add_argument("--ext-version", default="1.0.0", help="Extension version for file naming.")
    args = parser.parse_args()

    # Resolve output path based on version if default is used
    output_path = args.output
    if output_path == default_output and args.ext_version != "1.0.0":
        output_path = os.path.join(project_root, ".tmp", f"prompt-ghost-v{args.ext_version}.zip")
        
    try:
        success = package_extension(output_path, project_root)
        return 0 if success else 1
    except Exception as e:
        logging.exception(f"Unhandled exception during extension packaging: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
