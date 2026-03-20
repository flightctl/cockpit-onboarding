import React, { useEffect, useState } from 'react';
import cockpit from 'cockpit';

import { Progress } from "@patternfly/react-core/dist/esm/components/Progress/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Card, CardBody } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { CheckCircleIcon, ExclamationCircleIcon, InProgressIcon } from '@patternfly/react-icons';
import { useModelContext } from '../model-context';
import { systemConfigurationService } from '../system-config';
import { loadConfig } from '../config-loader';
import { EnrollmentService } from '../types';

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'warning';

interface Step {
    id: string;
    name: string;
    status: StepStatus;
    output?: string;
    deviceUrl?: string;
    isBuiltIn: boolean;
}

interface ResultItem {
    type: 'header' | 'output';
    content: string;
}

const _ = cockpit.gettext;

// Utility function to escape HTML in user output
const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

export const EnrollmentProgressPage: React.FunctionComponent = () => {
    const { model, updateModel, networkManager, cancelEnrollmentRef } = useModelContext();
    const [hasStarted, setHasStarted] = useState(false);
    const [enrollmentServices, setEnrollmentServices] = useState<EnrollmentService[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [results, setResults] = useState<ResultItem[]>([]);
    const [autoReboot, setAutoReboot] = useState(false);
    const [rebootCountdown, setRebootCountdown] = useState<number | null>(null);
    const shouldCancelRef = React.useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runningProcessRef = React.useRef<any>(null);

    const getStepIcon = (status: StepStatus) => {
        switch (status) {
            case 'pending': return null;
            case 'running': return <InProgressIcon className="pf-v6-u-animation-spin" />;
            case 'success': return <CheckCircleIcon color="var(--pf-v6-global--success-color--100)" />;
            case 'failed':
            case 'warning': return <ExclamationCircleIcon color="var(--pf-v6-global--danger-color--100)" />;
            default: return null;
        }
    };

    const getStepTextColor = (status: StepStatus) => {
        switch (status) {
            case 'success': return 'var(--pf-v6-global--success-color--100)';
            case 'failed':
            case 'warning': return 'var(--pf-v6-global--danger-color--100)';
            case 'running': return 'var(--pf-v6-global--primary-color--100)';
            default: return 'inherit';
        }
    };

    // Initialize steps based on enrollment configuration
    const initializeSteps = async () => {
        try {
            // Load configuration to get enrollment services and reboot settings
            const config = await loadConfig();
            const configuredServices = config.enrollmentServices || [];
            setAutoReboot(config.autoReboot === true);

            // Filter to only include services that the user selected
            const selectedServiceIds = model.enrollment.selectedServices || [];
            const servicesToEnroll = configuredServices.filter(service =>
                selectedServiceIds.includes(service.id)
            );

            setEnrollmentServices(servicesToEnroll);

            // Create initial steps
            const initialSteps: Step[] = [
                {
                    id: 'apply-config',
                    name: _("Applying configuration changes"),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'test-connectivity',
                    name: _("Testing network connectivity"),
                    status: 'pending',
                    isBuiltIn: true
                }
            ];

            // Add enrollment service steps
            servicesToEnroll.forEach((service) => {
                initialSteps.push({
                    id: `enroll-${service.id}`,
                    name: _("Enrolling into {{serviceName}}").replace('{{serviceName}}', service.name),
                    status: 'pending',
                    isBuiltIn: false
                });
            });

            // Add finalize step
            initialSteps.push({
                id: 'finalize',
                name: servicesToEnroll.length > 0 ? _("Finalizing enrollment") : _("Finalizing configuration"),
                status: 'pending',
                isBuiltIn: true
            });

            setSteps(initialSteps);
        } catch (error) {
            console.error('Failed to initialize enrollment steps:', error);
            // Fallback to basic steps if initialization fails
            setSteps([
                {
                    id: 'apply-config',
                    name: _("Applying configuration changes"),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'test-connectivity',
                    name: _("Testing network connectivity"),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'finalize',
                    name: _("Finalizing configuration"),
                    status: 'pending',
                    isBuiltIn: true
                }
            ]);
        }
    };

    // Execute a single step
    const executeStep = async (stepId: string, onOutput?: (output: string) => void): Promise<{ success: boolean; output: string; deviceUrl?: string }> => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return { success: false, output: 'Step not found' };

        // Update step to running
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'running' } : s));

        try {
            switch (stepId) {
                case 'apply-config':
                    return await applyConfiguration(onOutput);
                case 'test-connectivity':
                    return await testConnectivity(onOutput);
                case 'finalize':
                    return await finalizeEnrollment();
                default:
                    // Handle enrollment service execution
                    if (stepId.startsWith('enroll-')) {
                        const serviceId = stepId.replace('enroll-', '');
                        const service = enrollmentServices.find(s => s.id === serviceId);
                        if (service) {
                            // Get endpoint (user override or default)
                            const endpoint = model.enrollment.endpoints[serviceId] || service.endpoint.url;

                            // Get credentials
                            const credentials = model.enrollment.credentials[serviceId] || {};
                            const credentialsJson = JSON.stringify(credentials);

                            return await executeEnrollmentScript(
                                service.scriptPath,
                                service.id,
                                service.name,
                                endpoint,
                                credentialsJson,
                                onOutput
                            );
                        }
                    }
                    return { success: false, output: 'Unknown step' };
            }
        } catch (error) {
            return { success: false, output: String(error) };
        }
    };

    // Built-in step implementations
    const applyConfiguration = async (onOutput?: (output: string) => void): Promise<{ success: boolean; output: string }> => {
        try {
            onOutput?.('• Applying configuration updates...');

            // Use SystemConfigurationService to apply all configuration
            const result = await systemConfigurationService.applySystemConfiguration(networkManager, model);

            const summary = result.success
                ? ' Success.'
                : ' Failed.';

            const indentedResults = result.results.map(r => `  ${r}`).join('\n');
            const fullOutput = `${summary}\n${indentedResults}`;
            onOutput?.(fullOutput);

            return {
                success: result.success,
                output: fullOutput
            };
        } catch (error) {
            const errorMsg = `failed: ${String(error)}`;
            onOutput?.(errorMsg + '\n');
            return {
                success: false,
                output: errorMsg
            };
        }
    };

    const testConnectivity = async (onOutput?: (output: string) => void): Promise<{ success: boolean; output: string }> => {
        // Test basic network connectivity
        try {
            const testHost = 'www.google.com';

            // Approach 1: Use getent hosts to check DNS resolution
            try {
                onOutput?.(`• Attempting to lookup ${testHost} from DNS...`);
                const dnsProc = cockpit.spawn(['getent', 'hosts', testHost], { err: 'ignore' });
                runningProcessRef.current = dnsProc;
                await dnsProc;
                runningProcessRef.current = null;
                onOutput?.(` Success.`);
            } catch (dnsError) {
                runningProcessRef.current = null;

                // Extract error details
                let errorDetail = '';
                if (dnsError && typeof dnsError === 'object') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const err = dnsError as any;
                    if (err.exit_status !== undefined) {
                        errorDetail = ` (exit status ${err.exit_status})`;
                    }
                }

                const errorMsg = ` Failed${errorDetail}.\n  Please check network configuration.`;
                onOutput?.(errorMsg);
                return { success: false, output: errorMsg };
            }

            // Approach 2: Use timeout command with ping for better control
            try {
                onOutput?.(`• Pinging ${testHost} to check connectivity...`);
                const pingProc = cockpit.spawn(['timeout', '10', 'ping', '-c', '1', '-W', '5', testHost], { err: 'ignore' });
                runningProcessRef.current = pingProc;
                await pingProc;
                runningProcessRef.current = null;
                onOutput?.(` Success.`);
                return { success: true, output: "success" };
            } catch (pingError) {
                runningProcessRef.current = null;
                console.warn(`Ping failed for ${testHost}:`, pingError);
                // Fall back to basic success if DNS worked
                const warningMsg = ` Failed.\n  However, pings may be simply blocked by firewall.`;
                onOutput?.(warningMsg);
                return { success: true, output: warningMsg };
            }
        } catch (error) {
            runningProcessRef.current = null;
            console.error('Connectivity test error:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            const fullErrorMsg = `Network connectivity test failed: ${errorMsg}`;
            onOutput?.(fullErrorMsg);
            return { success: false, output: fullErrorMsg };
        }
    };

    const executeEnrollmentScript = async (scriptPath: string, serviceId: string, serviceName: string, endpoint: string, credentialsJson: string, onOutput?: (output: string) => void): Promise<{ success: boolean; output: string; deviceUrl?: string }> => {
        // Capture output as it streams
        let capturedOutput = '';

        try {
            console.log(`Executing enrollment script: ${scriptPath}`);
            console.log('Service:', serviceName, `(${serviceId})`);
            console.log('Endpoint:', endpoint);

            onOutput?.(`Executing enrollment script for ${serviceName}...\n`);

            const environ = [
                `ENROLLMENT_SERVICE_ID=${serviceId}`,
                `ENROLLMENT_SERVICE_NAME=${serviceName}`,
                `ENROLLMENT_ENDPOINT=${endpoint}`,
                `ENROLLMENT_CREDENTIALS_JSON=${credentialsJson}`,
                `ENROLLMENT_HOSTNAME=${model.hostname.value}`,
                `ENROLLMENT_INTERFACE=${model.networkInterface.selectedInterface || ''}`,
            ];

            const proc = cockpit.spawn(['/bin/bash', scriptPath], {
                err: 'out',
                environ
            });
            runningProcessRef.current = proc;

            // Capture stdout/stderr as it arrives and stream it to UI
            proc.stream((data) => {
                capturedOutput += data;
                onOutput?.(data);
            });

            await proc;
            runningProcessRef.current = null;
            console.log(`Script ${scriptPath} completed successfully`);

            // Parse DEVICE_URL from output (enrollment-api.md specification)
            const deviceUrlMatch = capturedOutput.match(/^DEVICE_URL:\s*(.+)$/m);
            if (deviceUrlMatch) {
                const url = deviceUrlMatch[1].trim();
                // Validate URL format
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    console.log(`Parsed device URL: ${url}`);
                    return {
                        success: true,
                        output: capturedOutput || 'Script completed successfully',
                        deviceUrl: url
                    };
                }
            }

            return {
                success: true,
                output: capturedOutput || 'Script completed successfully'
            };
        } catch (error) {
            runningProcessRef.current = null;
            console.error(`Script ${scriptPath} failed:`, error);

            // Build error message from captured output and exit status
            let errorMsg = '';

            // First, include any captured output (which may contain error messages)
            if (capturedOutput.trim()) {
                errorMsg = capturedOutput.trim();
            }

            // Extract error information from ProcessError
            if (error && typeof error === 'object') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const processError = error as any;

                // Add exit status information
                if (processError.exit_status !== undefined) {
                    const statusMsg = `Script exited with status ${processError.exit_status}`;
                    errorMsg = errorMsg ? `${errorMsg}\n${statusMsg}` : statusMsg;
                }
            }

            onOutput?.(errorMsg || 'Script failed with unknown error');
            return { success: false, output: errorMsg || 'Script failed with unknown error' };
        }
    };

    const finalizeEnrollment = async (): Promise<{ success: boolean; output: string }> => {
        const outputs: string[] = [];

        // Create marker file to prevent re-running onboarding
        try {
            const markerDir = '/var/lib/cockpit-system-onboarding';
            const markerPath = `${markerDir}/.onboarding-complete`;
            const timestamp = new Date().toISOString();
            const markerContent = JSON.stringify({
                completedAt: timestamp,
                hostname: model.hostname.value,
            });

            // Create directory and marker file (state dir is owned by onboarding user)
            await cockpit.spawn(
                ['mkdir', '-p', markerDir],
                { err: 'message' }
            );
            await cockpit.spawn(
                ['bash', '-c', `echo '${markerContent.replace(/'/g, "'\\''")}' > ${markerPath}`],
                { err: 'message' }
            );
            outputs.push('✓ Onboarding completion marker created');
        } catch (error) {
            console.error('Failed to create marker file:', error);
            outputs.push(`✗ Failed to create completion marker: ${String(error)}`);
            return { success: false, output: outputs.join('\n') };
        }

        // Run cleanup script if it exists (allowed via sudoers)
        try {
            const cleanupScript = '/usr/libexec/cockpit-system-onboarding/cleanup-onboarding.sh';
            await cockpit.spawn(
                ['sudo', cleanupScript],
                { err: 'out' }
            );
            outputs.push('✓ Post-onboarding cleanup completed');
        } catch (error) {
            // Cleanup failures are non-fatal - the marker file is already created
            console.warn('Cleanup script failed or not found:', error);
            outputs.push('- Cleanup script not available or failed (non-critical)');
        }

        return { success: true, output: outputs.join('\n') };
    };

    // Main execution function
    const executeEnrollment = async () => {
        setHasStarted(true);
        shouldCancelRef.current = false; // Reset cancel flag
        updateModel('enrollmentProgress', { executionState: 'running' });

        let completedSteps = 0;
        const totalSteps = steps.length;
        const resultsBuffer: ResultItem[] = [];

        for (const step of steps) {
            // Check if cancellation was requested
            if (shouldCancelRef.current) {
                console.log('Enrollment cancelled by user');
                updateModel('enrollmentProgress', { executionState: 'failed' });
                return;
            }

            // Add step header to results
            const stepHeader: ResultItem = {
                type: 'header',
                content: step.name
            };
            resultsBuffer.push(stepHeader);
            setResults([...resultsBuffer]);

            // Create callback to stream output in real-time
            const onOutput = (output: string) => {
                resultsBuffer.push({
                    type: 'output',
                    content: output
                });
                setResults([...resultsBuffer]);
            };

            const result = await executeStep(step.id, onOutput);

            // Update step status and store deviceUrl
            setSteps(prev => prev.map(s => {
                if (s.id === step.id) {
                    const updatedStep: Step = {
                        ...s,
                        status: result.success ? 'success' : 'failed',
                        output: result.output
                    };
                    if (result.deviceUrl) {
                        updatedStep.deviceUrl = result.deviceUrl;
                    }
                    return updatedStep;
                }
                return s;
            }));

            if (result.success) {
                completedSteps++;
            } else {
                // Stop on failure
                updateModel('enrollmentProgress', { executionState: 'failed' });
                return;
            }

            // Update overall progress
            updateModel('enrollmentProgress', {
                overallProgress: Math.round((completedSteps / totalSteps) * 100)
            });
        }

        // All steps completed successfully
        updateModel('enrollmentProgress', { executionState: 'success' });
    };

    // Trigger reboot
    const handleReboot = () => {
        cockpit.spawn(['sudo', 'shutdown', '-r', 'now'], { err: 'message' })
                .catch(error => {
                    console.error('Failed to trigger reboot:', error);
                });
    };

    // Auto-reboot countdown after successful completion
    useEffect(() => {
        if (model.enrollmentProgress.executionState !== 'success' || !autoReboot) {
            return;
        }

        // Start 10-second countdown before auto-reboot
        const COUNTDOWN_SECONDS = 10;
        setRebootCountdown(COUNTDOWN_SECONDS);

        const interval = setInterval(() => {
            setRebootCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    handleReboot();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model.enrollmentProgress.executionState, autoReboot]);

    // Set up cancellation handler
    useEffect(() => {
        cancelEnrollmentRef.current = () => {
            console.log('Cancellation requested');
            shouldCancelRef.current = true;

            // Abort the currently running process if any
            if (runningProcessRef.current) {
                console.log('Aborting running process');
                try {
                    runningProcessRef.current.close();
                } catch (error) {
                    console.error('Error aborting process:', error);
                }
                runningProcessRef.current = null;
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

    const overallProgress = steps.length > 0 ? Math.round((steps.filter(s => s.status === 'success').length / steps.length) * 100) : 0;
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
                        <Title headingLevel="h3" size="md">{_("Overall Progress")}</Title>
                        <Progress
                            value={overallProgress}
                            size="lg"
                            variant={executionState === 'failed' ? 'danger' : 'success'}
                        />

                        <Title headingLevel="h3" size="md" style={{ marginTop: '1rem' }}>{_("Steps")}</Title>
                        <List isPlain>
                            {steps.map((step) => {
                                const serviceId = step.id.startsWith('enroll-') ? step.id.replace('enroll-', '') : null;
                                const service = serviceId ? enrollmentServices.find(s => s.id === serviceId) : null;

                                return (
                                    <ListItem key={step.id}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ minWidth: '20px' }}>
                                                {getStepIcon(step.status)}
                                            </span>
                                            <span style={{
                                                color: getStepTextColor(step.status),
                                                flex: 1
                                            }}
                                            >
                                                {step.name}
                                                {step.deviceUrl && service && (
                                                    <>
                                                        {" ("}
                                                        <a href={step.deviceUrl} target="_blank" rel="noopener noreferrer">
                                                            {_("view system")}
                                                        </a>
                                                        )
                                                    </>
                                                )}
                                            </span>
                                            {step.status === 'running' && (
                                                <span style={{ fontStyle: 'italic', color: 'var(--pf-v6-global--Color--200)' }}>
                                                    {_("Running...")}
                                                </span>
                                            )}
                                        </div>
                                    </ListItem>
                                );
                            })}
                        </List>

                        {executionState === 'failed' && (
                            <Alert variant="danger" title={_("Enrollment failed")}>
                                {_("The enrollment process was cancelled or failed. Please check the results above and try again.")}
                            </Alert>
                        )}
                        {executionState === 'success' && (
                            <>
                                <Alert variant="success" title={_("Enrollment completed successfully")}>
                                    {_("Your system has been configured and enrolled successfully.")}
                                </Alert>
                                {autoReboot
                                    ? (
                                        <Alert variant="info" title={_("System will reboot automatically")} style={{ marginTop: '0.5rem' }}>
                                            {rebootCountdown !== null && rebootCountdown > 0
                                                ? _("Rebooting in {{seconds}} seconds...").replace('{{seconds}}', String(rebootCountdown))
                                                : _("Rebooting now...")}
                                        </Alert>
                                    )
                                    : (
                                        <Alert
                                            variant="info"
                                            title={_("Reboot required")}
                                            style={{ marginTop: '0.5rem' }}
                                            actionLinks={
                                                <Button variant="link" onClick={handleReboot}>
                                                    {_("Reboot now")}
                                                </Button>
                                            }
                                        >
                                            {_("A system reboot is recommended to fully apply all configuration changes. You can reboot now or do it later from the system menu.")}
                                        </Alert>
                                    )}

                            </>
                        )}
                    </CardBody>
                </Card>
            </StackItem>

            <StackItem>
                {results.length > 0 && (
                    <pre style={{
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        backgroundColor: 'var(--pf-v6-global--BackgroundColor--dark-100)',
                        padding: '0',
                        overflowY: 'auto'
                    }}
                    >
                        {results.map((item, index) => {
                            if (item.type === 'header') {
                                return (
                                    <div key={index} style={{ fontWeight: 'bold', marginTop: index > 0 ? '1rem' : '0' }}>
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
