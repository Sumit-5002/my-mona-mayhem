import type { APIRoute } from 'astro';
import * as fs from 'fs';
import * as path from 'path';

export const prerender = false;

const CACHE_DIR = '.cache/contributions';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_SCHEMA_VERSION = 2;

interface ContributionDay {
	date: string;
	count: number;
}

interface ParsedContributionData {
	username: string;
	totalContributions: number;
	currentStreak: number;
	longestStreak: number;
	contributionsByDay: ContributionDay[];
	cached: boolean;
	cacheExpiry: number;
}

// Ensure cache directory exists
function ensureCacheDir() {
	if (!fs.existsSync(CACHE_DIR)) {
		fs.mkdirSync(CACHE_DIR, { recursive: true });
	}
}

// Get cache path
function getCachePath(username: string): string {
	const sanitized = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
	return path.join(CACHE_DIR, `${sanitized}.json`);
}

// Get metadata path
function getMetaPath(username: string): string {
	const sanitized = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
	return path.join(CACHE_DIR, `${sanitized}.meta.json`);
}

// Check if cache is valid
function isCacheValid(username: string): boolean {
	const metaPath = getMetaPath(username);
	if (!fs.existsSync(metaPath)) return false;
	try {
		const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
		return meta.expiresAt > Date.now() && meta.schemaVersion === CACHE_SCHEMA_VERSION;
	} catch {
		return false;
	}
}

function isValidCachedData(data: unknown): data is ParsedContributionData {
	if (!data || typeof data !== 'object') return false;
	const obj = data as Record<string, unknown>;
	return (
		typeof obj.username === 'string' &&
		typeof obj.totalContributions === 'number' &&
		typeof obj.currentStreak === 'number' &&
		typeof obj.longestStreak === 'number' &&
		Array.isArray(obj.contributionsByDay)
	);
}

// Read valid cache
function readCache(username: string): any | null {
	if (!isCacheValid(username)) return null;
	try {
		const cachePath = getCachePath(username);
		if (fs.existsSync(cachePath)) {
			const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
			return isValidCachedData(cached) ? cached : null;
		}
	} catch {
		return null;
	}
	return null;
}

// Read stale cache
function readStaleCache(username: string): any | null {
	try {
		const cachePath = getCachePath(username);
		if (fs.existsSync(cachePath)) {
			const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
			return isValidCachedData(cached) ? cached : null;
		}
	} catch {
		return null;
	}
	return null;
}

// Write cache
function writeCache(username: string, data: any): void {
	try {
		ensureCacheDir();
		const cachePath = getCachePath(username);
		const metaPath = getMetaPath(username);

		fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));

		const meta = {
			username,
			schemaVersion: CACHE_SCHEMA_VERSION,
			cachedAt: new Date().toISOString(),
			expiresAt: Date.now() + CACHE_TTL_MS,
		};
		fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
	} catch (error) {
		console.error(`Failed to write cache for ${username}:`, error);
	}
}

function normalizeDate(dateValue: unknown): string | null {
	if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		return dateValue;
	}
	return null;
}

function computeDateFromWeek(firstDayValue: unknown, weekdayValue: unknown): string | null {
	if (typeof firstDayValue !== 'string') return null;
	const firstDay = new Date(firstDayValue);
	if (Number.isNaN(firstDay.getTime())) return null;

	const weekday = typeof weekdayValue === 'number' ? weekdayValue : -1;
	if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;

	const currentDate = new Date(firstDay);
	currentDate.setDate(firstDay.getDate() + weekday);
	return currentDate.toISOString().split('T')[0];
}

function extractFromJsonPayload(data: any): ContributionDay[] {
	const allDays: ContributionDay[] = [];
	const weeks = Array.isArray(data?.weeks) ? data.weeks : [];

	weeks.forEach((week: any) => {
		const days = Array.isArray(week?.contribution_days)
			? week.contribution_days
			: Array.isArray(week?.contributionDays)
				? week.contributionDays
				: [];

		days.forEach((day: any) => {
			const rawCount = day?.count ?? day?.contributionCount ?? 0;
			const count = Number(rawCount);
			if (!Number.isFinite(count) || count < 0) return;

			const explicitDate = normalizeDate(day?.date);
			const computedDate = computeDateFromWeek(week?.first_day ?? week?.firstDay, day?.weekday);
			const date = explicitDate ?? computedDate;
			if (!date) return;

			allDays.push({ date, count: Math.floor(count) });
		});
	});

	// Fallback for flat daily arrays
	if (allDays.length === 0 && Array.isArray(data?.contributions)) {
		data.contributions.forEach((day: any) => {
			const date = normalizeDate(day?.date);
			const count = Number(day?.count ?? day?.contributionCount ?? 0);
			if (!date || !Number.isFinite(count) || count < 0) return;
			allDays.push({ date, count: Math.floor(count) });
		});
	}

	// Deduplicate by date, keeping the latest seen entry.
	const dayMap = new Map<string, number>();
	allDays.forEach(({ date, count }) => dayMap.set(date, count));

	return [...dayMap.entries()]
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

function extractFromSvgPayload(svgText: string): ContributionDay[] {
	const days: ContributionDay[] = [];
	const rectMatches = svgText.match(/<rect\b[^>]*>/g) || [];

	rectMatches.forEach((rect) => {
		const dateMatch = rect.match(/\bdata-date="([^"]+)"/);
		const countMatch = rect.match(/\bdata-count="(\d+)"/);
		if (!dateMatch || !countMatch) return;

		const date = normalizeDate(dateMatch[1]);
		const count = Number(countMatch[1]);
		if (!date || !Number.isFinite(count)) return;
		days.push({ date, count });
	});

	return days.sort((a, b) => a.date.localeCompare(b.date));
}

function computeStreaks(contributionsByDay: ContributionDay[]): { currentStreak: number; longestStreak: number } {
	let longestStreak = 0;
	let rollingStreak = 0;
	let previousDate: Date | null = null;

	contributionsByDay.forEach((day) => {
		const currentDate = new Date(day.date);
		if (Number.isNaN(currentDate.getTime())) return;

		if (day.count > 0) {
			if (previousDate) {
				const dayDiff = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
				rollingStreak = dayDiff === 1 ? rollingStreak + 1 : 1;
			} else {
				rollingStreak = 1;
			}

			longestStreak = Math.max(longestStreak, rollingStreak);
		} else {
			rollingStreak = 0;
		}

		previousDate = currentDate;
	});

	let currentStreak = 0;
	let reversePreviousDate: Date | null = null;
	for (let i = contributionsByDay.length - 1; i >= 0; i--) {
		const day = contributionsByDay[i];
		const currentDate = new Date(day.date);
		if (Number.isNaN(currentDate.getTime())) break;
		if (day.count <= 0) break;

		if (reversePreviousDate) {
			const dayDiff = Math.round((reversePreviousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
			if (dayDiff !== 1) break;
		}

		currentStreak++;
		reversePreviousDate = currentDate;
	}

	return { currentStreak, longestStreak };
}

// Parse contribution data from GitHub responses (.contribs JSON, or SVG fallback)
function parseContributions(rawText: string, username: string): ParsedContributionData {
	const trimmed = rawText.trim();
	let contributionsByDay: ContributionDay[] = [];
	let payloadTotalContributions: number | undefined;

	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		let parsed: any;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new Error('Failed to parse JSON contribution payload');
		}
		contributionsByDay = extractFromJsonPayload(parsed);
		const totalFromPayload = Number(parsed?.total_contributions ?? parsed?.totalContributions);
		if (Number.isFinite(totalFromPayload) && totalFromPayload >= 0) {
			payloadTotalContributions = Math.floor(totalFromPayload);
		}
	} else if (trimmed.startsWith('<')) {
		contributionsByDay = extractFromSvgPayload(trimmed);
	} else {
		throw new Error('Unsupported contribution payload format');
	}

	const totalContributions = payloadTotalContributions ?? contributionsByDay.reduce((sum, day) => sum + day.count, 0);
	const { currentStreak, longestStreak } = computeStreaks(contributionsByDay);

	return {
		username,
		totalContributions,
		currentStreak,
		longestStreak,
		contributionsByDay,
		cached: false,
		cacheExpiry: Date.now() + CACHE_TTL_MS,
	};
}

export const GET: APIRoute = async ({ params }) => {
	const username = params.username as string;

	if (!username || username.length === 0) {
		return new Response(
			JSON.stringify({
				error: 'Username parameter is required',
				username: null,
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// Check for valid cache first
	const cachedData = readCache(username);
	if (cachedData) {
		return new Response(JSON.stringify({ ...cachedData, cached: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		// Fetch from GitHub
		const response = await fetch(`https://github.com/${username}.contribs`, {
			headers: {
				Accept: 'application/json, text/plain, */*',
			},
		});

		if (!response.ok) {
			// Return stale cache if available as fallback
			const staleCache = readStaleCache(username);
			if (staleCache) {
				return new Response(
					JSON.stringify({
						...staleCache,
						cached: true,
						staleFallback: true,
						error: `GitHub returned ${response.status}, showing cached data`,
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			if (response.status === 404) {
				return new Response(
					JSON.stringify({
						error: 'User not found',
						username,
					}),
					{
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			if (response.status === 429) {
				return new Response(
					JSON.stringify({
						error: 'Rate limited by GitHub',
						username,
						retryAfter: 3600,
					}),
					{
						status: 429,
						headers: {
							'Content-Type': 'application/json',
							'Retry-After': '3600',
						},
					}
				);
			}

			return new Response(
				JSON.stringify({
					error: `GitHub error: ${response.status}`,
					username,
				}),
				{
					status: response.status,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		const responseText = await response.text();

		// Parse the contribution data
		const data = parseContributions(responseText, username);

		// Write to cache
		writeCache(username, data);

		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Try to return stale cache as fallback
		const staleCache = readStaleCache(username);
		if (staleCache) {
			return new Response(
				JSON.stringify({
					...staleCache,
					cached: true,
					staleFallback: true,
					error: `Failed to fetch: ${errorMessage}`,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		return new Response(
			JSON.stringify({
				error: `Failed to fetch data: ${errorMessage}`,
				username,
			}),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
};
