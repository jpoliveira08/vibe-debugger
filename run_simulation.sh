#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipe failures

# A script to automate the VibeDebugger POC demonstration.

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if docker and docker compose are available
command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed. Aborting."; exit 1; }
command -v docker compose >/dev/null 2>&1 || { error "Docker Compose is required but not installed. Aborting."; exit 1; }

# Create a backup of docker-compose.yml
COMPOSE_FILE="docker-compose.yml"
BACKUP_FILE="${COMPOSE_FILE}.backup.$(date +%s)"

if [[ ! -f "$COMPOSE_FILE" ]]; then
    error "docker-compose.yml not found in current directory"
    exit 1
fi

cp "$COMPOSE_FILE" "$BACKUP_FILE"
log "Created backup: $BACKUP_FILE"

# Cleanup function
cleanup() {
    log "Cleaning up..."
    if [[ -f "$BACKUP_FILE" ]]; then
        mv "$BACKUP_FILE" "$COMPOSE_FILE"
        success "Restored original docker-compose.yml"
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

echo "--- VibeDebugger POC Simulation ---"

# --- Step 1: Start the environment with v1.0 ---
log "[1/5] Starting all services with the stable v1.0 application..."
if ! docker compose up -d --build; then
    error "Failed to start services"
    exit 1
fi

log "[2/5] Waiting for services to become healthy..."
# Wait for services to be healthy
for i in {1..12}; do  # Wait up to 60 seconds
    if docker compose ps --format json | jq -e '.[] | select(.Health == "healthy")' >/dev/null 2>&1; then
        success "Services are healthy"
        break
    fi
    if [[ $i -eq 12 ]]; then
        warn "Services may not be fully healthy, continuing anyway..."
    fi
    sleep 5
done

# Test that applications are responding
for port in 8001 8002 8003; do
    if curl -f -s "http://localhost:$port/health" >/dev/null; then
        success "App on port $port is responding"
    else
        warn "App on port $port is not responding to health checks"
    fi
done

log "System is stable. The 'Known Warning' is being logged, but no critical alerts are firing."

# --- Step 2: Simulate a deployment of v2.0 ---
log "[3/5] Simulating a deployment of the new v2.0 application..."

# Use a temporary file for the modification
TEMP_FILE=$(mktemp)
sed 's/APP_VERSION=v1.0/APP_VERSION=v2.0/g' "$COMPOSE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$COMPOSE_FILE"

if ! docker compose up -d --build app1 app2 app3; then
    error "Failed to deploy v2.0"
    exit 1
fi

success "Deployment of v2.0 complete."
log "Waiting for 15 seconds before the incident..."
sleep 15

# --- Step 3: Trigger the incident ---
log "[4/5] A user is accessing the broken page, triggering a critical error..."

# Test the broken page with proper error handling
if curl -f -s "http://localhost:8001/broken" >/dev/null 2>&1; then
    warn "Expected the broken page to return an error, but it didn't"
else
    success "Broken page triggered an error as expected"
fi

success "Incident triggered! A critical alert should now fire."
log "[5/5] Check your Discord channel for the alert and the VibeDebugger's analysis."
log "You can also check Prometheus at http://localhost:9090"
log "And Alertmanager at http://localhost:9093"
echo "--- Simulation Complete ---"
