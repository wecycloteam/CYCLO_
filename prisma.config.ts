import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.join(__dirname, "prisma", ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
});
