/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a GitHub Card component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.repo - The GitHub repository in the format "owner/repo".
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created GitHub Card component.
 */
export function GithubCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0)
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("github" directive must be leaf type "::github{repo="owner/repo"}")',
		]);

	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(properties.repo || ""))
		return h(
			"div",
			{ class: "hidden" },
			'Invalid repository. ("repo" attributte must be in the format "owner/repo")',
		);

	const repo = properties.repo;
	const [owner, repoName] = repo.split("/");
	const cardUuid = `GC${Math.random().toString(36).slice(-6)}`; // Collisions are not important
	const apiUrl = JSON.stringify(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
	);
	const descriptionId = JSON.stringify(`${cardUuid}-description`);
	const languageId = JSON.stringify(`${cardUuid}-language`);
	const forksId = JSON.stringify(`${cardUuid}-forks`);
	const starsId = JSON.stringify(`${cardUuid}-stars`);
	const avatarId = JSON.stringify(`${cardUuid}-avatar`);
	const licenseId = JSON.stringify(`${cardUuid}-license`);
	const cardId = JSON.stringify(`${cardUuid}-card`);
	const logLabel = JSON.stringify(`${repo} | ${cardUuid}`);

	const nAvatar = h(`div#${cardUuid}-avatar`, { class: "gc-avatar" });
	const nLanguage = h(
		`span#${cardUuid}-language`,
		{ class: "gc-language" },
		"Waiting...",
	);

	const nTitle = h("div", { class: "gc-titlebar" }, [
		h("div", { class: "gc-titlebar-left" }, [
			h("div", { class: "gc-owner" }, [
				nAvatar,
				h("div", { class: "gc-user" }, repo.split("/")[0]),
			]),
			h("div", { class: "gc-divider" }, "/"),
			h("div", { class: "gc-repo" }, repo.split("/")[1]),
		]),
		h("div", { class: "github-logo" }),
	]);

	const nDescription = h(
		`div#${cardUuid}-description`,
		{ class: "gc-description" },
		"Waiting for api.github.com...",
	);

	const nStars = h(`div#${cardUuid}-stars`, { class: "gc-stars" }, "00K");
	const nForks = h(`div#${cardUuid}-forks`, { class: "gc-forks" }, "0K");
	const nLicense = h(`div#${cardUuid}-license`, { class: "gc-license" }, "0K");

	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript", defer: true },
		`
      fetch(${apiUrl}, { referrerPolicy: "no-referrer" }).then(response => {
        if (!response.ok) throw new Error("GitHub API request failed");
        return response.json();
      }).then(data => {
        document.getElementById(${descriptionId}).innerText = data.description?.replace(/:[a-zA-Z0-9_]+:/g, '') || "Description not set";
        document.getElementById(${languageId}).innerText = data.language || "Unknown";
        document.getElementById(${forksId}).innerText = Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 }).format(data.forks || 0).replaceAll("\u202f", '');
        document.getElementById(${starsId}).innerText = Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 }).format(data.stargazers_count || 0).replaceAll("\u202f", '');
        const avatarEl = document.getElementById(${avatarId});
        avatarEl.style.backgroundImage = 'url(' + data.owner.avatar_url + '&s=32' + ')';
        avatarEl.style.backgroundColor = 'transparent';
        document.getElementById(${licenseId}).innerText = data.license?.spdx_id || "no-license";
        document.getElementById(${cardId}).classList.remove("fetch-waiting");
      }).catch(() => {
        const c = document.getElementById(${cardId});
        c?.classList.add("fetch-error");
        console.warn("[GITHUB-CARD] (Error) Loading card for", ${logLabel});
      })
    `,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: "card-github fetch-waiting no-styling",
			href: `https://github.com/${repo}`,
			target: "_blank",
			rel: "noopener noreferrer",
			repo,
		},
		[
			nTitle,
			nDescription,
			h("div", { class: "gc-infobar" }, [nStars, nForks, nLicense, nLanguage]),
			nScript,
		],
	);
}
