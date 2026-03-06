# Private Deployment Options

Goal: expose the app on a private endpoint locked down to the VPC, accessible only via VPN or within AWS.

## Current State

The CDK stack (`infrastructure/stacks/ecs.py`) deploys ECS Fargate + an internet-facing ALB with an HTTPS listener. The app runs as 3 sidecar containers (main, gateway, cms) in one Fargate task on port 80 internally. The `infrastructure/templates/load-balancer.yml` CloudFormation template already has a `Scheme` parameter with `internal` as an allowed value — the ALB side is already designed for it.

## Options

### Option 1: Flip ALB to `internal` ✅ Recommended
**Effort: ~30 min | Cost: ~$50–80/mo**

Change `Scheme: internet-facing` → `Scheme: internal` in `load-balancer.yml` and redeploy. The ALB gets only private IPs and is only reachable from within the VPC or anything VPN/Direct Connect'd into it.

- Pros: Already coded, zero app changes, keeps HTTPS + auto-scaling + ECS
- Cons: Subnets must be private (no public IPs); users need VPN or VPC access
- Files to change: `infrastructure/templates/load-balancer.yml` (Scheme default), `infrastructure/stacks/ecs.py` (listener lookup tags)

### Option 2: Option 1 + Bedrock VPC Interface Endpoint
**Effort: ~2 hours | Cost: ~$50–80/mo + ~$7/mo per AZ per endpoint**

Same as Option 1 but add VPC Interface Endpoints for Bedrock so inference calls never leave the AWS backbone. Appropriate for FISMA/NIH sensitive workloads.

- Services needing endpoints: `com.amazonaws.us-east-1.bedrock-runtime`, `com.amazonaws.us-east-1.s3`
- Pros: Fully private, no internet egress, audit-friendly
- Cons: VPC endpoint cost per AZ; slight extra CDK setup

### Option 3: Lightsail VM (dev/staging sandbox)
**Effort: ~1 hour | Cost: $10–20/mo**

A Lightsail instance running the app directly with `npm start -w server` (same as local dev). Lock down the firewall to NIH IP blocks or a specific CIDR.

- Pros: Cheapest, fastest to stand up, no Docker/ECS required
- Cons: Outside the main VPC — no native VPC integration without painful peering. No auto-restart or scaling. Dev/staging only.

### Option 4: Lightsail Container Service
**Effort: ~1 hour | Cost: $7–80/mo flat**

Push the existing Docker image to a Lightsail container service. Simple ops, no VPC/subnet config, flat monthly price.

- Pros: Simple, no ECS, built-in load balancer
- Cons: Same VPC isolation problem as Option 3 — Lightsail runs in its own network. Not suitable for VPC-locked deployments.

## Decision

| Option | VPC-locked | Cost | Effort | Recommended for |
|--------|-----------|------|--------|-----------------|
| 1 — Internal ALB | ✅ | ~$65/mo | 30 min | Internal team use on VPN |
| 2 — Internal ALB + VPC endpoints | ✅ | ~$80/mo | 2 hrs | Prod / FISMA workloads |
| 3 — Lightsail VM | ❌ | ~$15/mo | 1 hr | Cheap sandbox, IP-restricted |
| 4 — Lightsail Container | ❌ | ~$40/mo | 1 hr | Simple sandbox, no VPC |

**Recommended path**: Option 1 for an internal dev/staging environment (team on VPN), Option 2 if this moves toward production or handles sensitive data.

## Implementation Notes (Option 1)

1. In `load-balancer.yml`: change `Default: internet-facing` → `Default: internal`
2. Ensure the subnets passed in `SUBNETS` env var are **private** subnets (no internet gateway route)
3. Security group on the ALB should restrict ingress to VPC CIDR instead of `0.0.0.0/0`
4. The app itself (`server/.env`) needs no changes — it still runs HTTP on port 80/3000 internally
5. Users access via the ALB's private DNS name (e.g. `internal-xxx.us-east-1.elb.amazonaws.com`) or a Route 53 private hosted zone alias
