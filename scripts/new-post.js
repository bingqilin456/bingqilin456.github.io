/* This is a script to create a new post markdown file with front-matter */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

function getDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error(`Error: No filename argument provided
Usage: pnpm new-post -- <filename>`);
	process.exit(1);
}

const requestedName = args[0].trim().replace(/\\/g, "/");
const pathSegments = requestedName.split("/");
const validSegment = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

if (
	!requestedName ||
	path.isAbsolute(requestedName) ||
	pathSegments.some(
		(segment) => !segment || segment === "." || segment === ".." || !validSegment.test(segment),
	)
) {
	console.error("Error: Filename contains an invalid path or character");
	process.exit(1);
}

let fileName = requestedName;

// Add .md extension if not present
const fileExtensionRegex = /\.(md|mdx)$/i;
if (!fileExtensionRegex.test(fileName)) {
	fileName += ".md";
}

const targetDir = path.resolve("src/content/posts");
const fullPath = path.resolve(targetDir, fileName);
const targetPrefix = `${targetDir}${path.sep}`;

if (!fullPath.startsWith(targetPrefix)) {
	console.error("Error: Target path is outside src/content/posts");
	process.exit(1);
}

if (fs.existsSync(fullPath)) {
	console.error(`Error: File ${fullPath} already exists`);
	process.exit(1);
}

// recursive mode creates multi-level directories
const dirPath = path.dirname(fullPath);
if (!fs.existsSync(dirPath)) {
	fs.mkdirSync(dirPath, { recursive: true });
}

const extension = path.extname(fileName);
const title = path.basename(fileName, extension);
const content = matter.stringify("", {
	title,
	published: getDate(),
	description: "",
	image: "",
	tags: [],
	category: "",
	draft: false,
	lang: "",
});

fs.writeFileSync(fullPath, content, { encoding: "utf8", flag: "wx" });

console.log(`Post ${fullPath} created`);
