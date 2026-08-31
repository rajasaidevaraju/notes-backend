
interface LanState {
    isEnabled: boolean;
    expiryPayload: number | null;
}

let state: LanState = {
    isEnabled: false,
    expiryPayload: null
};

const DURATION_MS = 15 * 60 * 1000;

export const getLanStatus = () => {
    if (state.isEnabled && state.expiryPayload && Date.now() > state.expiryPayload) {
        disableLan();
    }

    return {
        enabled: state.isEnabled,
        remainingMs: state.expiryPayload ? Math.max(0, state.expiryPayload - Date.now()) : 0
    };
};

export const enableLan = () => {
    state.isEnabled = true;
    state.expiryPayload = Date.now() + DURATION_MS;
};

export const disableLan = () => {
    state.isEnabled = false;
    state.expiryPayload = null;
};
