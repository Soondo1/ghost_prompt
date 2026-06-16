"""
execution/deploy_vercel.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Deploy the Express server backend to Vercel using the Vercel CLI and perform a remote health check verification.
Inputs:  --env (production | preview), --token (optional Vercel API token)
Outputs: Prints the deployment URL and health status. Logs details to log files.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import argparse
import logging
import subprocess
import requests
from datetime import datetime
from dotenv import load_dotenv

# Configure logging
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".tmp", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = os.path.join(LOG_DIR, f"deploy_vercel_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

# Load environment vars
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(project_root, ".env"))

def deploy(environment, token=None):
    """Executes the Vercel deploy CLI command and extracts deployment url."""
    logging.info(f"Initiating Vercel deployment for environment: {environment}...")
    
    # Construct vercel command
    vercel_cmd = ["npx", "vercel", "--yes"]
    if environment == "production":
        vercel_cmd.append("--prod")
        
    vercel_token = token or os.environ.get("VERCEL_TOKEN")
    if vercel_token:
        vercel_cmd.extend(["--token", vercel_token])
        
    logging.info(f"Running command: {' '.join(vercel_cmd)}")
    
    try:
        res = subprocess.run(
            vercel_cmd,
            cwd=project_root,
            capture_output=True,
            text=True,
            shell=True,
            check=True
        )
        
        logging.info("Vercel CLI command execution completed successfully.")
        
        # Search output for the deployment URL
        combined_output = res.stdout + "\n" + res.stderr
        url = None
        
        for line in combined_output.splitlines():
            line_str = line.strip()
            if line_str.startswith("https://") and "vercel.app" in line_str:
                url = line_str.split()[0]
                break
                
        if not url:
            # Fallback parse search
            for line in combined_output.splitlines():
                if "inspect" in line.lower():
                    continue
                words = line.split()
                for word in words:
                    if word.startswith("https://") and "vercel.app" in word:
                        url = word
                        break
                if url:
                    break
                    
        if not url:
            # Fallback to last line starting with https://
            lines = [l.strip() for l in combined_output.splitlines() if l.strip().startswith("https://")]
            if lines:
                url = lines[-1]
                
        if not url:
            logging.error("Failed to extract deployment URL from Vercel output.")
            logging.debug(f"Combined Output:\n{combined_output}")
            return None
            
        logging.info(f"Deployment successful! Target URL: {url}")
        return url
        
    except subprocess.CalledProcessError as e:
        logging.error(f"Vercel deployment failed with exit code {e.returncode}")
        logging.error(f"Stdout:\n{e.stdout}")
        logging.error(f"Stderr:\n{e.stderr}")
        logging.error("Please ensure you are authenticated by running 'npx vercel login' or set VERCEL_TOKEN in your environment.")
        return None
    except Exception as e:
        logging.exception(f"Error starting Vercel deployment: {e}")
        return None

def verify_health(url):
    """Hits the deployment URL to verify it's up and responsive."""
    health_url = f"{url.rstrip('/')}/health"
    logging.info(f"Verifying health of server at: {health_url}")
    
    try:
        response = requests.get(health_url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                logging.info("Remote server health check PASSED. All services are functional.")
                return True
            else:
                logging.warning(f"Remote server reported degraded health: {data}")
                # Degraded is still UP, so treat as warning success
                return True
        elif response.status_code == 500:
            logging.error(f"Remote server health check failed (HTTP 500): {response.text}")
            return False
        else:
            logging.error(f"Remote server health check failed with status code {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logging.error(f"Failed to connect to deployed server: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Deploy API server to Vercel and verify connectivity.")
    parser.add_argument("--env", choices=["production", "preview"], default="preview", help="Target Vercel environment.")
    parser.add_argument("--token", help="Vercel authorization token.")
    args = parser.parse_args()

    try:
        url = deploy(args.env, args.token)
        if not url:
            return 1
            
        if verify_health(url):
            logging.info("Vercel deployment and health verification finished successfully.")
            return 0
        else:
            logging.error("Vercel deployment completed, but health verification failed.")
            return 1
    except Exception as e:
        logging.exception(f"Unhandled error during Vercel deployment pipeline: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
