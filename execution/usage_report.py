"""
execution/usage_report.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Query usage_stats and generate daily/weekly report using Supabase SDK
Inputs:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables, CLI arg --days
Outputs: JSON report in .tmp/usage_report_{date}.json
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
    parser = argparse.ArgumentParser(description="Generate usage reports from Supabase.")
    parser.add_argument(
        "--days",
        type=int,
        help="Number of past days to report (default: 7)",
        default=7
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
        logger.info(f"Fetching usage stats for the past {args.days} days...")
        
        # Calculate date threshold
        threshold_date = (datetime.date.today() - datetime.timedelta(days=args.days)).isoformat()

        response = supabase.table("usage_stats")\
            .select("date, optimize_count, transform_count, tokens_used, cached_hits")\
            .gte("date", threshold_date)\
            .order("date", desc=True)\
            .execute()

        rows = response.data

        # Aggregate totals
        total_optimize = sum(int(row["optimize_count"] or 0) for row in rows)
        total_transform = sum(int(row["transform_count"] or 0) for row in rows)
        total_tokens = sum(int(row["tokens_used"] or 0) for row in rows)
        total_cached = sum(int(row["cached_hits"] or 0) for row in rows)

        logger.info(f"Retrieved {len(rows)} days of usage data.")

        # Ensure .tmp/ exists
        tmp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".tmp")
        os.makedirs(tmp_dir, exist_ok=True)

        today_str = datetime.date.today().isoformat()
        report_filename = f"usage_report_{today_str}.json"
        report_filepath = os.path.join(tmp_dir, report_filename)

        final_report = {
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "days_analyzed": args.days,
            "summary": {
                "total_optimize": total_optimize,
                "total_transform": total_transform,
                "total_tokens": total_tokens,
                "total_cached": total_cached
            },
            "daily_stats": rows
        }

        with open(report_filepath, 'w', encoding='utf-8') as f:
            json.dump(final_report, f, indent=2)

        logger.info(f"Usage report saved successfully to {report_filepath}")
    except Exception as e:
        logger.error(f"Failed to generate usage report: {e}")
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
