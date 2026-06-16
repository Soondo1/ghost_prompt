"""
execution/db_cleanup.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Purge expired cache entries and old error logs using Supabase SDK
Inputs:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables, CLI arg --retention-days
Outputs: Count of deleted rows log, exit code
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import argparse
import logging
import datetime
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="Clean up database entries using Supabase SDK.")
    parser.add_argument(
        "--retention-days",
        type=int,
        help="Retention period in days for error logs (default: 30)",
        default=30
    )
    return parser.parse_args()

def main():
    load_dotenv()
    args = parse_args()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment.")
        sys.exit(1)

    try:
        from supabase import create_client, Client
    except ImportError:
        logger.error("supabase client is not installed. Please run: pip install supabase")
        sys.exit(1)

    logger.info("Initializing Supabase Client...")
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        sys.exit(2)

    try:
        # 1. Cleanup expired cache
        logger.info("Purging expired cache entries...")
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        response_cache = supabase.table("cache_entries")\
            .delete()\
            .lt("expires_at", now_str)\
            .execute()
        
        cache_deleted_count = len(response_cache.data) if response_cache.data else 0
        logger.info(f"Deleted {cache_deleted_count} expired cache entries.")

        # 2. Cleanup old error logs
        logger.info(f"Purging error logs older than {args.retention_days} days...")
        threshold_date = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=args.retention_days)).isoformat()
        
        response_logs = supabase.table("error_log")\
            .delete()\
            .lt("created_at", threshold_date)\
            .execute()
            
        logs_deleted_count = len(response_logs.data) if response_logs.data else 0
        logger.info(f"Deleted {logs_deleted_count} old error logs.")

        logger.info("Cleanup completed successfully.")
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
