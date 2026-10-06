import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const FORMAT_HEADER = Buffer.from([0x46, 0x46, 0x45, 0x01]);

/**
 * Encrypt HTML content with AES-256-GCM using PBKDF2-derived key.
 * Salt and IV are randomly generated for every encryption operation. The
 * format header allows the browser to distinguish this format from legacy
 * ciphertext that did not include a version marker.
 *
 * Output format: base64(header[4] + salt[16] + iv[12] + authTag[16] + ciphertext)
 */
export function encryptContent(
	html: string,
	password: string,
	_slug: string,
): string {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = pbkdf2Sync(
		password,
		salt,
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		"sha256",
	);

	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(html, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	const result = Buffer.concat([FORMAT_HEADER, salt, iv, authTag, encrypted]);
	return result.toString("base64");
}
