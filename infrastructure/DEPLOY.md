# Deploying Research Optimizer to AWS

## Prerequisites

- **Docker Desktop** (running)
- **AWS CDK CLI**: `npm install -g aws-cdk`
- **Python 3.9+** with pip
- **AWS SSO access**: `aws sso login --profile eagle`
- **just** (optional): `cargo install just` or `brew install just`

## Architecture

```
User → API Gateway (https://29bwi1uh46.execute-api.us-east-1.amazonaws.com)
         → VPC Link → EAGLE-DEV-ALB (internal, HTTPS:443)
           → Listener rule (host-header) → ECS Target Group
             → Fargate Task (main:80, gateway:3001, cms:3002)
               → PGlite (embedded Postgres)
```

## Quick Deploy (with Docker)

```bash
# 1. Login to AWS
aws sso login --profile eagle

# 2. Full deploy (CDK + Docker build + ECS)
just deploy
```

Or step by step:

```bash
# Build and push Docker images to ECR
just deploy-images

# Deploy/update ECS service with latest images
just deploy-ecs
```

## Deploy Without Docker (CodeBuild)

If you don't have Docker locally, use CodeBuild to build images remotely:

```bash
# Trigger remote build (pulls from GitHub mvp1 branch)
just deploy-codebuild

# Monitor build status
aws codebuild list-builds-for-project --project-name ctri-research-optimizer-dev-build --profile eagle
aws codebuild batch-get-builds --ids <BUILD_ID> --profile eagle --query "builds[0].buildStatus"

# After build succeeds, deploy ECS
just deploy-ecs

# Or just force restart to pick up new images
just deploy-restart
```

## Key Resources

| Resource        | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Public URL**  | https://29bwi1uh46.execute-api.us-east-1.amazonaws.com                   |
| **ECS Cluster** | ctri-research-optimizer-dev                                              |
| **ECR Repo**    | 695681773636.dkr.ecr.us-east-1.amazonaws.com/ctri-research-optimizer-dev |
| **CodeBuild**   | ctri-research-optimizer-dev-build                                        |
| **Log Group**   | ctri-research-optimizer-dev                                              |
| **ALB**         | EAGLE-DEV-ALB (shared, internal)                                         |

## Troubleshooting

```bash
# Check ECS task status
aws ecs describe-services --cluster ctri-research-optimizer-dev \
  --services ctri-research-optimizer-dev \
  --query "services[0].{desired:desiredCount,running:runningCount}" --profile eagle

# View recent logs
aws logs filter-log-events --log-group-name ctri-research-optimizer-dev \
  --start-time $(date -d '10 minutes ago' +%s000) --limit 30 --profile eagle \
  --query "events[*].message"

# Force restart with latest images
just deploy-restart
```

## Config

All deployment config lives in `infrastructure/.env` (not committed).
Copy from `infrastructure/.env.example` and fill in values.
