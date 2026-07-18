import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

const envCandidates = [".env.local", ".env"];

for (const filename of envCandidates) {
  const path = resolve(process.cwd(), filename);
  if (existsSync(path)) {
    config({ path });
    break;
  }
}
