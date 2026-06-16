"""
execution/db_migrate.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Run SQL migrations against Supabase
Inputs:  DATABASE_URL environment variable or CLI argument --database-url
Outputs: Migration status log, exit code
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import argparse
import logging
from urllib.parse import urlparse
from dotenv import load_dotenv

# Set up logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="Run SQL migrations against Supabase PostgreSQL database.")
    parser.add_argument(
        "--database-url",
        help="PostgreSQL Connection URI (overrides DATABASE_URL env var)",
        default=None
    )
    return parser.parse_args()

def main():
    # Load environment variables from .env in the parent/root directory
    # Since this script runs in project root, Cwd will be c:\dev\masterprompt
    load_dotenv()

    args = parse_args()
    db_url = args.database_url or os.getenv("DATABASE_URL")

    if not db_url:
        logger.error("DATABASE_URL is not set. Please set it in .env or provide --database-url.")
        sys.exit(1)

    # Convert postgres:// to postgresql:// if needed for libraries
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    try:
        import pg8000.dbapi
    except ImportError:
        logger.error("pg8000 library is not installed. Please run pip install pg8000 first.")
        sys.exit(1)

    logger.info("Parsing connection string...")
    try:
        url = urlparse(db_url)
        username = url.username
        password = url.password
        database = url.path[1:]  # Remove leading slash
        hostname = url.hostname
        port = url.port or 5432
    except Exception as e:
        logger.error(f"Failed to parse database connection string: {e}")
        sys.exit(2)

    logger.info(f"Connecting to database at {hostname}:{port}/{database}...")
    try:
        conn = pg8000.dbapi.connect(
            user=username,
            password=password,
            host=hostname,
            port=port,
            database=database
        )
        conn.autocommit = True
        cursor = conn.cursor()
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        sys.exit(2)

    logger.info("Successfully connected to Supabase Database.")

    # Locate migrations directory
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    if not os.path.isdir(migrations_dir):
        logger.error(f"Migrations directory not found at: {migrations_dir}")
        conn.close()
        sys.exit(1)

    # Get sorted migration files
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])
    if not migration_files:
        logger.warn("No migration files found in execution/migrations/.")
        conn.close()
        sys.exit(0)

    logger.info(f"Found {len(migration_files)} migration file(s) to execute.")

    for filename in migration_files:
        filepath = os.path.join(migrations_dir, filename)
        logger.info(f"Running migration: {filename}...")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                sql = f.read()

            # Execute migration content
            cursor.execute(sql)
            logger.info(f"Migration {filename} completed successfully.")
        except Exception as e:
            logger.error(f"Migration {filename} failed: {e}")
            conn.close()
            sys.exit(1)

    conn.close()
    logger.info("All migrations completed successfully!")
    sys.exit(0)

if __name__ == "__main__":
    main()
