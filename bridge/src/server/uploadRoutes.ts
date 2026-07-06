import type { Router } from "express";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

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

export function createUploadRouter(): Router {
  const router = express.Router();

  router.post("/images", async (req, res) => {
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
      const imageDir = path.join(config.uploadDir, "images");
      await fs.mkdir(imageDir, { recursive: true });
      const fileName = `${createId("image")}.${allowedImages[image.mimeType]}`;
      const filePath = path.join(imageDir, fileName);
      await fs.writeFile(filePath, image.buffer, { flag: "wx" });

      const urlPath = `/uploads/images/${fileName}`;
      res.status(201).json({
        ok: true,
        url: `${publicBaseUrl(req)}${urlPath}`,
        path: urlPath,
        mimeType: image.mimeType,
        size: image.buffer.length
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
