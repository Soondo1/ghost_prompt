"""
execution/test_auth_flow.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Validate the end-to-end authentication lifecycle flow (signup, login, authenticated route access, token refresh).
Inputs:  --url (base API URL)
Outputs: Detailed steps statuses, access tokens generated, exit code.
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
log_file = os.path.join(LOG_DIR, f"test_auth_flow_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)

def run_auth_flow_test(base_url):
    """Executes step-by-step verification of auth endpoints."""
    logging.info(f"Targeting server: {base_url}")
    
    email = f"test_auth_{int(time.time())}@promptghost.com"
    password = "password123"
    user_id = None
    
    try:
        # Step 1: Signup
        logging.info("Step 1: Testing signup via /auth/signup...")
        signup_res = requests.post(
            f"{base_url}/auth/signup", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if signup_res.status_code != 201:
            logging.error(f"Signup failed (status code {signup_res.status_code}): {signup_res.text}")
            return False
        
        signup_data = signup_res.json()
        user_id = signup_data.get("user", {}).get("id")
        logging.info(f"Step 1 PASSED: Account created successfully. User ID: {user_id}")
        
        # Step 2: Login
        logging.info("Step 2: Testing login via /auth/login...")
        login_res = requests.post(
            f"{base_url}/auth/login", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if login_res.status_code != 200:
            logging.error(f"Login failed (status code {login_res.status_code}): {login_res.text}")
            return False
        
        login_data = login_res.json()
        access_token = login_data.get("access_token")
        refresh_token = login_data.get("refresh_token")
        
        if not access_token or not refresh_token:
            logging.error("Login response missing tokens.")
            return False
            
        logging.info("Step 2 PASSED: Tokens returned successfully.")
        
        # Step 3: Access Protected Route
        logging.info("Step 3: Accessing /optimize with valid Bearer JWT token...")
        headers = {"Authorization": f"Bearer {access_token}"}
        opt_res = requests.post(
            f"{base_url}/optimize", 
            json={"prompt": "write a quick email", "level": "concise"}, 
            headers=headers,
            timeout=10
        )
        if opt_res.status_code != 200:
            logging.error(f"Access to protected route failed (status code {opt_res.status_code}): {opt_res.text}")
            return False
            
        opt_data = opt_res.json()
        if "optimized" not in opt_data or "id" not in opt_data:
            logging.error(f"Protected route response format invalid: {opt_data}")
            return False
            
        logging.info("Step 3 PASSED: Response returned HTTP 200 and optimization result.")
        
        # Step 4: Token Refresh
        logging.info("Step 4: Testing token refresh flow...")
        refresh_res = requests.post(
            f"{base_url}/auth/refresh", 
            json={"refresh_token": refresh_token}, 
            timeout=10
        )
        if refresh_res.status_code != 200:
            logging.error(f"Token refresh failed (status code {refresh_res.status_code}): {refresh_res.text}")
            return False
            
        refresh_data = refresh_res.json()
        new_access_token = refresh_data.get("access_token")
        new_refresh_token = refresh_data.get("refresh_token")
        
        if not new_access_token or not new_refresh_token:
            logging.error("Refresh response missing tokens.")
            return False
            
        logging.info("Step 4 PASSED: New tokens generated successfully.")
        
        # Verify access with new token
        logging.info("Verifying access with new token...")
        headers_new = {"Authorization": f"Bearer {new_access_token}"}
        opt_res_new = requests.post(
            f"{base_url}/optimize", 
            json={"prompt": "write a quick email", "level": "concise"}, 
            headers=headers_new,
            timeout=10
        )
        if opt_res_new.status_code != 200:
            logging.error("Access with refreshed token failed.")
            return False
        
        logging.info("Refreshed token access verification PASSED.")
        return True

    except Exception as e:
        logging.exception(f"Exception during auth flow test execution: {e}")
        return False
        
    finally:
        # Step 5: Cleanup test user from Supabase Auth
        if user_id:
            logging.info(f"Cleaning up: Deleting test user {user_id}...")
            supabase_url = os.environ.get("SUPABASE_URL")
            service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            
            if supabase_url and service_key:
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
            else:
                logging.warning("Skipped cleanup: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.")

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parser = argparse.ArgumentParser(description="Test system authentication and tokens workflow.")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of server.")
    parser.add_argument("--env-file", default=os.path.join(project_root, ".env"), help="Path to .env file.")
    args = parser.parse_args()

    if os.path.exists(args.env_file):
        load_dotenv(args.env_file)
        
    try:
        success = run_auth_flow_test(args.url)
        return 0 if success else 1
    except Exception as e:
        logging.exception(f"Unhandled exception during authentication flow test: {e}")
        return 2

if __name__ == "__main__":
    sys.exit(main())
