import React, { useEffect, useState } from "react";
import cockpit from "cockpit";

import { Progress } from "@patternfly/react-core/dist/esm/components/Progress/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Card, CardBody } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { CheckCircleIcon, ExclamationCircleIcon, InProgressIcon, OutlinedClockIcon } from "@patternfly/react-icons";
import { useModelContext } from "../model-context";
import { systemConfigurationService } from "../system-config";
import { loadConfig } from "../config-loader";
import { getSetupInterface, applyNetworkConfiguration, rollbackNetworkConfiguration } from "../services/network";
import { evaluateSkipConditions, SkipResult } from "../services/skip-conditions";
import { writeAttemptedMarker } from "../attempted-marker";
import { SCRIPT_RUN_APPLY_ENROLL } from "../paths";
import { armWatchdog, disarmWatchdog } from "../services/watchdog";
import { testNetworkConnectivity, verifyServiceConnectivity, CancellationSignal } from "../services/connectivity";
import { buildEnrollmentParams, executeEnrollmentScript, finalizeEnrollment } from "../services/enrollment";
import { createSecureTempFile } from "../services/spawn-helpers";
import { Interface } from "../../pkg/networkmanager/interfaces.js";
import { EnrollmentService } from "../types";

type StepStatus = "pending" | "running" | "success" | "failed" | "warning" | "delegated";

interface Step {
    id: string;
    name: string;
    status: StepStatus;
    output?: string;
    deviceUrl?: string;
    isBuiltIn: boolean;
}

interface ResultItem {
    type: "header" | "output";
    content: string;
}

const _ = cockpit.gettext;

// Utility function to escape HTML in user output
const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
};

export const EnrollmentProgressPage: React.FunctionComponent = () => {
    const { model, updateModel, networkManager, cancelEnrollmentRef } = useModelContext();
    const [hasStarted, setHasStarted] = useState(false);
    const [enrollmentServices, setEnrollmentServices] = useState<EnrollmentService[]>([]);
    const [skipResults, setSkipResults] = useState<Record<string, SkipResult>>({});
    const [steps, setSteps] = useState<Step[]>([]);
    const [results, setResults] = useState<ResultItem[]>([]);
    const [singleNic, setSingleNic] = useState(false);
    const networkAppliedRef = React.useRef(false);
    const shouldCancelRef = React.useRef(false);
    const signalRef = React.useRef<CancellationSignal>({ cancelled: false });

    const getStepIcon = (status: StepStatus) => {
        switch (status) {
            case "pending":
                return null;
            case "running":
                return <InProgressIcon className="pf-v6-u-animation-spin" />;
            case "success":
                return <CheckCircleIcon color="var(--pf-v6-global--success-color--100)" />;
            case "delegated":
                return <OutlinedClockIcon color="var(--pf-v6-global--info-color--100)" />;
            case "failed":
            case "warning":
                return <ExclamationCircleIcon color="var(--pf-v6-global--danger-color--100)" />;
            default:
                return null;
        }
    };

    const getStepTextColor = (status: StepStatus) => {
        switch (status) {
            case "success":
                return "var(--pf-v6-global--success-color--100)";
            case "failed":
            case "warning":
                return "var(--pf-v6-global--danger-color--100)";
            case "running":
                return "var(--pf-v6-global--primary-color--100)";
            case "delegated":
                return "var(--pf-v6-global--info-color--100)";
            default:
                return "inherit";
        }
    };

    // Initialize steps based on enrollment configuration
    const initializeSteps = async () => {
        try {
            // Load configuration to get enrollment services and reboot settings
            const config = await loadConfig();
            const configuredServices = config.enrollmentServices || [];

            // Filter to only include services that the user selected
            const selectedServiceIds = model.enrollment.selectedServices || [];
            const servicesToEnroll = configuredServices.filter((service) => selectedServiceIds.includes(service.id));

            setEnrollmentServices(servicesToEnroll);

            // Evaluate skipWhen conditions for each service
            const skipMap: Record<string, SkipResult> = {};
            for (const service of servicesToEnroll) {
                skipMap[service.id] = await evaluateSkipConditions(service.skipWhen);
            }
            setSkipResults(skipMap);

            // Create initial steps
            const initialSteps: Step[] = [
                {
                    id: "apply-config",
                    name: _("Applying configuration changes"),
                    status: "pending",
                    isBuiltIn: true,
                },
                {
                    id: "test-connectivity",
                    name: _("Testing network connectivity"),
                    status: "pending",
                    isBuiltIn: true,
                },
            ];

            // Add enrollment service steps (respecting skipWhen results)
            servicesToEnroll.forEach((service) => {
                const skip = skipMap[service.id];

                if (skip?.action === "skip") {
                    return;
                }

                if (skip?.action === "connectivityOnly") {
                    initialSteps.push({
                        id: `enroll-${service.id}`,
                        name: _("Verifying connectivity to {{serviceName}}").replace("{{serviceName}}", service.name),
                        status: "pending",
                        isBuiltIn: false,
                    });
                    return;
                }

                const isUsingExisting = model.enrollment.useExisting?.[service.id] ?? false;
                initialSteps.push({
                    id: `enroll-${service.id}`,
                    name: isUsingExisting
                        ? _("Restarting {{serviceName}} agent").replace("{{serviceName}}", service.name)
                        : _("Enrolling into {{serviceName}}").replace("{{serviceName}}", service.name),
                    status: "pending",
                    isBuiltIn: false,
                });
            });

            // Add finalize step
            initialSteps.push({
                id: "finalize",
                name: servicesToEnroll.length > 0 ? _("Finalizing enrollment") : _("Finalizing configuration"),
                status: "pending",
                isBuiltIn: true,
            });

            setSteps(initialSteps);
        } catch (error) {
            console.error("Failed to initialize enrollment steps:", error);
            // Fallback to basic steps if initialization fails
            setSteps([
                {
                    id: "apply-config",
                    name: _("Applying configuration changes"),
                    status: "pending",
                    isBuiltIn: true,
                },
                {
                    id: "test-connectivity",
                    name: _("Testing network connectivity"),
                    status: "pending",
                    isBuiltIn: true,
                },
                {
                    id: "finalize",
                    name: _("Finalizing configuration"),
                    status: "pending",
                    isBuiltIn: true,
                },
            ]);
        }
    };

    // Execute a single step
    const executeStep = async (
        stepId: string,
        onOutput?: (output: string) => void
    ): Promise<{ success: boolean; output: string; deviceUrl?: string }> => {
        const step = steps.find((s) => s.id === stepId);
        if (!step) {
            return { success: false, output: "Step not found" };
        }

        // Update step to running
        setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status: "running" } : s)));

        try {
            switch (stepId) {
                case "apply-config":
                    return await applyConfiguration(onOutput);
                case "test-connectivity":
                    return await testConnectivity(onOutput);
                case "finalize":
                    return await finalizeEnrollment(model.hostname.value);
                default:
                    // Handle enrollment service execution
                    if (stepId.startsWith("enroll-")) {
                        const serviceId = stepId.replace("enroll-", "");
                        const service = enrollmentServices.find((s) => s.id === serviceId);
                        if (service) {
                            const skip = skipResults[serviceId];
                            if (skip?.action === "connectivityOnly") {
                                const endpoint = model.enrollment.endpoints[serviceId] || service.endpoint.url;
                                return await verifyServiceConnectivity(
                                    service,
                                    endpoint,
                                    skip,
                                    signalRef.current,
                                    onOutput
                                );
                            }

                            const params = buildEnrollmentParams(model, service);
                            return await executeEnrollmentScript(
                                service.scriptPath,
                                params,
                                signalRef.current,
                                onOutput
                            );
                        }
                    }
                    return { success: false, output: "Unknown step" };
            }
        } catch (error) {
            return { success: false, output: String(error) };
        }
    };

    // Built-in step implementations
    const applyConfiguration = async (
        onOutput?: (output: string) => void
    ): Promise<{ success: boolean; output: string }> => {
        try {
            onOutput?.("• Applying configuration updates...");

            const result = await systemConfigurationService.applySystemConfiguration(networkManager, model);

            if (result.singleNic) {
                setSingleNic(true);
            }
            networkAppliedRef.current = true;
            updateModel("networkInterface", { wifiPassword: null });

            const summary = result.success ? " Success." : " Failed.";

            const indentedResults = result.results.map((r) => `  ${r}`).join("\n");
            const fullOutput = `${summary}\n${indentedResults}`;
            onOutput?.(fullOutput);

            if (result.singleNic) {
                onOutput?.(
                    _(
                        "\n  Note: Network changes applied on the interface serving this browser session. Connection may be interrupted."
                    )
                );
            }

            return {
                success: result.success,
                output: fullOutput,
            };
        } catch (error) {
            const errorMsg = `failed: ${String(error)}`;
            onOutput?.(errorMsg + "\n");
            return {
                success: false,
                output: errorMsg,
            };
        }
    };

    const testConnectivity = async (
        onOutput?: (output: string) => void
    ): Promise<{ success: boolean; output: string }> => {
        const testHost = model.connectivityTestHost || "www.google.com";
        const parentIface = model.networkInterface.selectedInterface || "";
        const vlanId = model.networkInterface.vlanId;
        const iface =
            vlanId !== null && parentIface && model.networkInterface.interfaceType !== "wifi"
                ? `${parentIface}.${vlanId}`
                : parentIface;
        return testNetworkConnectivity(testHost, iface, signalRef.current, onOutput);
    };

    // Detect whether the user is configuring the same NIC that serves this
    // browser session (single-NIC scenario).
    const detectSingleNic = (): boolean => {
        if (!networkManager || !model.networkInterface.selectedInterface) {
            return false;
        }
        const interfaces: Interface[] = networkManager.list_interfaces();
        const setupIface = getSetupInterface(interfaces);
        return setupIface !== null && setupIface === model.networkInterface.selectedInterface;
    };

    // Single-NIC delegation: apply hostname/NTP in-process, create the NM
    // profile without activating, write params files, and hand off network
    // activation + enrollment to a systemd-run transient unit that survives
    // cockpit-bridge exit.
    const executeSingleNicDelegation = async (resultsBuffer: ResultItem[]) => {
        const onOutput = (output: string) => {
            resultsBuffer.push({ type: "output", content: output });
            setResults([...resultsBuffer]);
        };

        // -- apply-config step: hostname + NTP only (skip network) --
        setSteps((prev) => prev.map((s) => (s.id === "apply-config" ? { ...s, status: "running" } : s)));
        resultsBuffer.push({ type: "header", content: _("Applying configuration changes") });
        setResults([...resultsBuffer]);

        try {
            onOutput("Applying hostname and NTP configuration...");
            const configResult = await systemConfigurationService.applySystemConfiguration(networkManager, model, {
                skipNetwork: true,
            });
            if (!configResult.success) {
                onOutput("Failed to apply hostname/NTP configuration");
                setSteps((prev) => prev.map((s) => (s.id === "apply-config" ? { ...s, status: "failed" } : s)));
                await disarmWatchdog();
                updateModel("enrollmentProgress", { executionState: "failed" });
                return;
            }
            configResult.results.forEach((r) => onOutput(`  ${r}`));

            // Create NM profile without activating
            onOutput("Creating network profile (activation deferred)...");
            await applyNetworkConfiguration(networkManager, model, true);
            onOutput(" Network profile created successfully.");

            setSteps((prev) => prev.map((s) => (s.id === "apply-config" ? { ...s, status: "success" } : s)));
        } catch (error) {
            onOutput(`Failed: ${String(error)}`);
            setSteps((prev) => prev.map((s) => (s.id === "apply-config" ? { ...s, status: "failed" } : s)));
            await disarmWatchdog();
            updateModel("enrollmentProgress", { executionState: "failed" });
            return;
        }

        // -- Write enrollment params files for each service (skip services that evaluated to "skip") --
        const enrollmentScriptEntries: { scriptPath: string; paramsFile: string }[] = [];
        const tempFilesToCleanup: string[] = [];
        for (const service of enrollmentServices) {
            const skip = skipResults[service.id];
            if (skip?.action === "skip" || skip?.action === "connectivityOnly") {
                continue;
            }
            const params = buildEnrollmentParams(model, service);
            const pf = await createSecureTempFile(JSON.stringify(params), `.enrollment-${service.id}-`);
            tempFilesToCleanup.push(pf);
            enrollmentScriptEntries.push({ scriptPath: service.scriptPath, paramsFile: pf });
        }

        // -- Write master params JSON for apply-and-enroll.sh --
        const ifaceName = model.networkInterface.selectedInterface || "";
        const vlanId = model.networkInterface.vlanId;
        const isVlan = vlanId !== null && model.networkInterface.interfaceType !== "wifi";
        const effectiveIfaceName = isVlan ? `${ifaceName}.${vlanId}` : ifaceName;
        const masterParams = {
            connectionId: `flightctl-onboarding-${effectiveIfaceName}`,
            interfaceName: ifaceName,
            effectiveIfaceName,
            enrollmentScripts: enrollmentScriptEntries,
            hostname: model.hostname.value,
            connectivityTestHost: model.connectivityTestHost || "www.google.com",
        };
        const masterParamsFile = await createSecureTempFile(JSON.stringify(masterParams), ".onboarding-apply-");
        tempFilesToCleanup.push(masterParamsFile);

        // -- Mark remaining steps as delegated --
        setSteps((prev) =>
            prev.map((s) => {
                if (s.id === "apply-config") {
                    return s;
                }
                return { ...s, status: "delegated" };
            })
        );

        // -- Launch systemd-run transient unit --
        resultsBuffer.push({
            type: "header",
            content: _("Delegating network activation and enrollment to background service"),
        });
        setResults([...resultsBuffer]);

        try {
            await cockpit.spawn(["sudo", SCRIPT_RUN_APPLY_ENROLL, masterParamsFile], { err: "out" });
        } catch (error) {
            console.error("Failed to launch systemd-run:", error);
            onOutput(`Failed to launch background service: ${String(error)}`);
            for (const f of tempFilesToCleanup) {
                cockpit.spawn(["rm", "-f", f], { err: "message" }).catch(() => {});
            }
            setSteps((prev) => prev.map((s) => (s.status === "delegated" ? { ...s, status: "failed" } : s)));
            await disarmWatchdog();
            updateModel("enrollmentProgress", { executionState: "failed" });
            return;
        }

        setSingleNic(true);
        updateModel("enrollmentProgress", { executionState: "success", overallProgress: 100 });
    };

    // Main execution function
    const executeEnrollment = async () => {
        setHasStarted(true);
        shouldCancelRef.current = false;
        signalRef.current = { cancelled: false };
        updateModel("enrollmentProgress", { executionState: "running" });

        await writeAttemptedMarker(model);
        const testHost = model.connectivityTestHost || "www.google.com";
        const watchdogTimeout = model.networkInterface.interfaceType === "wifi" ? 240 : 600;
        await armWatchdog(testHost, watchdogTimeout);

        const resultsBuffer: ResultItem[] = [];

        // Single-NIC: delegate network activation + enrollment to systemd-run
        if (detectSingleNic()) {
            await executeSingleNicDelegation(resultsBuffer);
            return;
        }

        // Multi-NIC: execute all steps inline
        let completedSteps = 0;
        const totalSteps = steps.length;

        for (const step of steps) {
            if (shouldCancelRef.current) {
                console.log("Enrollment cancelled by user");
                await disarmWatchdog();
                updateModel("enrollmentProgress", { executionState: "failed" });
                return;
            }

            const stepHeader: ResultItem = {
                type: "header",
                content: step.name,
            };
            resultsBuffer.push(stepHeader);
            setResults([...resultsBuffer]);

            const onOutput = (output: string) => {
                resultsBuffer.push({
                    type: "output",
                    content: output,
                });
                setResults([...resultsBuffer]);
            };

            const result = await executeStep(step.id, onOutput);

            setSteps((prev) =>
                prev.map((s) => {
                    if (s.id === step.id) {
                        const updatedStep: Step = {
                            ...s,
                            status: result.success ? "success" : "failed",
                            output: result.output,
                        };
                        if (result.deviceUrl) {
                            updatedStep.deviceUrl = result.deviceUrl;
                        }
                        return updatedStep;
                    }
                    return s;
                })
            );

            if (result.success) {
                completedSteps++;
            } else {
                if (networkAppliedRef.current) {
                    try {
                        const rollbackResults = await rollbackNetworkConfiguration();
                        rollbackResults.forEach((msg) => {
                            resultsBuffer.push({ type: "output", content: `  ${msg}` });
                        });
                        setResults([...resultsBuffer]);
                    } catch (rollbackError) {
                        console.error("Network rollback failed:", rollbackError);
                    }
                }
                await disarmWatchdog();
                updateModel("enrollmentProgress", { executionState: "failed" });
                return;
            }

            updateModel("enrollmentProgress", {
                overallProgress: Math.round((completedSteps / totalSteps) * 100),
            });
        }

        updateModel("enrollmentProgress", { executionState: "success" });
    };

    // Note: cleanup and reboot/finish actions are handled by the wizard footer in app.tsx

    // Set up cancellation handler
    useEffect(() => {
        cancelEnrollmentRef.current = () => {
            console.log("Cancellation requested");
            shouldCancelRef.current = true;
            signalRef.current.cancelled = true;

            if (signalRef.current.process) {
                console.log("Aborting running process");
                try {
                    signalRef.current.process.close();
                } catch (error) {
                    console.error("Error aborting process:", error);
                }
                signalRef.current.process = undefined;
            }
        };

        return () => {
            cancelEnrollmentRef.current = null;
        };
    }, [cancelEnrollmentRef]);

    // Auto-start enrollment when component mounts
    useEffect(() => {
        initializeSteps();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (steps.length > 0 && !hasStarted) {
            executeEnrollment();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [steps, hasStarted]);

    const overallProgress =
        steps.length > 0 ? Math.round((steps.filter((s) => s.status === "success").length / steps.length) * 100) : 0;
    const executionState = model.enrollmentProgress.executionState;

    const hasEnrollmentServices = enrollmentServices.length > 0;

    return (
        <Stack hasGutter>
            <StackItem>
                <p>
                    {hasEnrollmentServices
                        ? _("Applying your configuration changes and enrolling the system.")
                        : _("Applying your configuration changes to the system.")}
                </p>
            </StackItem>

            <StackItem>
                <Card>
                    <CardBody>
                        <Title headingLevel="h3" size="md">
                            {_("Overall Progress")}
                        </Title>
                        <Progress
                            value={overallProgress}
                            size="lg"
                            variant={executionState === "failed" ? "danger" : "success"}
                        />

                        <Title headingLevel="h3" size="md" style={{ marginTop: "1rem" }}>
                            {_("Steps")}
                        </Title>
                        <List isPlain>
                            {steps.map((step) => {
                                const serviceId = step.id.startsWith("enroll-") ? step.id.replace("enroll-", "") : null;
                                const service = serviceId ? enrollmentServices.find((s) => s.id === serviceId) : null;

                                return (
                                    <ListItem key={step.id}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ minWidth: "20px" }}>{getStepIcon(step.status)}</span>
                                            <span
                                                style={{
                                                    color: getStepTextColor(step.status),
                                                    flex: 1,
                                                }}
                                            >
                                                {step.name}
                                                {step.deviceUrl && service && (
                                                    <>
                                                        {" ("}
                                                        <a
                                                            href={step.deviceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {_("view system")}
                                                        </a>
                                                        )
                                                    </>
                                                )}
                                            </span>
                                            {step.status === "running" && (
                                                <span
                                                    style={{
                                                        fontStyle: "italic",
                                                        color: "var(--pf-v6-global--Color--200)",
                                                    }}
                                                >
                                                    {_("Running...")}
                                                </span>
                                            )}
                                            {step.status === "delegated" && (
                                                <span
                                                    style={{
                                                        fontStyle: "italic",
                                                        color: "var(--pf-v6-global--info-color--100)",
                                                    }}
                                                >
                                                    {_("Delegated to background service")}
                                                </span>
                                            )}
                                        </div>
                                    </ListItem>
                                );
                            })}
                        </List>

                        {executionState === "failed" && (
                            <Alert variant="danger" title={_("Enrollment failed")}>
                                {_(
                                    "The enrollment process was cancelled or failed. Network changes have been rolled back. Please check the results above and try again."
                                )}
                            </Alert>
                        )}
                        {executionState === "success" && !singleNic && (
                            <Alert variant="success" title={_("Configuration completed successfully")}>
                                {_("Your system has been configured successfully.")}
                            </Alert>
                        )}
                        {executionState === "success" && singleNic && (
                            <Alert variant="info" title={_("Onboarding continues in the background")}>
                                {_(
                                    "Network activation and enrollment have been delegated to a background service. Your browser connection will be lost when the new network configuration is applied. Check /var/log/cockpit-system-onboarding-apply.log on the device for progress."
                                )}
                            </Alert>
                        )}
                    </CardBody>
                </Card>
            </StackItem>

            <StackItem>
                {results.length > 0 && (
                    <pre
                        style={{
                            fontFamily: "monospace",
                            fontSize: "0.9rem",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            backgroundColor: "var(--pf-v6-global--BackgroundColor--dark-100)",
                            padding: "0",
                            overflowY: "auto",
                        }}
                    >
                        {results.map((item, index) => {
                            if (item.type === "header") {
                                return (
                                    <div
                                        key={index}
                                        style={{ fontWeight: "bold", marginTop: index > 0 ? "1rem" : "0" }}
                                    >
                                        {item.content}
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={index} dangerouslySetInnerHTML={{ __html: escapeHtml(item.content) }} />
                                );
                            }
                        })}
                    </pre>
                )}
            </StackItem>
        </Stack>
    );
};
