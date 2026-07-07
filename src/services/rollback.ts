import cockpit from "cockpit";
import { SCRIPT_ROLLBACK } from "../paths";
import { createSecureTempFile } from "./spawn-helpers";
import {
    createActionEmitter,
    type OnStepAction,
    type StepAction,
    type StepExecutionResult,
} from "../wizard/enrollment-progress-types";

export interface RollbackManifest {
    hostname?: { original: string };
    network?: { connectionId: string };
    ntp?: boolean;
    proxy?: boolean;
    labels?: boolean;
}

export async function executeRollbackScript(
    manifest: RollbackManifest,
    onAction?: OnStepAction
): Promise<StepExecutionResult> {
    const { emit, getActions } = createActionEmitter(onAction);
    let paramsFile = "";

    let streamLineIndex = 0;
    let streamBuffer = "";
    let currentStepAction: StepAction | undefined;

    const processLine = (line: string) => {
        if (line.startsWith("STEP:")) {
            currentStepAction = {
                id: `rollback-stream-${streamLineIndex++}`,
                actionTitle: line.slice(5).trim(),
                result: "pending",
            };
            emit(currentStepAction);
        } else if (line.startsWith("OK:")) {
            const title = line.slice(3).trim();
            if (currentStepAction) {
                emit({ ...currentStepAction, actionTitle: title, result: "success" });
                currentStepAction = undefined;
            } else {
                emit({ id: `rollback-stream-${streamLineIndex++}`, actionTitle: title, result: "success" });
            }
        } else if (line.startsWith("ERROR:")) {
            const title = line.slice(6).trim();
            if (currentStepAction) {
                emit({ ...currentStepAction, actionTitle: title, result: "error" });
                currentStepAction = undefined;
            } else {
                emit({ id: `rollback-stream-${streamLineIndex++}`, actionTitle: title, result: "error" });
            }
        } else if (line.startsWith("INFO:")) {
            emit({ id: `rollback-stream-${streamLineIndex++}`, actionTitle: line.slice(5).trim(), result: "info" });
        }
    };

    const flushStreamBuffer = () => {
        const trailing = streamBuffer.trim();
        if (trailing) {
            processLine(trailing);
        }
        streamBuffer = "";
    };

    try {
        paramsFile = await createSecureTempFile(JSON.stringify(manifest), ".rollback-params-");

        const proc = cockpit.spawn(["sudo", SCRIPT_ROLLBACK, paramsFile], {
            err: "out",
        });

        proc.stream((data) => {
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

        await proc;
        flushStreamBuffer();
        return { success: true, actions: getActions() };
    } catch {
        flushStreamBuffer();

        if (currentStepAction) {
            emit({ ...currentStepAction, result: "error" });
            currentStepAction = undefined;
        }

        if (!getActions().some((a) => a.result === "error")) {
            emit({
                id: `rollback-stream-${streamLineIndex++}`,
                actionTitle: "Rollback script failed",
                result: "error",
            });
        }
        return { success: false, actions: getActions() };
    } finally {
        if (paramsFile) {
            cockpit.spawn(["rm", "-f", paramsFile], { err: "message" }).catch(() => {});
        }
    }
}
