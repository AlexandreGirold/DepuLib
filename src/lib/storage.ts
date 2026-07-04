import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Stockage des documents uploadés. Bucket S3 OVH si configuré (S3_ENDPOINT),
 * sinon disque local (dev). Retourne la clé/chemin à stocker en BDD.
 */

const endpoint = process.env.S3_ENDPOINT;

const s3 = endpoint
  ? new S3Client({
      endpoint,
      region: process.env.S3_REGION || "gra",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || ""
      },
      forcePathStyle: true // OVH Object Storage
    })
  : null;

export async function uploadDocument(
  key: string,
  body: Buffer,
  contentType = "application/pdf"
): Promise<string> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
    return key; // clé S3 stockée dans Document.path
  }

  // ponytail: fallback disque local si pas de bucket configuré (dev)
  const dir = process.env.UPLOAD_DIR || "./data/uploads";
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, body);
  return filePath;
}
