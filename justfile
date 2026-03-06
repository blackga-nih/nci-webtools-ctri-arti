# Research Optimizer (arti) — local dev commands
# Usage: just <recipe>
# Install: https://github.com/casey/just

# Default: list recipes
default:
    @just --list

# Start the server (http://localhost:3000)
server:
    npm start -w server

# Start the server with file watching (auto-restart on changes)
dev:
    npm run start:dev -w server

# Install all dependencies
install:
    npm install

# Refresh AWS SSO credentials (required before starting server)
login:
    aws sso login --profile eagle

# Open the app in the default browser (API key bypass)
open:
    start http://localhost:3000/?apiKey=test-integration-api-key

# Validate chat with agent-browser: asks the FAC 2025-06 threshold question
# Expected: SAT=$350,000, MPT=$15,000
validate-chat:
    #!/usr/bin/env bash
    set -e
    export AGENT_BROWSER_NO_WSL=1

    echo "Opening app with API key bypass..."
    agent-browser navigate "http://localhost:3000/?apiKey=test-integration-api-key"

    echo "Accepting privacy notice..."
    sleep 2
    ACCEPT_REF=$(agent-browser snapshot | grep -o '"I Accept" \[ref=[^]]*\]' | grep -o 'ref=[^]]*' | head -1 | sed 's/ref=//')
    agent-browser click "@${ACCEPT_REF:-e17}"

    echo "Navigating to chat..."
    agent-browser navigate "http://localhost:3000/tools/chat"
    sleep 1

    echo "Sending FAC 2025-06 question..."
    INPUT_REF=$(agent-browser snapshot | grep -o '"Chat Message" \[ref=[^]]*\]' | grep -o 'ref=[^]]*' | head -1 | sed 's/ref=//')
    agent-browser fill "@${INPUT_REF:-e12}" "What are the simplified acquisition threshold and micro-purchase threshold under FAC 2025-06?"
    SEND_REF=$(agent-browser snapshot | grep '"Send" \[ref=' | grep -o 'ref=[^]]*' | head -1 | sed 's/ref=//')
    agent-browser click "@${SEND_REF:-e20}"

    echo "Waiting 40s for model response..."
    sleep 40
    agent-browser screenshot

    echo ""
    echo "Expected answer: SAT=\$350,000 | MPT=\$15,000"
    echo "Check the screenshot above to verify."

# Run unit tests
test:
    npm run test:unit -w server

# Full setup: install deps, login to AWS, start server
setup: install login server
