import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { mediaKey, writeMediaObject } from "./mediaStorage.js";
import { authUserId } from "./authMiddleware.js";

const maxImageBytes = 5 * 1024 * 1024;
const maxDataUrlLength = Math.ceil(maxImageBytes * 1.4) + 128;

const allowedImages = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
} as const;

const uploadImageSchema = z.object({
  dataUrl: z.string().min(1, "Image data is required.").max(maxDataUrlLength, "Image data is too large."),
  fileName: z.string().trim().max(180).optional()
});

const uploadWindows = new Map<string, { windowStartedAt: number; count: number }>();

export function createUploadRouter(): Router {
  const router = express.Router();

  router.post("/images", async (req, res) => {
    const userId = authUserId(req);
    if (!allowUpload(userId)) {
      res.status(429).json({
        ok: false,
        error: {
          code: "UPLOAD_RATE_LIMITED",
          message: "Too many image uploads."
        }
      });
      return;
    }

    const parsed = uploadImageSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid image upload payload.");
      return;
    }

    const image = parseDataUrl(parsed.data.dataUrl);
    if (!image) {
      sendValidationError(res, "Image must be a PNG, JPEG, WebP or GIF data URL.");
      return;
    }
    if (image.buffer.length > maxImageBytes) {
      sendValidationError(res, "Image must be 5 MiB or smaller.");
      return;
    }
    if (!matchesImageSignature(image.mimeType, image.buffer)) {
      sendValidationError(res, "Image content does not match its MIME type.");
      return;
    }

    try {
      const fileName = `${createId("image")}.${allowedImages[image.mimeType]}`;
      const now = new Date();
      const year = String(now.getUTCFullYear());
      const month = String(now.getUTCMonth() + 1).padStart(2, "0");
      const object = await writeMediaObject(mediaKey(`images/${year}/${month}/${fileName}`), image.buffer, image.mimeType);
      const publicLocation = mediaPublicLocation(req, object.key);

      res.status(201).json({
        ok: true,
        url: publicLocation.url,
        path: publicLocation.path,
        mimeType: image.mimeType,
        size: object.size
      });
    } catch (error) {
      logger.warn("Image upload failed.", { detail: error });
      res.status(500).json({
        ok: false,
        error: {
          code: "IMAGE_UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Image upload failed."
        }
      });
    }
  });

  return router;
}

function allowUpload(userId: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const current = uploadWindows.get(userId);
  if (!current || now - current.windowStartedAt >= windowMs) {
    uploadWindows.set(userId, { windowStartedAt: now, count: 1 });
    pruneUploadWindows(now, windowMs);
    return true;
  }
  if (current.count >= config.uploadRateLimitPerMinute) return false;
  current.count += 1;
  return true;
}

function pruneUploadWindows(now: number, windowMs: number) {
  for (const [userId, item] of uploadWindows) {
    if (now - item.windowStartedAt >= windowMs * 2) uploadWindows.delete(userId);
  }
}

function parseDataUrl(dataUrl: string): { mimeType: keyof typeof allowedImages; buffer: Buffer } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] as keyof typeof allowedImages;
  if (!allowedImages[mimeType]) return null;
  const buffer = Buffer.from(match[2], "base64");
  return { mimeType, buffer };
}

function matchesImageSignature(mimeType: keyof typeof allowedImages, buffer: Buffer) {
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    return buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a");
  }
  return (
    mimeType === "image/webp" &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function mediaPublicLocation(req: express.Request, key: string) {
  const base = config.mediaPublicBaseUrl.replace(/\/+$/, "") || (config.mediaStorageDriver === "s3" ? "/media" : "/uploads");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (/^https?:\/\//i.test(base)) {
    const url = `${base}/${encodedKey}`;
    return {
      url,
      path: new URL(url).pathname
    };
  }
  const path = `${base.startsWith("/") ? base : `/${base}`}/${encodedKey}`;
  return {
    url: `${publicBaseUrl(req)}${path}`,
    path
  };
}

function publicBaseUrl(req: express.Request) {
  const forwardedProto = firstHeaderValue(req.header("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(req.header("x-forwarded-host"));
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.header("host") || "localhost";
  return `${proto}://${host}`;
}

function firstHeaderValue(value: string | undefined) {
  return value?.split(",")[0]?.trim() ?? "";
}

function sendValidationError(res: express.Response, message: string) {
  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_IMAGE_UPLOAD",
      message
    }
  });
}
