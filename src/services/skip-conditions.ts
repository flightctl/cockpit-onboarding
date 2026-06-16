/**
 * Evaluate skipWhen conditions for enrollment services.
 *
 * Each condition specifies file-existence checks and an action to take
 * when the condition is met. Conditions are evaluated in order; the
 * first match wins.
 */

import cockpit from "cockpit";
import { SkipWhenCondition } from "../types";

export type SkipResult =
    | { action: "none" }
    | { action: "skip"; reason: string }
    | { action: "connectivityOnly"; reason: string };

async function fileExists(path: string): Promise<boolean> {
    try {
        await cockpit.spawn(["test", "-f", path], { err: "ignore" });
        return true;
    } catch {
        return false;
    }
}

async function evaluateSingleCondition(condition: SkipWhenCondition): Promise<boolean> {
    if (condition.allPathsExist && condition.allPathsExist.length > 0) {
        const results = await Promise.all(condition.allPathsExist.map(fileExists));
        if (!results.every(Boolean)) {
            return false;
        }
    }

    if (condition.anyPathExists && condition.anyPathExists.length > 0) {
        const results = await Promise.all(condition.anyPathExists.map(fileExists));
        if (!results.some(Boolean)) {
            return false;
        }
    }

    // If neither allPathsExist nor anyPathExists was specified, the
    // condition is vacuously true (unconditional skip).
    return true;
}

/**
 * Evaluate an ordered list of skipWhen conditions. Returns the action
 * from the first condition whose file-existence checks pass, or
 * { action: 'none' } if no condition matches.
 */
export async function evaluateSkipConditions(conditions: SkipWhenCondition[] | undefined): Promise<SkipResult> {
    if (!conditions || conditions.length === 0) {
        return { action: "none" };
    }

    for (const condition of conditions) {
        const matched = await evaluateSingleCondition(condition);
        if (matched) {
            return { action: condition.action, reason: condition.reason };
        }
    }

    return { action: "none" };
}
