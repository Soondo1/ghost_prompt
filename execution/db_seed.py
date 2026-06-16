"""
execution/db_seed.py
PFA Layer 3 — Deterministic Execution Script

Purpose: Seed Supabase database with dev user, cache entries, and usage stats
Inputs:  DATABASE_URL environment variable or CLI argument --database-url
Outputs: Rows inserted status, exit code
Author:  Orchestration Engine
Created: 2026-06-17
Updated: 2026-06-17
"""

import os
import sys
import argparse
import logging
import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="Seed Supabase database with test data.")
    parser.add_argument(
        "--database-url",
        help="PostgreSQL Connection URI (overrides DATABASE_URL env var)",
        default=None
    )
    return parser.parse_args()

def main():
    load_dotenv()
    args = parse_args()
    db_url = args.database_url or os.getenv("DATABASE_URL")

    if not db_url:
        logger.error("DATABASE_URL is not set. Please set it in .env or provide --database-url.")
        sys.exit(1)

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    try:
        import pg8000.dbapi
    except ImportError:
        logger.error("pg8000 library is not installed. Please run pip install pg8000 first.")
        sys.exit(1)

    try:
        url = urlparse(db_url)
        username = url.username
        password = url.password
        database = url.path[1:]
        hostname = url.hostname
        port = url.port or 5432
    except Exception as e:
        logger.error(f"Failed to parse database connection string: {e}")
        sys.exit(2)

    logger.info(f"Connecting to database at {hostname}...")
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

    test_user_id = 'd0000000-0000-0000-0000-000000000001'

    try:
        logger.info("Seeding test user into auth.users (triggers public.users insert)...")
        # Direct SQL injection to seed test auth user
        auth_seed_sql = """
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
          %s,
          'test@promptghost.com',
          '$2a$10$vI8A7.c.J/m9tWNu/L0PXeBvF1l/H14qW7Fq372h4m.b.3z963.8S', -- bcrypt of 'password123'
          NOW(),
          'authenticated',
          'authenticated',
          '{"provider": "email", "providers": ["email"]}',
          '{"display_name": "Test User"}',
          NOW(),
          NOW()
        ) ON CONFLICT (id) DO NOTHING;
        """
        cursor.execute(auth_seed_sql, [test_user_id])
        logger.info("Test user seeded successfully.")

        # Let's verify public.users has it
        cursor.execute("SELECT id, email FROM public.users WHERE id = %s", [test_user_id])
        user_row = cursor.fetchone()
        if user_row:
            logger.info(f"Verified user profile exists in public.users: {user_row[1]}")
        else:
            logger.warning("User profile was not auto-inserted by trigger. Inserting manually...")
            cursor.execute(
                "INSERT INTO public.users (id, email, display_name) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING;",
                [test_user_id, 'test@promptghost.com', 'Test User']
            )

        logger.info("Seeding sample cache entries...")
        # Seed cache entries
        # cache_entries: prompt_hash, level, optimized_text, expires_at
        # We can seed a hashed version of "write a quick email"
        import hashlib
        # prompt: "write a quick email" + concise
        hash_val = hashlib.sha256(b"write a quick email:concise").hexdigest()
        expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
        
        cursor.execute("""
        INSERT INTO public.cache_entries (prompt_hash, level, optimized_text, expires_at)
        VALUES (%s, 'concise', 'Draft a brief, direct email summarizing the status update.', %s)
        ON CONFLICT (prompt_hash) DO NOTHING;
        """, [hash_val, expires])
        
        logger.info("Sample cache entry seeded successfully.")

        logger.info("Seeding initial prompt history...")
        cursor.execute("""
        INSERT INTO public.prompt_history (user_id, original_prompt, optimized_prompt, optimization_level, endpoint, platform, was_accepted)
        VALUES (%s, 'write a quick email', 'Draft a brief, direct email summarizing the status update.', 'concise', 'optimize', 'chatgpt.com', true)
        """, [test_user_id])

        logger.info("Seeding initial usage stats...")
        today = datetime.date.today()
        cursor.execute("""
        INSERT INTO public.usage_stats (user_id, date, optimize_count, transform_count, tokens_used, cached_hits)
        VALUES (%s, %s, 1, 0, 42, 1)
        ON CONFLICT (user_id, date) DO NOTHING;
        """, [test_user_id, today])

        logger.info("Database seeding completed successfully!")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        conn.close()
        sys.exit(1)

    conn.close()
    sys.exit(0)

if __name__ == "__main__":
    main()
