import * as fs from "fs";
import * as path from "path";

interface Environment {
    host: string;
}

interface Config {
    env: {
        production: Environment,
        development: Environment
    }
}

export const isDevelopment = process.env.NODE_ENV === "development";

const config: Config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config.json"), { encoding: "utf-8" }));

export default config;