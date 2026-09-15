import { afterEach, describe, expect, it } from "vitest";
import { liveBackend, liveWritable } from "./store";

const KEYS = ["VERCEL", "BLOB_READ_WRITE_TOKEN"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of KEYS) out[key] = process.env[key];
  return out;
}

function restoreEnv(prev: Record<string, string | undefined>): void {
  for (const key of KEYS) {
    if (prev[key] == null) delete process.env[key];
    else process.env[key] = prev[key];
  }
}

describe("live store backend", () => {
  const prev = snapshotEnv();
  afterEach(() => restoreEnv(prev));

  it("writes a local file off Vercel", () => {
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(liveBackend()).toBe("local");
    expect(liveWritable()).toBe(true);
  });

  it("uses Runtime Cache on Vercel when Blob is missing", () => {
    process.env.VERCEL = "1";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(liveBackend()).toBe("runtime-cache");
    expect(liveWritable()).toBe(true);
  });

  it("prefers Blob when the token exists", () => {
    process.env.VERCEL = "1";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    expect(liveBackend()).toBe("blob");
    expect(liveWritable()).toBe(true);
  });
});
