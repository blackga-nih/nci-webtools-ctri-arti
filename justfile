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

# === Deployment (requires Docker Desktop + AWS CDK) ===

# Set the repo root for all deploy recipes
repo_root := justfile_directory()

# Full deploy: CDK stacks + Docker build/push + ECS service
deploy:
    bash infrastructure/deploy.sh

# Deploy CDK stacks only (no Docker) — updates IAM policies, task defs, etc.
deploy-cdk:
    #!/usr/bin/env bash
    set -ex
    cd "{{repo_root}}"
    set -a && source infrastructure/.env && set +a
    [ -z "$CI" ] && [ -n "$AWS_PROFILE" ] && unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
    export TIER=${TIER:?} AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:?} AWS_REGION=${AWS_REGION:?}
    export PREFIX=ctri-research-optimizer-$TIER
    cd infrastructure
    pip install -q -r requirements.txt
    cdk deploy $PREFIX-ecr-repository --require-approval never
    cdk deploy $PREFIX-ecs-service --require-approval never

# Build and push Docker images only (assumes ECR repo exists)
deploy-images:
    #!/usr/bin/env bash
    set -ex
    cd "{{repo_root}}"
    set -a && source infrastructure/.env && set +a
    [ -z "$CI" ] && [ -n "$AWS_PROFILE" ] && unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
    export TIER=${TIER:?} AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:?} AWS_REGION=${AWS_REGION:?}
    export GITHUB_SHA=${GITHUB_SHA:-$(git rev-parse --short HEAD)}
    export PREFIX=ctri-research-optimizer-$TIER
    export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    export MAIN_IMAGE=$ECR_REGISTRY/$PREFIX:main-$GITHUB_SHA
    export MAIN_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:main-latest
    export GATEWAY_IMAGE=$ECR_REGISTRY/$PREFIX:gateway-$GITHUB_SHA
    export GATEWAY_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:gateway-latest
    export CMS_IMAGE=$ECR_REGISTRY/$PREFIX:cms-$GITHUB_SHA
    export CMS_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:cms-latest
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    docker build -t $MAIN_IMAGE -t $MAIN_IMAGE_LATEST -f Dockerfile .
    docker build -t $GATEWAY_IMAGE -t $GATEWAY_IMAGE_LATEST --build-arg BASE_IMAGE=$MAIN_IMAGE -f gateway/Dockerfile .
    docker build -t $CMS_IMAGE -t $CMS_IMAGE_LATEST --build-arg BASE_IMAGE=$MAIN_IMAGE -f cms/Dockerfile .
    docker push $MAIN_IMAGE && docker push $MAIN_IMAGE_LATEST
    docker push $GATEWAY_IMAGE && docker push $GATEWAY_IMAGE_LATEST
    docker push $CMS_IMAGE && docker push $CMS_IMAGE_LATEST

# Deploy ECS service with latest images (after deploy-images)
deploy-ecs:
    #!/usr/bin/env bash
    set -ex
    cd "{{repo_root}}"
    set -a && source infrastructure/.env && set +a
    [ -z "$CI" ] && [ -n "$AWS_PROFILE" ] && unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
    export TIER=${TIER:?} AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:?} AWS_REGION=${AWS_REGION:?}
    export PREFIX=ctri-research-optimizer-$TIER
    export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    export MAIN_IMAGE=$ECR_REGISTRY/$PREFIX:main-latest
    export GATEWAY_IMAGE=$ECR_REGISTRY/$PREFIX:gateway-latest
    export CMS_IMAGE=$ECR_REGISTRY/$PREFIX:cms-latest
    cd infrastructure
    pip install -q -r requirements.txt
    cdk deploy $PREFIX-ecs-service --require-approval never

# Force ECS to pull latest images and restart
deploy-restart:
    aws ecs update-service --cluster ctri-research-optimizer-dev --service ctri-research-optimizer-dev --force-new-deployment --profile eagle

# Quick redeploy: update CDK stacks (IAM, task def) then force ECS restart
redeploy:
    #!/usr/bin/env bash
    set -ex
    cd "{{repo_root}}"
    set -a && source infrastructure/.env && set +a
    [ -z "$CI" ] && [ -n "$AWS_PROFILE" ] && unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
    export TIER=${TIER:?} AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:?} AWS_REGION=${AWS_REGION:?}
    export PREFIX=ctri-research-optimizer-$TIER
    cd infrastructure
    pip install -q -r requirements.txt
    echo "=== Deploying CDK stack ==="
    cdk deploy $PREFIX-ecs-service --require-approval never
    echo "=== Forcing ECS restart ==="
    aws ecs update-service --cluster $PREFIX --service $PREFIX --force-new-deployment --profile eagle --output text
    echo "=== Done. Service will roll out new tasks in ~2 minutes ==="

# Trigger CodeBuild to build images remotely (no local Docker needed)
deploy-codebuild:
    aws codebuild start-build --project-name ctri-research-optimizer-dev-build --profile eagle
