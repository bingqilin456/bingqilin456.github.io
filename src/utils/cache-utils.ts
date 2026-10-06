export interface CacheEntry<T> {
	timestamp: number;
	value: T;
}

export interface CacheOptions {
	ttl: number;
	key: string;
}

export interface ApiCache<T> {
	get(): T | null;
	set(value: T): void;
	clear(): void;
	fetch(fetcher: () => Promise<T>): Promise<T>;
}

function createStorage(): Storage | null {
	try {
		const testKey = `__cache_test_${Date.now()}`;
		localStorage.setItem(testKey, "1");
		localStorage.removeItem(testKey);
		return localStorage;
	} catch {
		return null;
	}
}

const storage = createStorage();

export function createCache<T>(options: CacheOptions): ApiCache<T> {
	const { key, ttl } = options;

	function read(): T | null {
		if (!storage) return null;
		try {
			const raw = storage.getItem(key);
			if (!raw) return null;
			const entry: CacheEntry<T> = JSON.parse(raw);
			if (Date.now() - entry.timestamp >= ttl) {
				storage.removeItem(key);
				return null;
			}
			return entry.value;
		} catch {
			try {
				storage.removeItem(key);
			} catch {}
			return null;
		}
	}

	function write(value: T): void {
		if (!storage) return;
		try {
			const entry: CacheEntry<T> = { timestamp: Date.now(), value };
			storage.setItem(key, JSON.stringify(entry));
		} catch {
			try {
				storage.removeItem(key);
			} catch {}
		}
	}

	const inFlight = new Map<string, Promise<T>>();

	return {
		get: read,

		set: write,

		clear() {
			if (!storage) return;
			try {
				storage.removeItem(key);
			} catch {}
		},

		async fetch(fetcher: () => Promise<T>): Promise<T> {
			const cached = read();
			if (cached !== null) return cached;

			const cacheKey = key;
			const pending = inFlight.get(cacheKey);
			if (pending) return pending;

			const promise = fetcher()
				.then((data) => {
					write(data);
					inFlight.delete(cacheKey);
					return data;
				})
				.catch((err) => {
					inFlight.delete(cacheKey);
					throw err;
				});

			inFlight.set(cacheKey, promise);
			return promise;
		},
	};
}
