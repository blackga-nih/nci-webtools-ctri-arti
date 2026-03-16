# Research Optimizer - local development commands

# Start the application locally (port 8080)
start:
    npm start

# Start individual services
start-gateway:
    npm run start:gateway

start-cms:
    npm run start:cms

start-agents:
    npm run start:agents

start-users:
    npm run start:users

# Run tests
test:
    npm test

# Linting
lint:
    npm run lint

lint-fix:
    npm run lint:fix

# Formatting
format:
    npm run format

format-fix:
    npm run format:fix

# Database
db-generate:
    npm run db:generate

db-studio:
    npm run db:studio

db-dev:
    npm run db:dev

db-dev-persistent:
    npm run db:dev:persistent

# Install dependencies
install:
    npm install

# Refresh AWS SSO credentials
sso-login:
    aws sso login --profile eagle
