import cockpit from "cockpit";
import { SCRIPT_ROLLBACK } from "../paths";
import { createSecureTempFile, createStreamParser } from "./spawn-helpers";
import {
    createActionEmitter,
    type OnStepAction,
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
    const parser = createStreamParser("rollback-stream", emit);

    try {
        paramsFile = await createSecureTempFile(JSON.stringify(manifest), ".rollback-params-");

        const proc = cockpit.spawn(["sudo", SCRIPT_ROLLBACK, paramsFile], {
            err: "out",
        });

        parser.attach(proc);

        await proc;
        parser.flush();
        return { success: true, actions: getActions() };
    } catch {
        parser.flush();
        parser.markCurrentStepError();

        if (!getActions().some((a) => a.result === "error")) {
            emit({
                id: parser.nextId(),
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
