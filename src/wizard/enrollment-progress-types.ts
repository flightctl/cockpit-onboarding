export type StepStatus = "pending" | "running" | "success" | "failed" | "warning" | "delegated";

export type ActionResult = "pending" | "info" | "success" | "warning" | "error";

export interface StepAction {
    id: string;
    actionTitle: string;
    result: ActionResult;
}

export const ENROLLMENT_ACTION_IDS = {
    APPLY_CONFIGURATION: "apply-configuration-updates",
    APPLY_HOSTNAME_NTP: "apply-hostname-ntp",
    CREATE_NETWORK_PROFILE: "create-network-profile",
    NETWORK_PROFILE_CREATED: "network-profile-created",
    DNS_RESOLVE: "dns-resolve",
    PING: "ping",
    CREDENTIAL_SELECTION: "credential-selection",
    CONNECT_ENDPOINT: "connect-endpoint",
    ENROLLMENT_SCRIPT: "enrollment-script",
    ENROLLMENT_COMPLETE: "enrollment-complete",
    FINALIZE_MARKER: "finalize-marker",
    SINGLE_NIC_NOTE: "single-nic-note",
    BACKGROUND_CONNECTIVITY_CONFIRMED: "background-connectivity-confirmed",
} as const;

export const CONFIG_ACTION_IDS = {
    HOSTNAME: "config-hostname",
    HOSTNAME_UNCHANGED: "config-hostname-unchanged",
    NETWORK_DEFERRED: "config-network-deferred",
    NETWORK_UNAVAILABLE: "config-network-unavailable",
    NETWORK_NO_INTERFACE: "config-network-no-interface",
    NTP: "config-ntp",
    PROXY: "config-proxy",
    LABELS: "config-labels",
} as const;

export function makeStepAction(id: string, actionTitle: string, result: ActionResult): StepAction {
    return { id, actionTitle, result };
}

export function indexedActionId(prefix: string, index: number): string {
    return `${prefix}-${index}`;
}

export interface ServiceActionsResult {
    success: boolean;
    actions: StepAction[];
}

export interface StepExecutionResult extends ServiceActionsResult {
    deviceUrl?: string;
}

export interface AppliedItems {
    hostname: boolean;
    network: boolean;
    ntp: boolean;
    proxy: boolean;
    labels: boolean;
}

export interface SystemConfigurationApplyResult extends ServiceActionsResult {
    singleNic: boolean;
    appliedItems: AppliedItems;
    originalHostname?: string;
}

export type EnrollmentProgressResultItem =
    | { type: "header"; content: string }
    | { type: "action"; action: StepAction }
    | { type: "output"; content: string };

export type OnStepAction = (action: StepAction) => void;

export function upsertAction(actions: StepAction[], action: StepAction): void {
    const index = actions.findIndex((item) => item.id === action.id);
    if (index >= 0) {
        actions[index] = action;
    } else {
        actions.push(action);
    }
}

/**
 * Adds or updates an action in the results array.
 * This allows us to display the same item as it progresses through time. For example, resolving a DNS name starts with a pending state, then a success/error state.
 *
 * @param results list of items to update
 * @param action action to add or update
 */
export function upsertStepAction(results: EnrollmentProgressResultItem[], action: StepAction): void {
    const index = results.findIndex((item) => item.type === "action" && item.action.id === action.id);
    const entry: EnrollmentProgressResultItem = { type: "action", action };
    if (index >= 0) {
        results[index] = entry;
    } else {
        results.push(entry);
    }
}

/** Collects actions for the return value while forwarding updates to an optional live callback. */
export function createActionEmitter(onAction?: OnStepAction): {
    emit: OnStepAction;
    getActions: () => StepAction[];
} {
    const actions: StepAction[] = [];
    const emit: OnStepAction = (action) => {
        upsertAction(actions, action);
        onAction?.(action);
    };
    return { emit, getActions: () => actions };
}

/** Pause after a step completes so users can read its final output before the next step starts. */
export const ENROLLMENT_STEP_PAUSE_MS = 500;

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
