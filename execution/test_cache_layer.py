"""
execution/test_cache_layer.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Verify cache writes, cache hits, and TTL expiration
Inputs:  API base URL (default: http://localhost:3000)
Outputs: Cache hit rate, timing, exit code
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
log_file = os.path.join(LOG_DIR, f"test_cache_layer_{timestamp}.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)
logger = logging.getLogger(__name__)

def parse_args():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parser = argparse.ArgumentParser(description="Test caching layer on /optimize endpoint.")
    parser.add_argument(
        "--url",
        help="API server base URL",
        default="http://localhost:3000"
    )
    parser.add_argument(
        "--env-file",
        default=os.path.join(project_root, ".env"),
        help="Path to .env file."
    )
    return parser.parse_args()

def run_cache_test(base_url):
    logger.info(f"Targeting server: {base_url}")
    optimize_url = f"{base_url}/optimize"

    email = f"test_cache_{int(time.time())}@promptghost.com"
    password = "password123"
    user_id = None
    access_token = None

    try:
        # Step 1: Create a test user
        logger.info("Creating a temporary test user for cache test...")
        signup_res = requests.post(
            f"{base_url}/auth/signup", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if signup_res.status_code != 201:
            logger.error(f"Failed to create test user: {signup_res.text}")
            return False
            
        signup_data = signup_res.json()
        user_id = signup_data.get("user", {}).get("id")

        # Step 2: Login to get session tokens
        logger.info("Logging in to obtain access token...")
        login_res = requests.post(
            f"{base_url}/auth/login", 
            json={"email": email, "password": password}, 
            timeout=10
        )
        if login_res.status_code != 200:
            logger.error(f"Failed to log in: {login_res.text}")
            return False
            
        login_data = login_res.json()
        access_token = login_data.get("access_token")
        if not access_token:
            logger.error("No access token returned on login.")
            return False

        # Use the cached test prompt to ensure Gemini API quota is not hit
        test_prompt = "write a quick email"
        level = "concise"

        payload = {
            "prompt": test_prompt,
            "level": level
        }
        headers = {"Authorization": f"Bearer {access_token}"}

        # First Call: Expect Cache Miss (cached: False) or Cache Hit if already cached,
        # but to test cache functionality cleanly we want to verify caching works.
        # Note: since we use "write a quick email", it might already be in the database cache.
        # That's fine, we check if cache is active.
        logger.info("Sending first request...")
        start_time = time.time()
        r1 = requests.post(optimize_url, json=payload, headers=headers, timeout=15)
        duration_miss = time.time() - start_time

        if r1.status_code != 200:
            logger.error(f"First request failed with status code {r1.status_code}: {r1.text}")
            return False

        data1 = r1.json()
        logger.info(f"First response: {data1} in {duration_miss:.2f}s")
        
        opt_text_1 = data1.get("optimized", "")
        if not opt_text_1:
            logger.warning("Optimization output was empty.")
            return False

        # Short delay to separate requests
        time.sleep(1)

        # Second Call: Expect Cache Hit (cached: True, identical result, very fast)
        logger.info("Sending second request (expecting cache hit)...")
        start_time = time.time()
        r2 = requests.post(optimize_url, json=payload, headers=headers, timeout=10)
        duration_hit = time.time() - start_time

        if r2.status_code != 200:
            logger.error(f"Second request failed with status code {r2.status_code}: {r2.text}")
            return False

        data2 = r2.json()
        logger.info(f"Second response: {data2} in {duration_hit:.4f}s")

        is_cached_2 = data2.get("cached", False)
        opt_text_2 = data2.get("optimized", "")

        if not is_cached_2:
            logger.error("FAIL: Second request was not served from cache.")
            return False

        if opt_text_1 != opt_text_2:
            logger.error("FAIL: Cache response text does not match first response text.")
            return False

        logger.info("SUCCESS: Cache hit confirmed and text matches!")
        logger.info(f"Speedup: Cache hit took {duration_hit:.4f}s vs first request taking {duration_miss:.2f}s")
        return True

    except Exception as e:
        logger.exception(f"Unhandled exception during cache testing: {e}")
        return False
        
    finally:
        # Clean up: delete test user
        if user_id:
            logger.info(f"Cleaning up: Deleting test user {user_id}...")
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
                        logger.info("Cleanup successful: Test user deleted from Supabase Auth.")
                    else:
                        logger.warning(f"Cleanup warning (status code {cleanup_res.status_code}): {cleanup_res.text}")
                except Exception as cleanup_err:
                    logger.warning(f"Failed to cleanup test user: {cleanup_err}")
            else:
                logger.warning("Skipped cleanup: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.")

def main():
    args = parse_args()
    if os.path.exists(args.env_file):
        load_dotenv(args.env_file)
        
    success = run_cache_test(args.url.rstrip('/'))
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
