"""
execution/error_analysis.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Query error_log and generate error report/summary using Supabase SDK
Inputs:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables, CLI arg --days
Outputs: JSON report in .tmp/error_report_{date}.json
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import json
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
    parser = argparse.ArgumentParser(description="Generate error reports from Supabase.")
    parser.add_argument(
        "--days",
        type=int,
        help="Number of past days to analyze (default: 7)",
        default=7
    )
    return parser.parse_args()

def main():
    load_dotenv()
    
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
        logger.info(f"Fetching error logs for the past {args.days if 'args' in locals() else 7} days...")
        args = parse_args()
        
        # Calculate date threshold
        threshold_date = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=args.days)).isoformat()

        # Query 1: Get all errors in the date range
        response = supabase.table("error_log")\
            .select("id, endpoint, error_type, error_message, stack_trace, request_payload, created_at")\
            .gte("created_at", threshold_date)\
            .order("created_at", desc=True)\
            .execute()

        rows = response.data

        # Aggregate errors by endpoint and type
        agg_map = {}
        for row in rows:
            key = (row["endpoint"], row["error_type"])
            agg_map[key] = agg_map.get(key, 0) + 1

        aggregated_errors = [
            {"endpoint": ep, "error_type": et, "count": count}
            for (ep, et), count in sorted(agg_map.items(), key=lambda item: item[1], reverse=True)
        ]

        recent_errors = rows[:50]  # limit to 50 detailed errors

        # Ensure .tmp/ exists
        tmp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".tmp")
        os.makedirs(tmp_dir, exist_ok=True)

        today_str = datetime.date.today().isoformat()
        report_filename = f"error_report_{today_str}.json"
        report_filepath = os.path.join(tmp_dir, report_filename)

        final_report = {
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "days_analyzed": args.days,
            "total_errors": len(rows),
            "summary_by_endpoint_and_type": aggregated_errors,
            "recent_errors_detail": recent_errors
        }

        with open(report_filepath, 'w', encoding='utf-8') as f:
            json.dump(final_report, f, indent=2)

        logger.info(f"Error analysis report saved successfully to {report_filepath}")
        logger.info(f"Total errors detected: {len(rows)}")
    except Exception as e:
        logger.error(f"Failed to generate error report: {e}")
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
