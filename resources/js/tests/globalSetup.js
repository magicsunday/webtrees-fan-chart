import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../..");
const SHOULD_SKIP_BUILD = process.env.SKIP_EXPORT_BUILD === "true";

const runBuild = () => {
    execSync("npm run prepare", {
        cwd: ROOT_DIR,
        stdio: "inherit",
    });
};

export default async () => {
    if (SHOULD_SKIP_BUILD) {
        return;
    }

    runBuild();
};
