import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { config } from "../config.js";

export type StoredMedia = {
  key: string;
  contentType: string;
  size: number;
};

export type ReadMediaResult = {
  body: Readable;
  contentType: string;
  contentLength?: number;
  cacheControl?: string;
};

let s3Client: S3Client | null = null;

export async function writeMediaObject(key: string, buffer: Buffer, contentType: string): Promise<StoredMedia> {
  const normalizedKey = normalizeMediaKey(key);

  if (config.mediaStorageDriver === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=2592000, immutable"
      })
    );
    return {
      key: normalizedKey,
      contentType,
      size: buffer.length
    };
  }

  const filePath = localPathForKey(normalizedKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer, { flag: "wx" });
  return {
    key: normalizedKey,
    contentType,
    size: buffer.length
  };
}

export async function readMediaObject(key: string): Promise<ReadMediaResult | null> {
  if (config.mediaStorageDriver !== "s3") return null;

  try {
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: config.s3Bucket,
        Key: normalizeMediaKey(key)
      })
    );

    if (!isReadableStream(result.Body)) return null;

    return {
      body: result.Body,
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: result.ContentLength,
      cacheControl: result.CacheControl
    };
  } catch (error) {
    if (error instanceof NoSuchKey || isS3NotFound(error)) return null;
    throw error;
  }
}

export function mediaKey(relativeKey: string) {
  const key = normalizeMediaKey(relativeKey);
  return config.s3KeyPrefix ? `${config.s3KeyPrefix}/${key}` : key;
}

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      forcePathStyle: config.s3ForcePathStyle,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey
      }
    });
  }
  return s3Client;
}

function normalizeMediaKey(key: string) {
  const normalized = key
    .split("/")
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join("/");
  if (!normalized) {
    throw new Error("Media object key is empty.");
  }
  return normalized;
}

function localPathForKey(key: string) {
  const filePath = path.resolve(config.uploadDir, key);
  const uploadRoot = `${path.resolve(config.uploadDir)}${path.sep}`;
  if (!filePath.startsWith(uploadRoot)) {
    throw new Error("Media object key resolves outside UPLOAD_DIR.");
  }
  return filePath;
}

function isReadableStream(value: unknown): value is Readable {
  return typeof (value as Readable | undefined)?.pipe === "function";
}

function isS3NotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const statusCode =
    "$metadata" in error && typeof error.$metadata === "object" && error.$metadata
      ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
      : undefined;
  return name === "NoSuchKey" || name === "NotFound" || statusCode === 404;
}
