import { calendarConfig } from "@/config";
import { resolveYearlyDate } from "@/utils/lunar-utils";

// 构建时拉取 timor.tech 中国法定节假日，合并 builtinHolidays，按 dateKey 分桶返回
// 失败时仅返回 builtinHolidays 兜底
// 该 endpoint 在 Astro SSG 期间会被预渲染为静态 JSON

export type HolidayEntry = {
	date: string; // "YYYY-MM-DD"
	name: string;
	isOfficial?: boolean; // 来自 API 的法定节假日
	isWorkday?: boolean; // 调休补班日
	icon?: string;
	source: "api" | "builtin";
	rest?: number; // 假期持续天数（含当天）
};

type TimorHoliday = {
	holiday: boolean; // true=放假, false=补班
	name: string;
	wage?: number;
	date?: string;
	rest?: number;
};

type TimorResponse = {
	code: number;
	holiday: Record<string, TimorHoliday>;
};

async function fetchYear(
	year: number,
	baseUrl: string,
): Promise<HolidayEntry[]> {
	const url = baseUrl.endsWith("/")
		? `${baseUrl}${year}`
		: `${baseUrl}/${year}`;
	try {
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) {
			console.warn(`[holidays] ${url} responded ${res.status}`);
			return [];
		}
		const data = (await res.json()) as TimorResponse;
		if (data.code !== 0 || !data.holiday) {
			console.warn(`[holidays] ${url} returned non-zero code: ${data.code}`);
			return [];
		}
		const entries: HolidayEntry[] = [];
		for (const item of Object.values(data.holiday)) {
			const date =
				item.date ||
				// 兜底：若没 date 字段则跳过
				"";
			if (!date) continue;
			entries.push({
				date,
				name: item.name,
				isOfficial: item.holiday,
				isWorkday: !item.holiday,
				source: "api",
			});
		}
		return entries;
	} catch (err) {
		console.warn(`[holidays] fetch ${url} failed:`, err);
		return [];
	}
}

function expandBuiltinForYear(year: number): HolidayEntry[] {
	const out: HolidayEntry[] = [];
	for (const item of calendarConfig.builtinHolidays) {
		const date = resolveYearlyDate(item.date, year);
		if (!date) continue;
		out.push({
			date,
			name: item.name,
			icon: item.icon,
			source: "builtin",
		});
	}
	return out;
}

export async function GET(): Promise<Response> {
	const { holidayApi, builtinHolidays } = calendarConfig;
	const years = holidayApi.years;

	const all: HolidayEntry[] = [];

	if (holidayApi.enable) {
		const apiResults = await Promise.all(
			years.map((y) => fetchYear(y, holidayApi.url)),
		);
		const apiFlat = apiResults.flat();
		if (apiFlat.length === 0 && !holidayApi.fallbackOnError) {
			console.warn(
				"[holidays] API returned nothing and fallback disabled; result will be empty.",
			);
		}
		all.push(...apiFlat);
	}

	// 内置补充：按每个目标年份展开
	if (builtinHolidays.length > 0) {
		for (const y of years) {
			all.push(...expandBuiltinForYear(y));
		}
	}

	// 按日期排序
	all.sort((a, b) => a.date.localeCompare(b.date));

	return new Response(JSON.stringify(all), {
		headers: { "Content-Type": "application/json" },
	});
}
