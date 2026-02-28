#!/bin/bash

# usage:
# ./database_backup.sh --daily-dump <path>
# ./database_backup.sh --dump <path>
# ./database_backup.sh --check-total-size


# Navigate to script directory to ensure we can read .env if running via cron
cd "$(dirname "$0")"

# Load variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found in $(pwd)"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in .env"
    exit 1
fi

USAGE="Usage: $0 [--daily-dump <path>] [--dump <path>] [--check-total-size]"

if [ $# -eq 0 ]; then
    echo "$USAGE"
    exit 1
fi

case $1 in
    --daily-dump)
        if [ -z "$2" ]; then
            echo "Error: Path required. Usage: $0 --daily-dump <path>"
            exit 1
        fi
        BACKUP_DIR="$2"
        mkdir -p "$BACKUP_DIR"
        
        # Format: vocarank_backup_YYYYMMDD.dump
        DATE_STR=$(date +%Y%m%d)
        FILE_PATH="$BACKUP_DIR/vocarank_backup_$DATE_STR.dump"
        
        echo "Creating daily dump at $FILE_PATH..."
        pg_dump "$DATABASE_URL" -F c -f "$FILE_PATH"
        
        if [ $? -eq 0 ]; then
            echo "Daily dump completed successfully."
            
            # Clean up dumps older than 14 days in that directory
            echo "Cleaning up dumps older than 14 days in $BACKUP_DIR..."
            find "$BACKUP_DIR" -maxdepth 1 -name "vocarank_backup_*.dump" -type f -mtime +14 -exec rm -f {} \;
            echo "Cleanup complete."
        else
            echo "Error: pg_dump failed!"
            exit 1
        fi
        ;;
        
    --dump)
        if [ -z "$2" ]; then
            echo "Error: Path required. Usage: $0 --dump <path>"
            exit 1
        fi
        BACKUP_DIR="$2"
        mkdir -p "$BACKUP_DIR"
        
        # Format: vocarank_backup_YYYYMMDDHHMMSS.dump
        DATETIME_STR=$(date +%Y%m%d%H%M%S)
        FILE_PATH="$BACKUP_DIR/vocarank_backup_$DATETIME_STR.dump"
        
        echo "Creating manual dump at $FILE_PATH..."
        pg_dump "$DATABASE_URL" -F c -f "$FILE_PATH"
        
        if [ $? -eq 0 ]; then
            echo "Manual dump completed successfully."
        else
            echo "Error: pg_dump failed!"
            exit 1
        fi
        ;;
        
    --check-total-size)
        echo "Checking total database size..."
        # Query PostgreSQL for the string representation of current database's size
        # Use -t to avoid printing column headers, and xargs to strip whitespace
        SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
        
        if [ $? -eq 0 ]; then
            echo "Current Database Size: $SIZE"
        else
            echo "Error: Failed to query database size."
            exit 1
        fi
        ;;
        
    *)
        echo "Unknown option: $1"
        echo "$USAGE"
        exit 1
        ;;
esac
