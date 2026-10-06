import { Lunar, Solar } from "lunar-typescript";
import type { SolarOrLunarDate } from "@/types/config";

// 公历 ↔ 农历 工具封装
// 用于把农历"月日"对（每年重复）展开为当年的公历日期

/**
 * 将公历日期（YYYY-MM-DD）的农历日字符串返回，例如 "初一"、"廿一"
 * 用于日历单元格右上角显示
 */
export function getLunarDayChinese(
	year: number,
	month: number,
	day: number,
): string {
	try {
		return Solar.fromYmd(year, month, day).getLunar().getDayInChinese();
	} catch {
		return "";
	}
}

/**
 * 将公历日期（YYYY-MM-DD）的农历月日完整字符串返回，例如 "八月十五"
 * 用于事件副标题显示
 */
export function getLunarMonthDayChinese(
	year: number,
	month: number,
	day: number,
): string {
	try {
		const lunar = Solar.fromYmd(year, month, day).getLunar();
		return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
	} catch {
		return "";
	}
}

/**
 * 把一个农历"月日"（每年重复）展开为指定公历年份的实际公历日期
 * 返回 "YYYY-MM-DD"，转换失败返回 null
 */
export function lunarMonthDayToSolar(
	solarYear: number,
	lunarMonth: number,
	lunarDay: number,
): string | null {
	try {
		// 农历年份按对应公历年取（农历年份通常与公历年份相近，月份在春节前的农历归属上一公历年）
		// 这里采用简化策略：直接尝试当年农历，若失败再尝试上一年
		const lunar = Lunar.fromYmd(solarYear, lunarMonth, lunarDay);
		const solar = lunar.getSolar();
		// 若产生的公历日期落在 solarYear，直接返回；否则尝试相邻年份
		if (solar.getYear() === solarYear) {
			return solar.toYmd();
		}
		// 农历年与公历年错位时（如农历正月在公历 2 月），尝试用下一年的农历
		const lunarNext = Lunar.fromYmd(solarYear + 1, lunarMonth, lunarDay);
		const solarNext = lunarNext.getSolar();
		if (solarNext.getYear() === solarYear) {
			return solarNext.toYmd();
		}
		// 退回 solarYear 内最接近的（春节前的腊月）— 用 solarYear - 1
		const lunarPrev = Lunar.fromYmd(solarYear - 1, lunarMonth, lunarDay);
		const solarPrev = lunarPrev.getSolar();
		if (solarPrev.getYear() === solarYear) {
			return solarPrev.toYmd();
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * 把 SolarOrLunarDate 展开为指定公历年份的实际日期 "YYYY-MM-DD"
 * type=solar 直接拼接；type=lunar 走农历换算
 */
export function resolveYearlyDate(
	date: SolarOrLunarDate,
	solarYear: number,
): string | null {
	if (date.type === "solar") {
		// 跳过非法日期组合（如 2 月 30 日）
		const ymd = `${solarYear}-${String(date.month).padStart(2, "0")}-${String(
			date.day,
		).padStart(2, "0")}`;
		const d = new Date(ymd);
		if (
			d.getFullYear() === solarYear &&
			d.getMonth() + 1 === date.month &&
			d.getDate() === date.day
		) {
			return ymd;
		}
		return null;
	}
	return lunarMonthDayToSolar(solarYear, date.month, date.day);
}
