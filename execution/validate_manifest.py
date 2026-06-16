"""
execution/validate_manifest.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Lint and validate manifest.json for Manifest V3 (MV3) compliance and file existence.
Inputs:  Optional --manifest path (defaults to root manifest.json)
Outputs: Validation status, parsed details, error logs, exit code.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"validate_manifest_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def validate_manifest(manifest_path):
    """Parses and validates manifest.json for MV3 compatibility and asset files existence."""
    logging.info(f"Opening manifest file at: {manifest_path}")
    
    if not os.path.exists(manifest_path):
        logging.error(f"Manifest file does not exist: {manifest_path}")
        return False
        
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        logging.error(f"Manifest is not valid JSON: {e}")
        return False
        
    errors = []
    warnings = []
    project_root = os.path.dirname(os.path.abspath(manifest_path))
    
    # 1. Manifest Version Check
    manifest_version = data.get("manifest_version")
    if manifest_version != 3:
        errors.append(f"manifest_version must be 3, found {manifest_version}")
        
    # 2. Key Required Fields
    required_fields = ["name", "version", "description", "manifest_version"]
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required root field: '{field}'")
            
    # 3. Service Worker MV3 check & file existence check
    background = data.get("background", {})
    if background:
        if "scripts" in background:
            errors.append("MV3 background scripts must use 'service_worker', not 'scripts'")
        if "service_worker" not in background:
            errors.append("MV3 background configuration missing 'service_worker' key")
        else:
            sw_path = os.path.join(project_root, background["service_worker"])
            if not os.path.exists(sw_path):
                errors.append(f"Registered service worker file does not exist: {background['service_worker']}")
            else:
                logging.info(f"Verified service worker exists: {background['service_worker']}")
            
    # 4. Action vs Browser Action
    if "browser_action" in data:
        errors.append("MV3 must use 'action' instead of 'browser_action'")
    
    action = data.get("action", {})
    if action:
        # Check default_popup file existence
        popup_path = action.get("default_popup")
        if popup_path:
            full_popup_path = os.path.join(project_root, popup_path)
            if not os.path.exists(full_popup_path):
                warnings.append(f"Popup path in manifest does not exist (may need build first): {popup_path}")
            else:
                logging.info(f"Verified popup file exists: {popup_path}")
        
        # Check default_icon under action
        default_icons = action.get("default_icon", {})
        if isinstance(default_icons, dict):
            for size, path in default_icons.items():
                full_icon_path = os.path.join(project_root, path)
                if not os.path.exists(full_icon_path):
                    errors.append(f"Action default_icon file not found: {path} (size: {size})")
                else:
                    logging.info(f"Verified action default_icon exists: {path} (size: {size})")
                    
    # Check root level icons
    icons = data.get("icons", {})
    if isinstance(icons, dict):
        for size, path in icons.items():
            full_icon_path = os.path.join(project_root, path)
            if not os.path.exists(full_icon_path):
                errors.append(f"Root icon file not found: {path} (size: {size})")
            else:
                logging.info(f"Verified root icon exists: {path} (size: {size})")
        
    # 5. Content Security Policy (CSP) format
    csp = data.get("content_security_policy", {})
    if isinstance(csp, str):
        errors.append("MV3 content_security_policy must be an object, not a string")
        
    # 6. Content Scripts check & file existence
    content_scripts = data.get("content_scripts", [])
    if isinstance(content_scripts, list):
        for idx, cs in enumerate(content_scripts):
            js_files = cs.get("js", [])
            for js_file in js_files:
                full_js_path = os.path.join(project_root, js_file)
                if not os.path.exists(full_js_path):
                    errors.append(f"Content script file at index {idx} does not exist: {js_file}")
                else:
                    logging.info(f"Verified content script file exists: {js_file}")
                    
    # Report results
    if warnings:
        logging.warning(f"Manifest validation warnings ({len(warnings)}):")
        for warn in warnings:
            logging.warning(f" - {warn}")
            
    if errors:
        logging.error(f"Manifest validation failed with {len(errors)} error(s):")
        for err in errors:
            logging.error(f" - {err}")
        return False
        
    logging.info("manifest.json validation succeeded! MV3 compliant.")
    return True

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    default_manifest = os.path.join(project_root, "manifest.json")
    
    parser = argparse.ArgumentParser(description="Validate Chrome Extension manifest.json for MV3 compliance.")
    parser.add_argument("--manifest", default=default_manifest, help="Path to manifest.json file to validate.")
    args = parser.parse_args()

    try:
        success = validate_manifest(args.manifest)
        return 0 if success else 1
    except Exception as e:
        logging.exception(f"Unhandled exception during manifest validation: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
