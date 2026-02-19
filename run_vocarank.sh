#!/bin/bash

# VocaRank Cron Wrapper Script
# Usage: 
#   ./run_vocarank.sh update           (Runs update_db.py)
#   ./run_vocarank.sh views all        (Runs fetch_views.py --mode all)
#   ./run_vocarank.sh views popular    (Runs fetch_views.py --mode popular)

# Navigate to the script's directory (VocaRank root)
cd "$(dirname "$0")"

# Create logs directory if it doesn't exist
mkdir -p logs

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
LOG_FILE="logs/cron.log"

if [ "$1" == "update" ]; then
    echo "[$TIMESTAMP] [START] update_db.py" >> "$LOG_FILE"
    /usr/bin/python3 src/update_db.py >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "[$TIMESTAMP] [END] update_db.py (Exit Code: $EXIT_CODE)" >> "$LOG_FILE"

elif [ "$1" == "views" ]; then
    MODE=$2
    if [ -z "$MODE" ]; then
        MODE="all"
    fi
    echo "[$TIMESTAMP] [START] fetch_views.py --mode $MODE" >> "$LOG_FILE"
    /usr/bin/python3 src/fetch_views.py --mode "$MODE" >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "[$TIMESTAMP] [END] fetch_views.py --mode $MODE (Exit Code: $EXIT_CODE)" >> "$LOG_FILE"

elif [ "$1" == "update-artists" ]; then
    shift # Removal "update-artists" from args
    echo "[$TIMESTAMP] [START] update_artists.py $*" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u src/update_artists.py "$@" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    echo "[$TIMESTAMP] [END] update_artists.py (Exit Code: $EXIT_CODE)" | tee -a "$LOG_FILE"

else
    echo "Usage: $0 {update|views|update-artists} [args...]"
    exit 1
fi
