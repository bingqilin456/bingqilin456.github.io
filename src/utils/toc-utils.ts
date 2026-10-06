/**
 * TOC (Table of Contents) 工具类
 * 用于 SidebarTOC 和 FloatingDock 的共享逻辑
 */

import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

export interface TOCConfig {
	contentId: string;
	indicatorId: string;
	maxLevel?: number;
	scrollOffset?: number;
}

export class TOCManager {
	private tocItems: HTMLElement[] = [];
	private observer: IntersectionObserver | null = null;
	private minDepth = 10;
	private maxLevel: number;
	private scrollTimeout: number | null = null;
	private activeUpdateFrame: number | null = null;
	private contentId: string;
	private indicatorId: string;
	private scrollOffset: number;
	private boundClickHandlers: Map<HTMLElement, (event: Event) => void> =
		new Map();
	private boundScrollHandler: (() => void) | null = null;
	private boundMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
	private boundMouseLeaveHandler: (() => void) | null = null;

	constructor(config: TOCConfig) {
		this.contentId = config.contentId;
		this.indicatorId = config.indicatorId;
		this.maxLevel = config.maxLevel || 3;
		this.scrollOffset = config.scrollOffset || 80;
	}

	/**
	 * 查找文章内容容器
	 */
	private getContentContainer(): Element | null {
		return (
			document.querySelector(".custom-md") ||
			document.querySelector(".prose") ||
			document.querySelector(".markdown-content")
		);
	}

	/**
	 * 查找所有标题
	 */
	private getAllHeadings(): HTMLElement[] {
		const contentContainer = this.getContentContainer();
		if (!contentContainer) {
			return [];
		}
		return Array.from(
			contentContainer.querySelectorAll("h1, h2, h3, h4, h5, h6"),
		);
	}

	/**
	 * 计算最小深度
	 */
	private calculateMinDepth(headings: HTMLElement[]): number {
		let minDepth = 10;
		headings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			minDepth = Math.min(minDepth, depth);
		});
		return minDepth;
	}

	/**
	 * 过滤标题
	 */
	private filterHeadings(headings: HTMLElement[]): HTMLElement[] {
		return Array.from(headings).filter((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			return depth < this.minDepth + this.maxLevel;
		});
	}

	/**
	 * 获取标题的纯文本内容（排除 script/style 标签的文本）
	 */
	private getCleanTextContent(element: HTMLElement): string {
		const clone = element.cloneNode(true) as HTMLElement;
		for (const el of clone.querySelectorAll("script, style")) {
			el.remove();
		}
		return clone.textContent || "";
	}

	/**
	 * 转义 HTML 属性值，避免标题中的引号破坏属性
	 */
	private escapeHtmlAttr(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	/**
	 * 生成徽章内容
	 */
	private generateBadgeContent(depth: number, heading1Count: number): string {
		if (depth === this.minDepth) {
			return heading1Count.toString();
		}
		if (depth === this.minDepth + 1) {
			return '<span class="toc-badge-dot"></span>';
		}
		return '<span class="toc-badge-dot toc-badge-dot-sm"></span>';
	}

	/**
	 * 空状态文案
	 */
	private getEmptyStateHTML(): string {
		return `<div class="text-center py-8 text-gray-500 dark:text-gray-400"><p>${i18n(I18nKey.tocEmpty)}</p></div>`;
	}

	/**
	 * 生成TOC HTML
	 */
	public generateTOCHTML(): string {
		const headings = this.getAllHeadings();

		if (headings.length === 0) {
			return this.getEmptyStateHTML();
		}

		this.minDepth = this.calculateMinDepth(headings);
		const filteredHeadings = this.filterHeadings(headings);

		if (filteredHeadings.length === 0) {
			return this.getEmptyStateHTML();
		}

		let tocHTML = "";
		let heading1Count = 1;

		filteredHeadings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			const depthLevel =
				depth === this.minDepth ? 0 : depth === this.minDepth + 1 ? 1 : 2;

			if (!heading.id) {
				return;
			}

			const badgeContent = this.generateBadgeContent(depth, heading1Count);
			if (depth === this.minDepth) {
				heading1Count++;
			}

			let headingText = this.getCleanTextContent(heading)
				.replace(/#+\s*$/, "")
				.trim();

			// Fallback for empty text (e.g. dynamic subtitle)
			if (!headingText) {
				const dataSubtitles = heading.getAttribute("data-subtitles");
				if (dataSubtitles) {
					try {
						const subtitles = JSON.parse(dataSubtitles);
						headingText = Array.isArray(subtitles) ? subtitles[0] : subtitles;
					} catch {
						// ignore
					}
				}
			}

			if (!headingText) {
				headingText =
					heading.id === "banner-subtitle"
						? "Banner Subtitle"
						: heading.id || "Heading";
			}

			const escapedHeadingText = this.escapeHtmlAttr(headingText);

			tocHTML += `
        <a 
          href="#${heading.id}" 
			  class="toc-item toc-level-${depthLevel}"
          data-heading-id="${heading.id}"
		  aria-label="${escapedHeadingText}"
		  title="${escapedHeadingText}"
        >
			  <div class="toc-badge ${depth === this.minDepth ? "toc-badge-index" : ""}">
            ${badgeContent}
          </div>
			  <div class="toc-label ${depth <= this.minDepth + 1 ? "toc-label-primary" : "toc-label-secondary"}">${headingText}</div>
        </a>
      `;
		});

		tocHTML += `<div id="${this.indicatorId}" style="opacity: 0;" class="toc-active-indicator"></div>`;

		return tocHTML;
	}

	/**
	 * 更新TOC内容
	 */
	public updateTOCContent(): void {
		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		tocContent.innerHTML = this.generateTOCHTML();
		this.tocItems = Array.from(
			document.querySelectorAll(`#${this.contentId} a`),
		);
	}

	/**
	 * 返回阅读线以上最近的一个目录标题，避免将同屏的多个标题同时标为活动项。
	 */
	private getActiveHeadingId(): string | null {
		const tocHeadingIds = new Set(
			this.tocItems
				.map((item) => item.dataset.headingId)
				.filter((id): id is string => Boolean(id)),
		);
		const headings = this.getAllHeadings().filter(
			(heading) => heading.id && tocHeadingIds.has(heading.id),
		);
		if (headings.length === 0) return null;

		const readingPosition = window.scrollY + this.scrollOffset;
		let activeHeadingId = headings[0].id;

		for (const heading of headings) {
			const headingTop = heading.getBoundingClientRect().top + window.scrollY;
			if (headingTop > readingPosition) break;
			activeHeadingId = heading.id;
		}

		return activeHeadingId;
	}

	private scheduleActiveStateUpdate(): void {
		if (this.activeUpdateFrame !== null) return;
		this.activeUpdateFrame = requestAnimationFrame(() => {
			this.activeUpdateFrame = null;
			this.updateActiveState();
		});
	}

	/**
	 * 更新活动状态
	 */
	public updateActiveState(): void {
		if (!this.tocItems || this.tocItems.length === 0) return;

		// 移除所有活动状态
		this.tocItems.forEach((item) => {
			item.classList.remove("visible");
		});

		const activeHeadingId = this.getActiveHeadingId();

		// 目录只保留一个活动项，避免同屏标题拉出过高的活动框。
		const activeItems = this.tocItems.filter((item) => {
			const headingId = item.dataset.headingId;
			return headingId === activeHeadingId;
		});

		// 添加活动状态
		activeItems.forEach((item) => {
			item.classList.add("visible");
		});

		// 更新活动指示器
		this.updateActiveIndicator(activeItems);
	}

	/**
	 * 更新活动指示器
	 */
	private updateActiveIndicator(activeItems: HTMLElement[]): void {
		const indicator = document.getElementById(this.indicatorId);
		if (!indicator || !this.tocItems.length) return;

		if (activeItems.length === 0) {
			indicator.style.opacity = "0";
			return;
		}

		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		const contentRect = tocContent.getBoundingClientRect();
		const firstActive = activeItems[0];
		const lastActive = activeItems[activeItems.length - 1];

		const firstRect = firstActive.getBoundingClientRect();
		const lastRect = lastActive.getBoundingClientRect();

		const top = firstRect.top - contentRect.top;
		const height = lastRect.bottom - firstRect.top;

		indicator.style.transform = `translateY(${top}px)`;
		indicator.style.height = `${height}px`;
		indicator.style.opacity = "1";

		// 绑定鼠标边缘检测（只绑定一次，监听父容器 toc-content）
		if (!indicator.dataset.edgeBound) {
			indicator.dataset.edgeBound = "1";
			const EDGE_THRESHOLD = 0.28;

			if (tocContent) {
				let edgeRafId: number | null = null;
				this.boundMouseMoveHandler = (e: MouseEvent) => {
					if (indicator.style.opacity === "0") return;
					if (edgeRafId !== null) return;
					edgeRafId = requestAnimationFrame(() => {
						edgeRafId = null;
						const rect = indicator.getBoundingClientRect();
						if (
							e.clientX < rect.left ||
							e.clientX > rect.right ||
							e.clientY < rect.top ||
							e.clientY > rect.bottom
						) {
							delete indicator.dataset.hoverEdge;
							return;
						}

						const x = e.clientX - rect.left;
						const y = e.clientY - rect.top;
						const w = rect.width;
						const h = rect.height;
						const distTop = y / h;
						const distBottom = (h - y) / h;
						const distLeft = x / w;
						const distRight = (w - x) / w;
						const minDist = Math.min(distTop, distBottom, distLeft, distRight);

						if (minDist > EDGE_THRESHOLD) {
							delete indicator.dataset.hoverEdge;
						} else if (minDist === distTop) {
							indicator.dataset.hoverEdge = "top";
						} else if (minDist === distBottom) {
							indicator.dataset.hoverEdge = "bottom";
						} else if (minDist === distLeft) {
							indicator.dataset.hoverEdge = "left";
						} else {
							indicator.dataset.hoverEdge = "right";
						}
					});
				};
				tocContent.addEventListener("mousemove", this.boundMouseMoveHandler);

				this.boundMouseLeaveHandler = () => {
					delete indicator.dataset.hoverEdge;
				};
				tocContent.addEventListener("mouseleave", this.boundMouseLeaveHandler);
			}
		}

		// 自动滚动到活动项
		if (firstActive) {
			this.scrollToActiveItem(firstActive);
		}
	}

	/**
	 * 滚动到活动项
	 */
	private scrollToActiveItem(activeItem: HTMLElement): void {
		if (!activeItem) return;

		const tocContainer = document
			.querySelector(`#${this.contentId}`)
			?.closest(".toc-scroll-container");
		if (!tocContainer) return;

		// 清除之前的定时器
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
		}

		// 使用节流机制
		this.scrollTimeout = window.setTimeout(() => {
			const containerRect = tocContainer.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();

			// 只在元素不在可视区域时才滚动
			const isVisible =
				itemRect.top >= containerRect.top &&
				itemRect.bottom <= containerRect.bottom;

			if (!isVisible) {
				const itemOffsetTop = (activeItem as HTMLElement).offsetTop;
				const containerHeight = tocContainer.clientHeight;
				const itemHeight = activeItem.clientHeight;

				// 计算目标滚动位置，将元素居中显示
				const targetScroll =
					itemOffsetTop - containerHeight / 2 + itemHeight / 2;

				tocContainer.scrollTo({
					top: targetScroll,
					behavior: "smooth",
				});
			}
		}, 100);
	}

	/**
	 * 处理点击事件
	 */
	public handleClick(event: Event): void {
		event.preventDefault();
		const target = event.currentTarget as HTMLAnchorElement;
		const id = decodeURIComponent(
			target.getAttribute("href")?.substring(1) || "",
		);
		const targetElement = document.getElementById(id);

		if (targetElement) {
			const targetTop =
				targetElement.getBoundingClientRect().top +
				window.pageYOffset -
				this.scrollOffset;

			window.scrollTo({
				top: targetTop,
				behavior: "smooth",
			});
		}
	}

	/**
	 * 设置IntersectionObserver
	 */
	public setupObserver(): void {
		const headings = this.getAllHeadings();

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			() => {
				this.scheduleActiveStateUpdate();
			},
			{
				rootMargin: "0px 0px 0px 0px",
				threshold: 0,
			},
		);

		headings.forEach((heading) => {
			if (heading.id) {
				this.observer?.observe(heading);
			}
		});

		this.boundScrollHandler = () => this.scheduleActiveStateUpdate();
		window.addEventListener("scroll", this.boundScrollHandler, {
			passive: true,
		});
	}

	/**
	 * 绑定点击事件
	 */
	public bindClickEvents(): void {
		this.unbindClickEvents();
		this.tocItems.forEach((item) => {
			const handler = this.handleClick.bind(this);
			this.boundClickHandlers.set(item, handler);
			item.addEventListener("click", handler);
		});
	}

	public unbindClickEvents(): void {
		this.boundClickHandlers.forEach((handler, item) => {
			item.removeEventListener("click", handler);
		});
		this.boundClickHandlers.clear();
	}

	/**
	 * 清理
	 */
	public cleanup(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = null;
		}
		if (this.activeUpdateFrame !== null) {
			cancelAnimationFrame(this.activeUpdateFrame);
			this.activeUpdateFrame = null;
		}
		if (this.boundScrollHandler) {
			window.removeEventListener("scroll", this.boundScrollHandler);
			this.boundScrollHandler = null;
		}
		this.unbindClickEvents();
		const tocContent = document.getElementById(this.contentId);
		if (tocContent) {
			if (this.boundMouseMoveHandler) {
				tocContent.removeEventListener("mousemove", this.boundMouseMoveHandler);
				this.boundMouseMoveHandler = null;
			}
			if (this.boundMouseLeaveHandler) {
				tocContent.removeEventListener(
					"mouseleave",
					this.boundMouseLeaveHandler,
				);
				this.boundMouseLeaveHandler = null;
			}
		}
		const indicator = document.getElementById(this.indicatorId);
		if (indicator) {
			delete indicator.dataset.edgeBound;
		}
	}

	/**
	 * 初始化
	 */
	public init(): void {
		this.updateTOCContent();
		this.bindClickEvents();
		this.setupObserver();
		this.updateActiveState();
	}
}
