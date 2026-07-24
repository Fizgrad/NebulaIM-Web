import { z } from "zod";

const maxUint64 = 18_446_744_073_709_551_615n;

export const numericIdSchema = z
  .string()
  .trim()
  .min(1, "ID is required.")
  .max(20, "ID is too long.")
  .regex(/^\d+$/, "ID must be numeric.")
  .refine((value) => {
    try {
      const id = BigInt(value);
      return id > 0n && id <= maxUint64;
    } catch {
      return false;
    }
  }, "ID must be a positive uint64 value.");

export const deviceIdSchema = z.string().trim().min(1, "Device ID is required.").max(128, "Device ID is too long.");
