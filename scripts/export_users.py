#!/usr/bin/env python3
"""Export registered users to a text file."""

import argparse
import os
import sys
from datetime import datetime
from scripts.core import get_db_connection


def export_users(output_path: str | None, since: str | None, admin_only: bool) -> None:
    conn = get_db_connection()
    cur = conn.cursor()

    conditions = []
    params = []

    if since:
        conditions.append("created_at >= %s")
        params.append(since)
    if admin_only:
        conditions.append("is_admin = TRUE")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cur.execute(
        f"SELECT id, name, email, is_admin, created_at FROM users {where} ORDER BY created_at",
        params,
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not output_path:
        output_path = f"users_export_{datetime.now().strftime('%Y%m%d')}.txt"

    col_widths = [4, 40, 40, 8, 26]
    header = (
        f"{'ID':<{col_widths[0]}}  "
        f"{'Name':<{col_widths[1]}}  "
        f"{'Email':<{col_widths[2]}}  "
        f"{'Admin':<{col_widths[3]}}  "
        f"{'Created At':<{col_widths[4]}}"
    )
    separator = "-" * len(header)

    lines = [
        f"VocaRank User Export — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Total users: {len(rows)}",
        separator,
        header,
        separator,
    ]
    for row in rows:
        uid, name, email, is_admin, created_at = row
        lines.append(
            f"{str(uid):<{col_widths[0]}}  "
            f"{(name or ''):<{col_widths[1]}}  "
            f"{(email or ''):<{col_widths[2]}}  "
            f"{'yes' if is_admin else 'no':<{col_widths[3]}}  "
            f"{str(created_at):<{col_widths[4]}}"
        )
    lines.append(separator)

    content = "\n".join(lines) + "\n"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Exported {len(rows)} users to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export VocaRank registered users to a text file.")
    parser.add_argument("-o", "--output", help="Output file path (default: users_export_YYYYMMDD.txt)")
    parser.add_argument("--since", metavar="DATE", help="Only include users created on or after this date (YYYY-MM-DD)")
    parser.add_argument("--admin-only", action="store_true", help="Only include admin users")
    args = parser.parse_args()

    export_users(args.output, args.since, args.admin_only)


if __name__ == "__main__":
    main()
