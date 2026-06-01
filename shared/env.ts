import type { KiwoomEnvironment } from "./types.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getKiwoomCredentials(): {
  appKey: string;
  secretKey: string;
} {
  return {
    appKey: requiredEnv("KIWOOM_APP_KEY"),
    secretKey: requiredEnv("KIWOOM_SECRET_KEY"),
  };
}

export function getKiwoomEnvironment(): KiwoomEnvironment {
  return process.env.KIWOOM_ENVIRONMENT === "production"
    ? "production"
    : "mock";
}
