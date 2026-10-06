export const SEARCH_MODAL_TOGGLE_EVENT = "firefly:search-modal-toggle";
const LEGACY_SEARCH_MODAL_TOGGLE_EVENT = "toggle-search-modal";

type SearchModalController = {
	toggle: () => void;
};

type SearchModalWindow = Window & {
	__fireflySearchModalController?: SearchModalController;
	__fireflySearchModalPendingToggle?: boolean;
	__fireflySearchModalUnbind?: () => void;
};

function getWindow(windowRef?: Window): SearchModalWindow | null {
	if (windowRef) return windowRef as SearchModalWindow;
	if (typeof window === "undefined") return null;
	return window as SearchModalWindow;
}

export function requestSearchModalToggle(windowRef?: Window): void {
	const targetWindow = getWindow(windowRef);
	if (!targetWindow) return;

	const controller = targetWindow.__fireflySearchModalController;
	if (controller) {
		controller.toggle();
		return;
	}

	targetWindow.__fireflySearchModalPendingToggle = true;
	targetWindow.dispatchEvent(new CustomEvent(SEARCH_MODAL_TOGGLE_EVENT));
}

export function bindSearchModalController(
	windowRef: Window,
	controller: SearchModalController,
): () => void {
	const targetWindow = getWindow(windowRef);
	if (!targetWindow) return () => {};

	targetWindow.__fireflySearchModalUnbind?.();
	targetWindow.__fireflySearchModalController = controller;

	const handleToggle = () => controller.toggle();
	targetWindow.addEventListener(SEARCH_MODAL_TOGGLE_EVENT, handleToggle);
	targetWindow.addEventListener(LEGACY_SEARCH_MODAL_TOGGLE_EVENT, handleToggle);

	if (targetWindow.__fireflySearchModalPendingToggle) {
		targetWindow.__fireflySearchModalPendingToggle = false;
		queueMicrotask(() => {
			if (targetWindow.__fireflySearchModalController === controller) {
				controller.toggle();
			}
		});
	}

	const unbind = () => {
		targetWindow.removeEventListener(SEARCH_MODAL_TOGGLE_EVENT, handleToggle);
		targetWindow.removeEventListener(
			LEGACY_SEARCH_MODAL_TOGGLE_EVENT,
			handleToggle,
		);
		if (targetWindow.__fireflySearchModalController === controller) {
			delete targetWindow.__fireflySearchModalController;
		}
		if (targetWindow.__fireflySearchModalUnbind === unbind) {
			delete targetWindow.__fireflySearchModalUnbind;
		}
	};

	targetWindow.__fireflySearchModalUnbind = unbind;
	return unbind;
}
