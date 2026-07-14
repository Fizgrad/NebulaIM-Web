import type { Router } from "express";
import express from "express";
import { readMediaObject } from "./mediaStorage.js";
import { logger } from "../utils/logger.js";

export function createMediaRouter(): Router {
  const router = express.Router();

  router.get(/.*/, async (req, res) => {
    const key = decodeMediaKey(req.path);
    if (!key) {
      res.status(404).end();
      return;
    }

    try {
      const media = await readMediaObject(key);
      if (!media) {
        res.status(404).end();
        return;
      }

      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Cache-Control", media.cacheControl || "public, max-age=2592000, immutable");
      if (typeof media.contentLength === "number") {
        res.setHeader("Content-Length", String(media.contentLength));
      }
      media.body.pipe(res);
    } catch (error) {
      logger.warn("Media download failed.", { detail: { error, key } });
      res.status(500).end();
    }
  });

  return router;
}

function decodeMediaKey(pathname: string) {
  try {
    const decoded = decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (!decoded || decoded.includes("..") || decoded.startsWith("/")) return "";
    return decoded;
  } catch {
    return "";
  }
}
