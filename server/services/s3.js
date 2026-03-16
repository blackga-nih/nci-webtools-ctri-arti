import { execSync } from "child_process";
import { createHash } from "crypto";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function putFile(bucket, key, body, contentType = "application/octet-stream") {
  const client = createS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof body === "string" ? Buffer.from(body, "utf-8") : body,
    ContentType: contentType,
  });
  await client.send(command);
  const hash = createHash("sha256")
    .update(typeof body === "string" ? body : Buffer.from(body))
    .digest("hex");
  return { bucket, key, contentHash: hash };
}

export async function deleteFile(bucket, key) {
  const client = createS3Client();
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(command);
  return { bucket, key, deleted: true };
}

export async function getPresignedUrl(bucket, key, expiresIn = 900) {
  const client = createS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(client, command, { expiresIn });
}
