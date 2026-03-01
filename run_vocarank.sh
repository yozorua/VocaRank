#!/bin/bash

# VocaRank Cron Wrapper Script (Rewritten 3-Script Architecture)
#   ./run_vocarank.sh fetch-new              (Runs fetch_new.py)
#   ./run_vocarank.sh update-existing --song <id> (Update a specific song)
#   ./run_vocarank.sh update-existing --songs 1000 (Rolling song refresh)
#   ./run_vocarank.sh update-existing --artists 1000 (Rolling artist refresh)
#   ./run_vocarank.sh views all              (Runs fetch_views.py --mode all)
#   ./run_vocarank.sh views popular          (Runs fetch_views.py --mode popular)
#   ./run_vocarank.sh views-song <id>        (Runs fetch_views.py for a specific song ID)
#   ./run_vocarank.sh rankings               (Pre-calculates heavy rankings to DB Cache)

# Navigate to the script's directory (VocaRank root)
cd "$(dirname "$0")"

# Create logs directory if it doesn't exist
mkdir -p logs

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
LOG_FILE="logs/cron.log"

if [ "$1" == "fetch-new" ]; then
    SECONDS=0
    echo "[$TIMESTAMP | START] scripts/fetch_new.py" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u -m scripts.fetch_new 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    H=$((SECONDS/3600))
    M=$(((SECONDS%3600)/60))
    S=$((SECONDS%60))
    echo "[$TIMESTAMP | END] scripts/fetch_new.py (Exit Code: $EXIT_CODE) - Time Elapsed: ${H}h ${M}m ${S}s" | tee -a "$LOG_FILE"

elif [ "$1" == "update-existing" ]; then
    SECONDS=0
    shift # Remove "update-existing" from args
    echo "[$TIMESTAMP | START] scripts/update_existing.py $*" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u -m scripts.update_existing "$@" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    H=$((SECONDS/3600))
    M=$(((SECONDS%3600)/60))
    S=$((SECONDS%60))
    echo "[$TIMESTAMP | END] scripts/update_existing.py (Exit Code: $EXIT_CODE) - Time Elapsed: ${H}h ${M}m ${S}s" | tee -a "$LOG_FILE"

elif [ "$1" == "views" ]; then
    SECONDS=0
    MODE=$2
    if [ -z "$MODE" ]; then
        MODE="all"
    fi
    echo "[$TIMESTAMP | START] scripts/fetch_views.py --mode $MODE" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u -m scripts.fetch_views --mode "$MODE" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    H=$((SECONDS/3600))
    M=$(((SECONDS%3600)/60))
    S=$((SECONDS%60))
    echo "[$TIMESTAMP | END] scripts/fetch_views.py --mode $MODE (Exit Code: $EXIT_CODE) - Time Elapsed: ${H}h ${M}m ${S}s" | tee -a "$LOG_FILE"

elif [ "$1" == "views-song" ]; then
    SECONDS=0
    SONG_ID=$2
    if [ -z "$SONG_ID" ]; then
        echo "Error: Song ID required. Usage: $0 views-song <id>"
        exit 1
    fi
    echo "[$TIMESTAMP | START] scripts/fetch_views.py --id $SONG_ID" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u -m scripts.fetch_views --id "$SONG_ID" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    H=$((SECONDS/3600))
    M=$(((SECONDS%3600)/60))
    S=$((SECONDS%60))
    echo "[$TIMESTAMP | END] scripts/fetch_views.py --id $SONG_ID (Exit Code: $EXIT_CODE) - Time Elapsed: ${H}h ${M}m ${S}s" | tee -a "$LOG_FILE"

elif [ "$1" == "rankings" ]; then
    SECONDS=0
    echo "[$TIMESTAMP | START] scripts/calculate_rankings_cache.py" | tee -a "$LOG_FILE"
    /usr/bin/python3 -u -m scripts.calculate_rankings_cache 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    H=$((SECONDS/3600))
    M=$(((SECONDS%3600)/60))
    S=$((SECONDS%60))
    echo "[$TIMESTAMP | END] scripts/calculate_rankings_cache.py (Exit Code: $EXIT_CODE) - Time Elapsed: ${H}h ${M}m ${S}s" | tee -a "$LOG_FILE"

else
    echo "Usage: $0 {fetch-new|update-existing|views|rankings} [args...]"
    exit 1
fi
