import { execSync } from "child_process";

import { S3Client, GetObjectCommand, paginateListObjectsV2 } from "@aws-sdk/client-s3";

function createS3Client() {
  const profile = process.env.AWS_PROFILE;
  return new S3Client({
    ...(profile && {
      credentials: async () => {
        const json = execSync(
          `aws configure export-credentials --profile ${profile} --format process`,
          { encoding: "utf-8", timeout: 10000 }
        );
        const creds = JSON.parse(json);
        return {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken,
          expiration: creds.Expiration ? new Date(creds.Expiration) : undefined,
        };
      },
    }),
  });
}

export async function listFiles(bucket, prefix = "") {
  const client = createS3Client();
  const paginator = paginateListObjectsV2({ client }, { Bucket: bucket, Prefix: prefix });
  const files = [];
  for await (const page of paginator) {
    if (page.Contents) {
      for (const item of page.Contents) {
        files.push(item.Key);
      }
    }
  }
  return files;
}

export async function getFile(bucket, key) {
  const client = createS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await client.send(command);
}
