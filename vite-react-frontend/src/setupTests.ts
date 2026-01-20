import '@testing-library/jest-dom/vitest';

// jsdom does not implement EventSource; our UI uses it for simulation progress.
// Provide a minimal stub so tests that start simulations can mount safely.
if (typeof (globalThis as any).EventSource === 'undefined') {
	class MockEventSource {
		url: string;
		withCredentials?: boolean;
		readyState = 0;
		onopen: ((ev: Event) => any) | null = null;
		onmessage: ((ev: MessageEvent) => any) | null = null;
		onerror: ((ev: Event) => any) | null = null;

		constructor(url: string, init?: { withCredentials?: boolean }) {
			this.url = url;
			this.withCredentials = init?.withCredentials;
		}

		close() {
			this.readyState = 2;
		}

		addEventListener(_type: string, _listener: any) {
			// no-op
		}

		removeEventListener(_type: string, _listener: any) {
			// no-op
		}

		dispatchEvent(_event: Event) {
			return false;
		}
	}

	(globalThis as any).EventSource = MockEventSource as any;
}
