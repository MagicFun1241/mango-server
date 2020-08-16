import * as crypto from "crypto";

export default class Hash {
    static create(str: string): string {
        return crypto.createHash("sha256").update(str).digest("base64");
    }
}