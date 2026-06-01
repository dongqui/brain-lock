import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

dotenv.config({ path: path.join(repoRoot, `.env.${mode}`) });
dotenv.config({ path: path.join(repoRoot, ".env") });
