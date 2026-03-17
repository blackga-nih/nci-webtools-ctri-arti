# Check CloudWatch Logs for Errors

Query CloudWatch Logs Insights for recent errors across both Eagle applications.

## Two Applications

There are TWO separate apps in this AWS account. Always query and report on BOTH, clearly separated:

### 1. Research Optimizer (CDN)

- **URL:** `https://29bwi1uh46.execute-api.us-east-1.amazonaws.com/tools/chat`
- **Infra:** API Gateway → ECS (Fargate)
- **Task role:** `power-user-ctri-research-optimizer-dev-task-role`
- **Log groups:**
  - `ctri-research-optimizer-dev` — main application logs
  - `/aws/codebuild/ctri-research-optimizer-dev-build` — CI/CD builds

### 2. Internal Prod Eagle

- **URL:** `http://internal-eaglec-front-teerfwosqs71-1457581412.us-east-1.elb.amazonaws.com/chat`
- **Infra:** ALB → ECS (Fargate)
- **Task role:** `eagle-app-role-dev`
- **Log groups:**
  - `/eagle/ecs/backend-dev` — backend ECS tasks
  - `/eagle/ecs/frontend-dev` — frontend
  - `/eagle/app` — application-level logs
  - `/eagle/inference` — model inference telemetry
  - `/eagle/lambda/metadata-extraction-dev` — metadata extraction lambda

## Instructions

1. Query BOTH apps in parallel using `mcp__cloudwatch-mcp-server__execute_log_insights_query`.
2. For each app, use this base query:

```
filter @message like /(?i)(error|ERROR|exception|Exception|FATAL|fatal|crash|fail|FAIL|warn|WARN)/
| fields @timestamp, @logStream, @message
| sort @timestamp desc
| limit 30
```

3. Default time window: last 24 hours. If the user specifies a different window (e.g. "last 7 days", "since Monday", "4h"), adjust `start_time` and `end_time` accordingly.
4. Use `region: "us-east-1"` and `profile_name: "eagle"`.
5. After getting results, produce a summary table PER APP:
   - Group errors by type/category (e.g. "S3 AccessDenied", "npm startup crash", "OTel context detach")
   - Count occurrences of each category
   - Mark each as **ACTIONABLE** (permission issues, crashes, data loss) or **Noise** (telemetry bugs, deprecation warnings)
   - If IAM permission errors are found, note the exact role ARN, denied action, and resource ARN
6. End with a combined summary table showing both apps side by side.
7. If SSO credentials are expired, instruct the user to run `aws sso login --profile eagle` and retry.

## Known Error Patterns

| Pattern                                      | App                 | Category                 | Severity   |
| -------------------------------------------- | ------------------- | ------------------------ | ---------- |
| `Failed to detach context`                   | Internal Prod Eagle | OTel async generator bug | Noise      |
| `s3:PutObject` AccessDenied                  | Internal Prod Eagle | IAM missing permission   | ACTIONABLE |
| `logs:CreateLogGroup` AccessDenied           | Research Optimizer  | IAM missing permission   | ACTIONABLE |
| `npm error Lifecycle script` + SIGTERM       | Research Optimizer  | Startup crash loop       | ACTIONABLE |
| `MemoryStore is not designed for production` | Research Optimizer  | Session store warning    | Warning    |
| `BadZipFile: File is not a zip file`         | Internal Prod Eagle | Corrupt upload           | ACTIONABLE |

## Optional Arguments

The user may pass arguments after the command:

- A time range like `7d`, `4h`, `1h`, `30m` — adjust the query window accordingly
- A keyword like `AccessDenied` or `SIGTERM` — narrow the filter to that specific error pattern
- `--optimizer` or `--eagle` — query only that specific app
- A log group name — query only that specific group

## Full Log Group Reference

| Log Group                                          | App                 | Purpose             | Retention |
| -------------------------------------------------- | ------------------- | ------------------- | --------- |
| `ctri-research-optimizer-dev`                      | Research Optimizer  | Main app logs       | 30 days   |
| `/aws/codebuild/ctri-research-optimizer-dev-build` | Research Optimizer  | CI/CD builds        | none      |
| `/eagle/ecs/backend-dev`                           | Internal Prod Eagle | Backend ECS tasks   | 30 days   |
| `/eagle/ecs/frontend-dev`                          | Internal Prod Eagle | Frontend            | 30 days   |
| `/eagle/app`                                       | Internal Prod Eagle | App-level logs      | 90 days   |
| `/eagle/inference`                                 | Internal Prod Eagle | Model inference     | none      |
| `/eagle/lambda/metadata-extraction-dev`            | Internal Prod Eagle | Metadata extraction | 30 days   |
| `/aws/ecs/containerinsights/eagle-dev/performance` | Internal Prod Eagle | Container insights  | 1 day     |
| `/aws/bedrock/modelinvocations`                    | Shared              | Bedrock API calls   | none      |
