import cockpit from "cockpit";
import type { OnStepAction, StepAction } from "../wizard/enrollment-progress-types";

/**
 * Parses the stdout streaming protocol used by shell scripts.
 *
 * Protocol prefixes: STEP: OK: ERROR: INFO:
 * See packaging/system-onboarding.d/flightctl-enroll.sh for the full spec.
 */
export function createStreamParser(
    idPrefix: string,
    emit: OnStepAction
): {
    flush: () => void;
    attach: (
        proc: { stream: (cb: (data: string) => void) => void },
        onData?: (data: string) => void
    ) => void;
    markCurrentStepError: () => void;
    nextId: () => string;
} {
    let streamLineIndex = 0;
    let streamBuffer = "";
    let currentStepAction: StepAction | undefined;

    let lastEmittedAction: StepAction | undefined;

    const processLine = (line: string) => {
        if (line.startsWith("STEP:")) {
            currentStepAction = {
                id: `${idPrefix}-${streamLineIndex++}`,
                actionTitle: line.slice(5).trim(),
                result: "pending",
            };
            lastEmittedAction = currentStepAction;
            emit(currentStepAction);
        } else if (line.startsWith("OK:")) {
            const title = line.slice(3).trim();
            if (currentStepAction) {
                lastEmittedAction = { ...currentStepAction, actionTitle: title, result: "success" };
                emit(lastEmittedAction);
                currentStepAction = undefined;
            } else {
                lastEmittedAction = { id: `${idPrefix}-${streamLineIndex++}`, actionTitle: title, result: "success" };
                emit(lastEmittedAction);
            }
        } else if (line.startsWith("ERROR:")) {
            const title = line.slice(6).trim();
            if (currentStepAction) {
                lastEmittedAction = { ...currentStepAction, actionTitle: title, result: "error" };
                emit(lastEmittedAction);
                currentStepAction = undefined;
            } else {
                lastEmittedAction = { id: `${idPrefix}-${streamLineIndex++}`, actionTitle: title, result: "error" };
                emit(lastEmittedAction);
            }
        } else if (line.startsWith("INFO:")) {
            lastEmittedAction = { id: `${idPrefix}-${streamLineIndex++}`, actionTitle: line.slice(5).trim(), result: "info" };
            emit(lastEmittedAction);
        } else if (lastEmittedAction) {
            const existing = lastEmittedAction.detail ?? "";
            lastEmittedAction = { ...lastEmittedAction, detail: existing ? `${existing}\n${line}` : line };
            emit(lastEmittedAction);
        }
    };

    const flush = () => {
        const trailing = streamBuffer.trim();
        if (trailing) {
            processLine(trailing);
        }
        streamBuffer = "";
    };

    const attach = (
        proc: { stream: (cb: (data: string) => void) => void },
        onData?: (data: string) => void
    ) => {
        proc.stream((data) => {
            onData?.(data);
            streamBuffer += data;
            const parts = streamBuffer.split("\n");
            streamBuffer = parts.pop() ?? "";
            for (const part of parts) {
                const line = part.trim();
                if (line) {
                    processLine(line);
                }
            }
        });
    };

    const markCurrentStepError = () => {
        if (currentStepAction) {
            emit({ ...currentStepAction, result: "error" });
            currentStepAction = undefined;
        }
    };

    const nextId = () => `${idPrefix}-${streamLineIndex++}`;

    return { flush, attach, markCurrentStepError, nextId };
}

/**
 * Create a temp file with 0600 permissions atomically via mktemp, then write
 * content into the already-restricted file. This avoids TOCTOU races where
 * a file is created world-readable and then chmod'd.
 */
export async function createSecureTempFile(content: string, prefix = ".params-"): Promise<string> {
    const tmpPath = (await cockpit.spawn(["mktemp", `/tmp/${prefix}XXXXXX.json`], { err: "message" })).trim();
    await cockpit.file(tmpPath).replace(content);
    return tmpPath;
}

export async function spawnWithParamsFile(
    scriptPath: string,
    params: unknown,
    tmpPrefix = ".params-"
): Promise<string> {
    const tmpPath = await createSecureTempFile(JSON.stringify(params), tmpPrefix);
    try {
        return await cockpit.spawn(["sudo", scriptPath, tmpPath], { err: "message" });
    } finally {
        cockpit.spawn(["rm", "-f", tmpPath], { err: "message" }).catch(() => {});
    }
}
