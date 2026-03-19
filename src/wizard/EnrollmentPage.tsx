/**
 * Enrollment Page
 *
 * Allows users to select management services and provide credentials for enrollment.
 * Dynamically renders credential forms based on each service's JSON schema.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Alert, AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { useModelContext } from '../model-context';
import { useConfig } from '../app';
import { validateURL } from '../validation';
import type { EnrollmentService } from '../types';

/**
 * JSON Schema Form Renderer
 *
 * Renders a form based on a JSON Schema (Draft 7) using PatternFly components.
 * Supports: string, number, boolean types with validation.
 */
interface JsonSchemaFormProps {
    schema: {
        type: string;
        properties: Record<string, {
            type: string;
            title?: string;
            format?: string;
            minimum?: number;
            maximum?: number;
            minLength?: number;
            maxLength?: number;
        }>;
        required?: string[];
    };
    formData: Record<string, unknown>;
    onChange: (formData: Record<string, unknown>) => void;
}

const JsonSchemaForm: React.FC<JsonSchemaFormProps> = ({ schema, formData, onChange }) => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const handleFieldChange = (fieldName: string, value: unknown) => {
        const newFormData = { ...formData, [fieldName]: value };
        onChange(newFormData);

        // Mark field as touched
        setTouched(prev => ({ ...prev, [fieldName]: true }));

        // Validate field
        const fieldSchema = schema.properties[fieldName];
        const error = validateField(fieldName, value, fieldSchema, schema.required || []);
        setErrors(prev => ({ ...prev, [fieldName]: error || '' }));
    };

    const validateField = (
        fieldName: string,
        value: unknown,
        fieldSchema: { type: string; minLength?: number; maxLength?: number; minimum?: number; maximum?: number },
        required: string[]
    ): string | null => {
        // Check required
        if (required.includes(fieldName)) {
            if (value === undefined || value === null || value === '') {
                return 'This field is required';
            }
        }

        // Type-specific validation
        if (value !== undefined && value !== null && value !== '') {
            switch (fieldSchema.type) {
            case 'string': {
                const strValue = String(value);
                if (fieldSchema.minLength && strValue.length < fieldSchema.minLength) {
                    return `Minimum length is ${fieldSchema.minLength}`;
                }
                if (fieldSchema.maxLength && strValue.length > fieldSchema.maxLength) {
                    return `Maximum length is ${fieldSchema.maxLength}`;
                }
                break;
            }
            case 'number': {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    return 'Must be a valid number';
                }
                if (fieldSchema.minimum !== undefined && numValue < fieldSchema.minimum) {
                    return `Minimum value is ${fieldSchema.minimum}`;
                }
                if (fieldSchema.maximum !== undefined && numValue > fieldSchema.maximum) {
                    return `Maximum value is ${fieldSchema.maximum}`;
                }
                break;
            }
            }
        }

        return null;
    };

    return (
        <Stack hasGutter>
            {Object.entries(schema.properties).map(([fieldName, fieldSchema]) => {
                const isRequired = schema.required?.includes(fieldName) || false;
                const label = fieldSchema.title || fieldName;
                const value = formData[fieldName];
                const error = errors[fieldName];

                const showError = touched[fieldName] && error;
                // Determine validation state:
                // - Show error if there's an error
                // - Show success if there's a valid value
                // - Show warning if required and empty
                // - Show default otherwise
                const validationState = error
                    ? ValidatedOptions.error
                    : (value && String(value).trim())
                        ? ValidatedOptions.success
                        : isRequired
                            ? ValidatedOptions.warning
                            : ValidatedOptions.default;

                switch (fieldSchema.type) {
                case 'string':
                    return (
                        <StackItem key={fieldName}>
                            <FormGroup label={label} isRequired={isRequired}>
                                <TextInput
                                    id={`field-${fieldName}`}
                                    type={fieldSchema.format === 'password' ? 'password' : 'text'}
                                    value={String(value || '')}
                                    onChange={(_event, val) => handleFieldChange(fieldName, val)}
                                    validated={validationState}
                                    isRequired={isRequired}
                                />
                                {showError && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem variant="error">{error}</HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                    );

                case 'number':
                    return (
                        <StackItem key={fieldName}>
                            <FormGroup label={label} isRequired={isRequired}>
                                <TextInput
                                    id={`field-${fieldName}`}
                                    type="number"
                                    value={String(value || '')}
                                    onChange={(_event, val) => handleFieldChange(fieldName, Number(val))}
                                    validated={validationState}
                                    isRequired={isRequired}
                                />
                                {showError && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem variant="error">{error}</HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                    );

                case 'boolean':
                    return (
                        <StackItem key={fieldName}>
                            <Checkbox
                                id={`field-${fieldName}`}
                                label={label}
                                isChecked={Boolean(value)}
                                onChange={(_event, checked) => handleFieldChange(fieldName, checked)}
                            />
                        </StackItem>
                    );

                default:
                    return (
                        <StackItem key={fieldName}>
                            <Alert variant={AlertVariant.warning} isInline title={`Unsupported field type: ${fieldSchema.type}`} />
                        </StackItem>
                    );
                }
            })}
        </Stack>
    );
};

/**
 * Enrollment Page Component
 */
export const EnrollmentPage: React.FunctionComponent = () => {
    const { config } = useConfig();
    const { model, updateModel } = useModelContext();

    const enrollmentServices = useMemo(() => config?.enrollmentServices || [], [config?.enrollmentServices]);
    const selectedServices = useMemo(() => model.enrollment.selectedServices || [], [model.enrollment.selectedServices]);
    const credentials = model.enrollment.credentials || {};
    const endpoints = useMemo(() => model.enrollment.endpoints || {}, [model.enrollment.endpoints]);

    // Track endpoint validation errors and touched state
    const [endpointErrors, setEndpointErrors] = useState<Record<string, string>>({});
    const [endpointTouched, setEndpointTouched] = useState<Record<string, boolean>>({});

    // Validate endpoints on mount and when they change
    useEffect(() => {
        const errors: Record<string, string> = {};
        for (const serviceId of selectedServices) {
            const service = enrollmentServices.find(s => s.id === serviceId);
            if (service) {
                const endpoint = endpoints[serviceId] || service.endpoint.url;
                const error = validateURL(endpoint, true);
                if (error) {
                    errors[serviceId] = error;
                }
            }
        }
        setEndpointErrors(errors);
    }, [endpoints, selectedServices, enrollmentServices]);

    const toggleServiceSelection = (serviceId: string) => {
        const newSelectedServices = selectedServices.includes(serviceId)
            ? selectedServices.filter(id => id !== serviceId)
            : [...selectedServices, serviceId];

        updateModel('enrollment', {
            selectedServices: newSelectedServices,
        });
    };

    const updateServiceCredentials = (serviceId: string, credentialsData: Record<string, unknown>) => {
        updateModel('enrollment', {
            credentials: {
                ...credentials,
                [serviceId]: credentialsData,
            },
        });
    };

    const updateServiceEndpoint = (serviceId: string, endpoint: string) => {
        // Mark as touched
        setEndpointTouched(prev => ({ ...prev, [serviceId]: true }));

        // Validate
        const error = validateURL(endpoint, true);
        setEndpointErrors(prev => ({ ...prev, [serviceId]: error || '' }));

        updateModel('enrollment', {
            endpoints: {
                ...endpoints,
                [serviceId]: endpoint,
            },
        });
    };

    // If no enrollment services are configured, show info message
    if (enrollmentServices.length === 0) {
        return (
            <Stack hasGutter>
                <StackItem>
                    <Alert
                        variant={AlertVariant.info}
                        isInline
                        title="No enrollment services configured"
                    >
                        No enrollment services are currently configured. You can skip this step or configure
                        services in <code>/etc/cockpit/system-onboarding/config.json</code>.
                    </Alert>
                </StackItem>
            </Stack>
        );
    }

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Select the management services you want to enroll this device into:</p>
            </StackItem>

            {enrollmentServices.map((service: EnrollmentService) => {
                const isSelected = selectedServices.includes(service.id);
                const serviceCredentials = credentials[service.id] || {};
                // Use nullish coalescing to only fall back to default if undefined/null, not empty string
                const serviceEndpoint = endpoints[service.id] ?? service.endpoint.url;
                const endpointError = endpointErrors[service.id];
                const showEndpointError = endpointTouched[service.id] && endpointError;

                // Determine validation state for endpoint
                // Show warning if empty, error if invalid, success if valid
                const endpointValidated = endpointError
                    ? ValidatedOptions.error
                    : serviceEndpoint?.trim()
                        ? ValidatedOptions.success
                        : ValidatedOptions.warning;

                return (
                    <StackItem key={service.id}>
                        <Card isCompact>
                            <CardTitle>
                                <Checkbox
                                    id={`service-${service.id}`}
                                    label={service.name}
                                    isChecked={isSelected}
                                    onChange={() => toggleServiceSelection(service.id)}
                                    description={service.description}
                                />
                            </CardTitle>

                            {isSelected && (
                                <CardBody>
                                    <Stack hasGutter>
                                        {/* Endpoint URL (with optional override) */}
                                        <StackItem>
                                            <FormGroup
                                                label="Service Endpoint"
                                                isRequired
                                            >
                                                <TextInput
                                                    id={`endpoint-${service.id}`}
                                                    value={serviceEndpoint}
                                                    onChange={(_event, value) => updateServiceEndpoint(service.id, value)}
                                                    isDisabled={!service.endpoint.allowUserOverride}
                                                    validated={endpointValidated}
                                                />
                                                {showEndpointError && (
                                                    <FormHelperText>
                                                        <HelperText>
                                                            <HelperTextItem variant="error">{endpointError}</HelperTextItem>
                                                        </HelperText>
                                                    </FormHelperText>
                                                )}
                                                {!service.endpoint.allowUserOverride && (
                                                    <div style={{ fontSize: 'var(--pf-global--FontSize--sm)', color: 'var(--pf-global--Color--200)', marginTop: '0.25rem' }}>
                                                        Endpoint is configured by the administrator
                                                    </div>
                                                )}
                                            </FormGroup>
                                        </StackItem>

                                        {/* Credentials Form (dynamic based on schema) */}
                                        <StackItem>
                                            <FormGroup label="Credentials">
                                                <JsonSchemaForm
                                                    schema={service.credentialsSchema}
                                                    formData={serviceCredentials}
                                                    onChange={(data) => updateServiceCredentials(service.id, data)}
                                                />
                                            </FormGroup>
                                        </StackItem>
                                    </Stack>
                                </CardBody>
                            )}
                        </Card>
                    </StackItem>
                );
            })}
        </Stack>
    );
};
