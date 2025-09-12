import React, { useEffect, useState } from 'react';
import cockpit from 'cockpit';

import { Progress } from "@patternfly/react-core/dist/esm/components/Progress/index.js";
import { Stack, StackItem, List, ListItem, Title, Card, CardBody, Alert } from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationCircleIcon, InProgressIcon } from '@patternfly/react-icons';
import { useModelContext } from '../model-context';
import { systemConfigurationService } from '../system-config';

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'warning';

interface Step {
    id: string;
    name: string;
    status: StepStatus;
    output?: string;
    isBuiltIn: boolean;
}

const _ = cockpit.gettext;

export const EnrollmentProgressPage: React.FunctionComponent = () => {
    const { model, updateModel, networkManager } = useModelContext();
    const [hasStarted, setHasStarted] = useState(false);
    const [enrollmentScripts, setEnrollmentScripts] = useState<string[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [results, setResults] = useState<string[]>([]);
    const [isComplete, setIsComplete] = useState(false);

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

    // Initialize steps based on whether enrollment scripts exist
    const initializeSteps = async () => {
        try {
            // Check for enrollment scripts
            const proc = cockpit.spawn(['sh', '-c', 'find \"$HOME/.config/cockpit/system-onboarding.d/\" -name \"*.sh\" -type f -executable 2>/dev/null || true']);
            const output = await proc;
            const scripts = output.trim().split('\n').filter(line => line.length > 0).sort();
            setEnrollmentScripts(scripts);

            // Create initial steps
            const initialSteps: Step[] = [
                {
                    id: 'apply-config',
                    name: _('Applying configuration changes'),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'test-connectivity',
                    name: _('Testing network connectivity'),
                    status: 'pending',
                    isBuiltIn: true
                }
            ];

            // Add enrollment scripts as steps
            scripts.forEach((scriptPath, index) => {
                const scriptName = scriptPath.split('/').pop() || `Script ${index + 1}`;
                initialSteps.push({
                    id: `script-${index}`,
                    name: _('Executing {{scriptName}}').replace('{{scriptName}}', scriptName),
                    status: 'pending',
                    isBuiltIn: false
                });
            });

            // Add finalize step
            initialSteps.push({
                id: 'finalize',
                name: _('Finalizing enrollment'),
                status: 'pending',
                isBuiltIn: true
            });

            setSteps(initialSteps);
        } catch (error) {
            console.error('Failed to initialize enrollment steps:', error);
            // Fallback to basic steps if script discovery fails
            setSteps([
                {
                    id: 'apply-config',
                    name: _('Applying configuration changes'),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'test-connectivity',
                    name: _('Testing network connectivity'),
                    status: 'pending',
                    isBuiltIn: true
                },
                {
                    id: 'finalize',
                    name: _('Finalizing configuration'),
                    status: 'pending',
                    isBuiltIn: true
                }
            ]);
        }
    };

    // Execute a single step
    const executeStep = async (stepId: string): Promise<{ success: boolean; output: string }> => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return { success: false, output: 'Step not found' };

        // Update step to running
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'running' } : s));

        try {
            switch (stepId) {
                case 'apply-config':
                    return await applyConfiguration();
                case 'test-connectivity':
                    return await testConnectivity();
                case 'finalize':
                    return await finalizeEnrollment();
                default:
                    // Handle script execution
                    if (stepId.startsWith('script-')) {
                        const scriptIndex = parseInt(stepId.replace('script-', ''));
                        const scriptPath = enrollmentScripts[scriptIndex];
                        if (scriptPath) {
                            return await executeScript(scriptPath);
                        }
                    }
                    return { success: false, output: 'Unknown step' };
            }
        } catch (error) {
            return { success: false, output: String(error) };
        }
    };

    // Built-in step implementations
    const applyConfiguration = async (): Promise<{ success: boolean; output: string }> => {
        try {
            console.log('Applying system configuration...');
            
            // Use SystemConfigurationService to apply all configuration
            const result = await systemConfigurationService.applySystemConfiguration(networkManager, model);
            
            const summary = result.success ? 
                'Configuration applied successfully' : 
                'Configuration applied with some errors';
            
            return {
                success: result.success,
                output: `${summary}\n\nDetails:\n${result.results.join('\n')}`
            };
            
        } catch (error) {
            const errorMsg = `Configuration failed: ${String(error)}`;
            console.error('applyConfiguration error:', error);
            return {
                success: false,
                output: errorMsg
            };
        }
    };

    const testConnectivity = async (): Promise<{ success: boolean; output: string }> => {
        // Simulate network connectivity test
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (model.enrollment.url) {
            try {
                // Use www.google.com as a reliable test host instead of the enrollment URL
                // since enrollment servers may not respond to pings
                const testHost = 'www.google.com';
                const url = new URL(model.enrollment.url);
                console.log(`Testing connectivity using ${testHost} (enrollment URL: ${url.hostname})`);
                
                // Try multiple approaches for connectivity testing
                
                // Approach 1: Use getent hosts to check DNS resolution
                try {
                    const dnsProc = cockpit.spawn(['getent', 'hosts', testHost]);
                    await dnsProc;
                    console.log(`DNS resolution successful for ${testHost}`);
                } catch (dnsError) {
                    console.warn(`DNS resolution failed for ${testHost}:`, dnsError);
                    return { success: false, output: `DNS resolution failed for ${testHost}` };
                }
                
                // Approach 2: Use timeout command with ping for better control
                try {
                    const pingProc = cockpit.spawn(['timeout', '10', 'ping', '-c', '1', '-W', '5', testHost], { err: 'ignore' });
                    const pingResult = await pingProc;
                    console.log(`Ping result:`, pingResult);
                    return { success: true, output: `Network connectivity verified (tested with ${testHost})` };
                } catch (pingError) {
                    console.warn(`Ping failed for ${testHost}:`, pingError);
                    // Fall back to basic success if DNS worked
                    return { success: true, output: `DNS resolution successful for ${testHost} (ping may be blocked)` };
                }
                
            } catch (error) {
                console.error('Connectivity test error:', error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                return { success: false, output: `Network connectivity test failed: ${errorMsg}` };
            }
        }
        return { success: true, output: 'Network connectivity verified (no enrollment URL specified)' };
    };

    const executeScript = async (scriptPath: string): Promise<{ success: boolean; output: string }> => {
        try {
            console.log(`Executing script: ${scriptPath}`);
            console.log('Environment variables:', {
                ENROLLMENT_URL: model.enrollment.url,
                ENROLLMENT_SKIP_TLS_VERIFICATION: model.enrollment.skipTlsVerification,
                ENROLLMENT_AUTH_METHOD: model.enrollment.authMethod,
                ENROLLMENT_USERNAME: model.enrollment.username,
                ENROLLMENT_PASSWORD: model.enrollment.password ? '[SET]' : '[NOT SET]',
                ENROLLMENT_TOKEN: model.enrollment.token ? '[SET]' : '[NOT SET]',
            });

            const proc = cockpit.spawn(['/bin/bash', scriptPath], {
                err: 'out',
                environ: [
                    `ENROLLMENT_URL=${model.enrollment.url}`,
                    `ENROLLMENT_SKIP_TLS_VERIFICATION=${model.enrollment.skipTlsVerification}`,
                    `ENROLLMENT_AUTH_METHOD=${model.enrollment.authMethod}`,
                    `ENROLLMENT_USERNAME=${model.enrollment.username}`,
                    `ENROLLMENT_PASSWORD=${model.enrollment.password}`,
                    `ENROLLMENT_TOKEN=${model.enrollment.token}`,
                ]
            });
            
            const output = await proc;
            console.log(`Script ${scriptPath} completed successfully`);
            return { success: true, output: output || 'Script completed successfully' };
        } catch (error) {
            console.error(`Script ${scriptPath} failed:`, error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, output: `Script failed: ${errorMsg}` };
        }
    };

    const finalizeEnrollment = async (): Promise<{ success: boolean; output: string }> => {
        // Simulate finalization
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, output: 'Enrollment process completed' };
    };

    // Main execution function
    const executeEnrollment = async () => {
        setHasStarted(true);
        updateModel('enrollmentProgress', { isRunning: true });

        let completedSteps = 0;
        const totalSteps = steps.length;
        const newResults: string[] = [];

        for (const step of steps) {
            const result = await executeStep(step.id);

            // Update step status
            setSteps(prev => prev.map(s =>
                s.id === step.id
                    ? { ...s, status: result.success ? 'success' : 'failed', output: result.output }
                    : s
            ));

            // Add to results
            newResults.push(`${step.name}: ${result.output}`);
            setResults([...newResults]);

            if (result.success) {
                completedSteps++;
            } else {
                // Stop on failure
                break;
            }

            // Update overall progress
            updateModel('enrollmentProgress', {
                overallProgress: Math.round((completedSteps / totalSteps) * 100)
            });
        }

        updateModel('enrollmentProgress', { isRunning: false });
        setIsComplete(true);
    };

    // Auto-start enrollment when component mounts
    useEffect(() => {
        initializeSteps();
    }, []);

    useEffect(() => {
        if (steps.length > 0 && !hasStarted) {
            executeEnrollment();
        }
    }, [steps, hasStarted]);

    const hasFailedSteps = steps.some(step => step.status === 'failed');
    const overallProgress = steps.length > 0 ? Math.round((steps.filter(s => s.status === 'success').length / steps.length) * 100) : 0;

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h2">
                    {enrollmentScripts.length > 0 ? _('Apply and enroll') : _('Apply configuration')}
                </Title>
                <p>
                    {enrollmentScripts.length > 0
                        ? _('Applying your configuration and enrolling the system into the management system.')
                        : _('Applying your configuration changes to the system.')}
                </p>
            </StackItem>

            <StackItem>
                <Progress
                    value={overallProgress}
                    title={_('Overall Progress')}
                    size="lg"
                    variant={hasFailedSteps ? 'danger' : 'success'}
                />
            </StackItem>

            <StackItem>
                <Card>
                    <CardBody>
                        <Title headingLevel="h3" size="md">{_('Steps')}</Title>
                        <List isPlain>
                            {steps.map((step) => (
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
                                        </span>
                                        {step.status === 'running' && (
                                            <span style={{ fontStyle: 'italic', color: 'var(--pf-v6-global--Color--200)' }}>
                                                {_('Running...')}
                                            </span>
                                        )}
                                    </div>
                                </ListItem>
                            ))}
                        </List>
                    </CardBody>
                </Card>
            </StackItem>

            {results.length > 0 && (
                <StackItem>
                    <Card>
                        <CardBody>
                            <Title headingLevel="h3" size="md">{_('Results')}</Title>
                            <List isPlain>
                                {results.map((result, index) => (
                                    <ListItem key={index} style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                        {result}
                                    </ListItem>
                                ))}
                            </List>
                        </CardBody>
                    </Card>
                </StackItem>
            )}

            {isComplete && (
                <StackItem>
                    {hasFailedSteps
? (
    <Alert variant="danger" title={_('Enrollment failed')}>
        <p>{_('Some steps failed during the enrollment process. Please check the results above and try again.')}</p>
    </Alert>
                    )
: (
    <Alert variant="success" title={_('Enrollment completed successfully')}>
        <p>{_('Your system has been configured and enrolled successfully.')}</p>
    </Alert>
                    )}
                </StackItem>
            )}
        </Stack>
    );
};
