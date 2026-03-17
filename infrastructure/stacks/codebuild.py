from aws_cdk import (
    Stack,
    aws_codebuild as codebuild,
    aws_ecr as ecr,
    aws_iam as iam,
)
from constructs import Construct


class CodeBuildStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        prefix: str,
        repository_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        ecr_repo = ecr.Repository.from_repository_name(
            self, "ecr-repo", repository_name=repository_name
        )

        project = codebuild.Project(
            self,
            "build-project",
            project_name=f"{prefix}-build",
            source=codebuild.Source.git_hub(
                owner="blackga-nih",
                repo="nci-webtools-ctri-arti",
                branch_or_ref="mvp1",
            ),
            environment=codebuild.BuildEnvironment(
                build_image=codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged=True,
                compute_type=codebuild.ComputeType.MEDIUM,
            ),
            environment_variables={
                "AWS_ACCOUNT_ID": codebuild.BuildEnvironmentVariable(
                    value=self.account,
                ),
                "AWS_DEFAULT_REGION": codebuild.BuildEnvironmentVariable(
                    value=self.region,
                ),
                "ECR_REGISTRY": codebuild.BuildEnvironmentVariable(
                    value=f"{self.account}.dkr.ecr.{self.region}.amazonaws.com",
                ),
                "PREFIX": codebuild.BuildEnvironmentVariable(
                    value=prefix,
                ),
            },
            build_spec=codebuild.BuildSpec.from_object({
                "version": "0.2",
                "phases": {
                    "pre_build": {
                        "commands": [
                            "echo Logging in to ECR...",
                            "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY",
                            "export GITHUB_SHA=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c1-7)",
                            "export MAIN_IMAGE=$ECR_REGISTRY/$PREFIX:main-$GITHUB_SHA",
                            "export MAIN_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:main-latest",
                            "export GATEWAY_IMAGE=$ECR_REGISTRY/$PREFIX:gateway-$GITHUB_SHA",
                            "export GATEWAY_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:gateway-latest",
                            "export CMS_IMAGE=$ECR_REGISTRY/$PREFIX:cms-$GITHUB_SHA",
                            "export CMS_IMAGE_LATEST=$ECR_REGISTRY/$PREFIX:cms-latest",
                        ],
                    },
                    "build": {
                        "commands": [
                            "echo Building main image...",
                            "docker build -t $MAIN_IMAGE -t $MAIN_IMAGE_LATEST -f Dockerfile .",
                            "echo Building gateway image...",
                            "docker build -t $GATEWAY_IMAGE -t $GATEWAY_IMAGE_LATEST --build-arg BASE_IMAGE=$MAIN_IMAGE -f gateway/Dockerfile .",
                            "echo Building cms image...",
                            "docker build -t $CMS_IMAGE -t $CMS_IMAGE_LATEST --build-arg BASE_IMAGE=$MAIN_IMAGE -f cms/Dockerfile .",
                        ],
                    },
                    "post_build": {
                        "commands": [
                            "echo Pushing images to ECR...",
                            "docker push $MAIN_IMAGE",
                            "docker push $MAIN_IMAGE_LATEST",
                            "docker push $GATEWAY_IMAGE",
                            "docker push $GATEWAY_IMAGE_LATEST",
                            "docker push $CMS_IMAGE",
                            "docker push $CMS_IMAGE_LATEST",
                        ],
                    },
                },
            }),
        )

        ecr_repo.grant_pull_push(project)
