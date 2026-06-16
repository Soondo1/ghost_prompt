"""
execution/test_rate_limiter.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Test server-side rate limits by sending a burst of requests and verifying 429 responses.
Inputs:  --url (base API URL), --burst-count (requests to send, default: 55), --token (test credentials)
Outputs: List of response status codes, success/failure status, exit code.
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
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
log_file = os.path.join(LOG_DIR, f"test_rate_limiter_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def run_rate_limit_test(base_url, burst_count):
    """Sends multiple requests in rapid succession to trigger the rate limiter."""
    logging.info(f"Initiating rate-limiter check against: {base_url}")
    
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not service_key:
        logging.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment. Cannot run live test.")
        return False
        
    email = f"test_rate_{int(time.time())}@promptghost.com"
    password = "password123"
    user_id = None
    
    try:
        # Step 1: Create a test user
        logging.info("Creating a temporary test user...")
        signup_res = requests.post(
            f"{base_url}/auth/signup", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if signup_res.status_code != 201:
            logging.error(f"Failed to create test user: {signup_res.text}")
            return False
            
        signup_data = signup_res.json()
        user_id = signup_data.get("user", {}).get("id")
        
        # Step 2: Login to get session tokens
        logging.info("Logging in...")
        login_res = requests.post(
            f"{base_url}/auth/login", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if login_res.status_code != 200:
            logging.error(f"Failed to log in: {login_res.text}")
            return False
            
        login_data = login_res.json()
        access_token = login_data.get("access_token")
        
        # Step 3: Set user's daily_limit to 3 via Supabase REST API (service role bypass)
        logging.info("Setting test user daily_limit to 3 via Supabase REST API...")
        headers_db = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        patch_url = f"{supabase_url}/rest/v1/users?id=eq.{user_id}"
        patch_res = requests.patch(patch_url, headers=headers_db, json={"daily_limit": 3}, timeout=10)
        if patch_res.status_code not in [200, 204]:
            logging.error(f"Failed to update daily_limit: {patch_res.status_code} - {patch_res.text}")
            return False
            
        logging.info("User daily limit updated successfully.")

        # Step 4: Make 4 requests to /optimize and check status codes
        headers_opt = {"Authorization": f"Bearer {access_token}"}
        status_codes = []
        
        logging.info("Sending 4 requests in sequence to /optimize...")
        for i in range(1, 5):
            logging.info(f"Sending request #{i}...")
            payload = {"prompt": "write a quick email", "level": "concise"}
            res = requests.post(f"{base_url}/optimize", json=payload, headers=headers_opt, timeout=10)
            status_codes.append(res.status_code)
            logging.info(f"Request #{i} status code: {res.status_code}")
            
        # First 3 should be 200, 4th should be 429
        logging.info(f"Status codes recorded: {status_codes}")
        if status_codes[:3] == [200, 200, 200] and status_codes[3] == 429:
            logging.info("Success! Rate limiter correctly triggered and blocked requests over limit (HTTP 429).")
            return True
        else:
            logging.error("Rate limiter test failed: incorrect status code sequence.")
            return False

    except Exception as e:
        logging.exception(f"Unhandled exception during rate limit testing: {e}")
        return False
        
    finally:
        # Clean up: delete test user
        if user_id:
            logging.info(f"Cleaning up: Deleting test user {user_id}...")
            cleanup_headers = {
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key
            }
            cleanup_url = f"{supabase_url}/auth/v1/admin/users/{user_id}"
            try:
                cleanup_res = requests.delete(cleanup_url, headers=cleanup_headers, timeout=10)
                if cleanup_res.status_code == 200:
                    logging.info("Cleanup successful: Test user deleted from Supabase Auth.")
                else:
                    logging.warning(f"Cleanup warning (status code {cleanup_res.status_code}): {cleanup_res.text}")
            except Exception as cleanup_err:
                logging.warning(f"Failed to cleanup test user: {cleanup_err}")

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parser = argparse.ArgumentParser(description="Verify backend rate limiting middleware behavior.")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of server.")
    parser.add_argument("--burst-count", type=int, default=5, help="Number of concurrent requests to trigger rate limit.")
    parser.add_argument("--token", help="Bearer JWT authentication token.")
    parser.add_argument("--env-file", default=os.path.join(project_root, ".env"), help="Path to .env file.")
    args = parser.parse_args()

    if os.path.exists(args.env_file):
        load_dotenv(args.env_file)
        
    try:
        success = run_rate_limit_test(args.url, args.burst_count)
        return 0 if success else 1
    except Exception as e:
        logging.exception(f"Unhandled exception during rate limit testing: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
