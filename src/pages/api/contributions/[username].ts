import type { APIRoute } from 'astro';
import * as fs from 'fs';
import * as path from 'path';

export const prerender = false;

const CACHE_DIR = '.cache/contributions';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
		return meta.expiresAt > Date.now();
	} catch {
		return false;
	}
}

// Read valid cache
function readCache(username: string): any | null {
	if (!isCacheValid(username)) return null;
	try {
		const cachePath = getCachePath(username);
		if (fs.existsSync(cachePath)) {
			return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
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
			return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
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
			cachedAt: new Date().toISOString(),
			expiresAt: Date.now() + CACHE_TTL_MS,
		};
		fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
	} catch (error) {
		console.error(`Failed to write cache for ${username}:`, error);
	}
}

// Parse contribution data from SVG response
function parseContributions(svgText: string, username: string): any {
	const contributionsByDay: Array<{ date: string; count: number }> = [];
	let totalContributions = 0;
	let currentStreak = 0;
	let longestStreak = 0;

	// Parse data from SVG rect elements with data-date and data-count attributes
	const rectPattern = /data-date="(\d{4}-\d{2}-\d{2})" data-count="(\d+)"/g;
	let match;
	let lastDate: Date | null = null;
	let tempStreak = 0;

	while ((match = rectPattern.exec(svgText)) !== null) {
		const dateStr = match[1];
		const count = parseInt(match[2], 10);

		contributionsByDay.push({
			date: dateStr,
			count,
		});

		totalContributions += count;

		// Calculate streaks
		const currentDate = new Date(dateStr);
		if (count > 0) {
			if (lastDate) {
				const dayDiff =
					(currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
				if (dayDiff <= 1) {
					tempStreak++;
				} else {
					longestStreak = Math.max(longestStreak, tempStreak);
					tempStreak = 1;
				}
			} else {
				tempStreak = 1;
			}
			lastDate = currentDate;
		} else {
			longestStreak = Math.max(longestStreak, tempStreak);
			tempStreak = 0;
			lastDate = null;
		}
	}

	longestStreak = Math.max(longestStreak, tempStreak);
	currentStreak = tempStreak;

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
		const response = await fetch(`https://github.com/${username}.contribs`);

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

		const svgText = await response.text();

		// Parse the contribution data
		const data = parseContributions(svgText, username);

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
