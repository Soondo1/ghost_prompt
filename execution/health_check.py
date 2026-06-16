"""
execution/health_check.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Execute comprehensive system health check pings across all modules and dependencies.
Inputs:  --url (base API URL), --env-file (credentials verification)
Outputs: JSON output representing health dashboard status, exit code.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import json
import time
import argparse
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"health_check_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def run_health_checks(base_url):
    """Performs checking operations for database, API server, and Google Gemini SDK."""
    health_url = f"{base_url.rstrip('/')}/health"
    logging.info(f"Starting health validation sequence against: {health_url}")
    
    start_time = time.time()
    try:
        response = requests.get(health_url, timeout=15)
        latency_ms = int((time.time() - start_time) * 1000)
        
        if response.status_code in [200, 500]:
            try:
                health_results = response.json()
            except ValueError:
                logging.error(f"Health endpoint returned non-JSON data: {response.text}")
                return False, {
                    "status": "unhealthy",
                    "components": {
                        "api_server": {"status": "UP", "latency_ms": latency_ms},
                        "response_parse": {"status": "FAILED", "error": "Invalid JSON response"}
                    }
                }
            
            logging.info("Health Check Dashboard Results:")
            logging.info(json.dumps(health_results, indent=2))
            
            # Script returns True only if status is "healthy"
            is_healthy = health_results.get("status") == "healthy"
            return is_healthy, health_results
        else:
            logging.error(f"Health check failed with HTTP status code {response.status_code}: {response.text}")
            return False, {
                "status": "unhealthy",
                "components": {
                    "api_server": {"status": "DOWN", "error": f"HTTP {response.status_code}", "latency_ms": latency_ms}
                }
            }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logging.error(f"Connection error to health endpoint: {e}")
        return False, {
            "status": "unhealthy",
            "components": {
                "api_server": {"status": "DOWN", "error": str(e), "latency_ms": latency_ms}
            }
        }

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parser = argparse.ArgumentParser(description="Check health and connectivity of application services.")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of server under test.")
    parser.add_argument("--env-file", default=os.path.join(project_root, ".env"), help="Path to .env file.")
    args = parser.parse_args()

    if os.path.exists(args.env_file):
        load_dotenv(args.env_file)
        
    try:
        success, results = run_health_checks(args.url)
        # Save results to .tmp
        health_out = os.path.join(project_root, ".tmp", "health_status.json")
        with open(health_out, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        logging.info(f"Health summary saved to: {health_out}")
        return 0 if success else 1
    except Exception as e:
        logging.exception(f"Unhandled error during health check: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
