/**
 * Enrollment Page
 *
 * Allows users to select management services and provide credentials for enrollment.
 * Dynamically renders credential forms based on each service's JSON schema.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Alert, AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { useModelContext } from "../model-context";
import { useConfig } from "../app";
import { validateURL } from "../validation";
import { evaluateSkipConditions, SkipResult } from "../services/skip-conditions";
import type { EnrollmentService } from "../types";

/**
 * JSON Schema Form Renderer
 *
 * Renders a form based on a JSON Schema (Draft 7) using PatternFly components.
 * Supports: string, number, boolean types with validation.
 */
interface FieldSchema {
    type: string;
    title?: string;
    format?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
}

interface SchemaVariant {
    title?: string;
    properties: Record<string, FieldSchema>;
    required?: string[];
}

interface JsonSchemaFormProps {
    schema: {
        type: string;
        properties?: Record<string, FieldSchema>;
        required?: string[];
        oneOf?: SchemaVariant[];
    };
    formData: Record<string, unknown>;
    onChange: (formData: Record<string, unknown>) => void;
}

/**
 * Validate a single field against its schema and required list.
 */
function validateField(fieldName: string, value: unknown, fieldSchema: FieldSchema, required: string[]): string | null {
    if (required.includes(fieldName)) {
        if (value === undefined || value === null || value === "") {
            return "This field is required";
        }
    }

    if (value !== undefined && value !== null && value !== "") {
        switch (fieldSchema.type) {
            case "string": {
                const strValue = String(value);
                if (fieldSchema.minLength && strValue.length < fieldSchema.minLength) {
                    return `Minimum length is ${fieldSchema.minLength}`;
                }
                if (fieldSchema.maxLength && strValue.length > fieldSchema.maxLength) {
                    return `Maximum length is ${fieldSchema.maxLength}`;
                }
                break;
            }
            case "number": {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    return "Must be a valid number";
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
}

/**
 * Renders fields for a flat set of properties.
 */
const SchemaFields: React.FC<{
    properties: Record<string, FieldSchema>;
    required: string[];
    formData: Record<string, unknown>;
    onFieldChange: (fieldName: string, value: unknown) => void;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
}> = ({ properties, required, formData, onFieldChange, errors, touched }) => {
    return (
        <>
            {Object.entries(properties).map(([fieldName, fieldSchema]) => {
                const isRequired = required.includes(fieldName);
                const label = fieldSchema.title || fieldName;
                const value = formData[fieldName];
                const error = errors[fieldName];
                const showError = touched[fieldName] && error;

                const validationState = error
                    ? ValidatedOptions.error
                    : value && String(value).trim()
                      ? ValidatedOptions.success
                      : isRequired
                        ? ValidatedOptions.warning
                        : ValidatedOptions.default;

                switch (fieldSchema.type) {
                    case "string":
                        return (
                            <StackItem key={fieldName}>
                                <FormGroup label={label} isRequired={isRequired}>
                                    <TextInput
                                        id={`field-${fieldName}`}
                                        type={fieldSchema.format === "password" ? "password" : "text"}
                                        value={String(value || "")}
                                        onChange={(_event, val) => onFieldChange(fieldName, val)}
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

                    case "number":
                        return (
                            <StackItem key={fieldName}>
                                <FormGroup label={label} isRequired={isRequired}>
                                    <TextInput
                                        id={`field-${fieldName}`}
                                        type="number"
                                        value={String(value || "")}
                                        onChange={(_event, val) => onFieldChange(fieldName, Number(val))}
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

                    case "boolean":
                        return (
                            <StackItem key={fieldName}>
                                <Checkbox
                                    id={`field-${fieldName}`}
                                    label={label}
                                    isChecked={Boolean(value)}
                                    onChange={(_event, checked) => onFieldChange(fieldName, checked)}
                                />
                            </StackItem>
                        );

                    default:
                        return (
                            <StackItem key={fieldName}>
                                <Alert
                                    variant={AlertVariant.warning}
                                    isInline
                                    title={`Unsupported field type: ${fieldSchema.type}`}
                                />
                            </StackItem>
                        );
                }
            })}
        </>
    );
};

const JsonSchemaForm: React.FC<JsonSchemaFormProps> = ({ schema, formData, onChange }) => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // Track which oneOf variant is selected (stored as _variantIndex in formData)
    const selectedVariant = typeof formData._variantIndex === "number" ? (formData._variantIndex as number) : 0;

    // Resolve the active properties and required fields
    const { activeProperties, activeRequired } = useMemo(() => {
        if (schema.oneOf && schema.oneOf.length > 0) {
            const variant = schema.oneOf[selectedVariant] || schema.oneOf[0];
            return {
                activeProperties: variant.properties,
                activeRequired: variant.required || [],
            };
        }
        return {
            activeProperties: schema.properties || {},
            activeRequired: schema.required || [],
        };
    }, [schema, selectedVariant]);

    const handleFieldChange = (fieldName: string, value: unknown) => {
        const newFormData = { ...formData, [fieldName]: value };
        onChange(newFormData);

        setTouched((prev) => ({ ...prev, [fieldName]: true }));

        const fieldSchema = activeProperties[fieldName];
        if (fieldSchema) {
            const error = validateField(fieldName, value, fieldSchema, activeRequired);
            setErrors((prev) => ({ ...prev, [fieldName]: error || "" }));
        }
    };

    const handleVariantChange = (variantIndex: number) => {
        // Clear form data when switching variants, preserving only the variant index
        onChange({ _variantIndex: variantIndex });
        setErrors({});
        setTouched({});
    };

    return (
        <Stack hasGutter>
            {/* Render radio buttons when schema has oneOf */}
            {schema.oneOf && schema.oneOf.length > 0 && (
                <StackItem>
                    <FormGroup label="Authentication method">
                        <Stack>
                            {schema.oneOf.map((variant, index) => (
                                <StackItem key={index}>
                                    <Radio
                                        id={`variant-${index}`}
                                        name="auth-method"
                                        label={variant.title || `Option ${index + 1}`}
                                        isChecked={selectedVariant === index}
                                        onChange={() => handleVariantChange(index)}
                                    />
                                </StackItem>
                            ))}
                        </Stack>
                    </FormGroup>
                </StackItem>
            )}

            {/* Render fields for the active variant */}
            <SchemaFields
                properties={activeProperties}
                required={activeRequired}
                formData={formData}
                onFieldChange={handleFieldChange}
                errors={errors}
                touched={touched}
            />
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
    const selectedServices = useMemo(
        () => model.enrollment.selectedServices || [],
        [model.enrollment.selectedServices]
    );
    const credentials = model.enrollment.credentials || {};
    const endpoints = useMemo(() => model.enrollment.endpoints || {}, [model.enrollment.endpoints]);
    const useExisting = useMemo(() => model.enrollment.useExisting || {}, [model.enrollment.useExisting]);

    const [skipResults, setSkipResults] = useState<Record<string, SkipResult>>({});
    const [detectedExisting, setDetectedExisting] = useState<Record<string, boolean>>({});

    // Track endpoint validation errors and touched state
    const [endpointErrors, setEndpointErrors] = useState<Record<string, string>>({});
    const [endpointTouched, setEndpointTouched] = useState<Record<string, boolean>>({});

    // Capture which services had existing credentials detected at init time
    useEffect(() => {
        setDetectedExisting({ ...useExisting });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Evaluate skipWhen conditions on mount
    useEffect(() => {
        let cancelled = false;
        const evaluate = async () => {
            const results: Record<string, SkipResult> = {};
            for (const service of enrollmentServices) {
                results[service.id] = await evaluateSkipConditions(service.skipWhen);
            }
            if (!cancelled) {
                setSkipResults(results);

                // Auto-set useExisting for connectivityOnly services so that
                // step validation does not require credentials.
                const updates: Record<string, boolean> = {};
                for (const service of enrollmentServices) {
                    if (results[service.id]?.action === "connectivityOnly") {
                        updates[service.id] = true;
                    }
                }
                if (Object.keys(updates).length > 0) {
                    updateModel("enrollment", {
                        useExisting: { ...useExisting, ...updates },
                    });
                }
            }
        };
        evaluate();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enrollmentServices]);

    // Validate endpoints on mount and when they change
    useEffect(() => {
        const errors: Record<string, string> = {};
        for (const serviceId of selectedServices) {
            if (useExisting[serviceId]) {
                continue;
            }
            const service = enrollmentServices.find((s) => s.id === serviceId);
            if (service) {
                const endpoint = endpoints[serviceId] || service.endpoint.url;
                const error = validateURL(endpoint, true);
                if (error) {
                    errors[serviceId] = error;
                }
            }
        }
        setEndpointErrors(errors);
    }, [endpoints, selectedServices, enrollmentServices, useExisting]);

    const toggleServiceSelection = (serviceId: string) => {
        const newSelectedServices = selectedServices.includes(serviceId)
            ? selectedServices.filter((id) => id !== serviceId)
            : [...selectedServices, serviceId];

        updateModel("enrollment", {
            selectedServices: newSelectedServices,
        });
    };

    const updateServiceCredentials = (serviceId: string, credentialsData: Record<string, unknown>) => {
        updateModel("enrollment", {
            credentials: {
                ...credentials,
                [serviceId]: credentialsData,
            },
        });
    };

    const updateServiceEndpoint = (serviceId: string, endpoint: string) => {
        setEndpointTouched((prev) => ({ ...prev, [serviceId]: true }));

        const error = validateURL(endpoint, true);
        setEndpointErrors((prev) => ({ ...prev, [serviceId]: error || "" }));

        updateModel("enrollment", {
            endpoints: {
                ...endpoints,
                [serviceId]: endpoint,
            },
        });
    };

    const setUseExisting = (serviceId: string, value: boolean) => {
        updateModel("enrollment", {
            useExisting: {
                ...useExisting,
                [serviceId]: value,
            },
        });
    };

    // If no enrollment services are configured, show info message
    if (enrollmentServices.length === 0) {
        return (
            <Stack hasGutter>
                <StackItem>
                    <Alert variant={AlertVariant.info} isInline title="No enrollment services configured">
                        No enrollment services are currently configured. You can skip this step or configure services in{" "}
                        <code>/etc/cockpit/system-onboarding/config.json</code>.
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
                const skip = skipResults[service.id];

                if (skip?.action === "skip") {
                    return (
                        <StackItem key={service.id}>
                            <Alert variant={AlertVariant.info} isInline title={service.name}>
                                {skip.reason}
                            </Alert>
                        </StackItem>
                    );
                }

                const isSelected = selectedServices.includes(service.id);
                const isConnectivityOnly = skip?.action === "connectivityOnly";
                const isUsingExisting = useExisting[service.id] ?? false;
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

                            {isSelected && isConnectivityOnly && skip?.action === "connectivityOnly" && (
                                <CardBody>
                                    <Alert variant={AlertVariant.info} isInline title="Existing credentials detected">
                                        {skip.reason}
                                    </Alert>
                                </CardBody>
                            )}
                            {isSelected && !isConnectivityOnly && (
                                <CardBody>
                                    <Stack hasGutter>
                                        {detectedExisting[service.id] && (
                                            <StackItem>
                                                <FormGroup label="Enrollment credentials">
                                                    <Stack>
                                                        <StackItem>
                                                            <Radio
                                                                id={`use-existing-${service.id}`}
                                                                name={`credential-mode-${service.id}`}
                                                                label="Use existing enrollment credentials"
                                                                description="The device already has enrollment credentials configured. The agent will be restarted to pick up any label and proxy changes."
                                                                isChecked={isUsingExisting}
                                                                onChange={() => setUseExisting(service.id, true)}
                                                            />
                                                        </StackItem>
                                                        <StackItem>
                                                            <Radio
                                                                id={`configure-new-${service.id}`}
                                                                name={`credential-mode-${service.id}`}
                                                                label="Configure new enrollment"
                                                                description="Provide an endpoint and credentials to enroll this device."
                                                                isChecked={!isUsingExisting}
                                                                onChange={() => setUseExisting(service.id, false)}
                                                            />
                                                        </StackItem>
                                                    </Stack>
                                                </FormGroup>
                                            </StackItem>
                                        )}

                                        {!isUsingExisting && (
                                            <>
                                                {/* Endpoint URL (with optional override) */}
                                                <StackItem>
                                                    <FormGroup label="Service Endpoint" isRequired>
                                                        <TextInput
                                                            id={`endpoint-${service.id}`}
                                                            value={serviceEndpoint}
                                                            onChange={(_event, value) =>
                                                                updateServiceEndpoint(service.id, value)
                                                            }
                                                            isDisabled={!service.endpoint.allowUserOverride}
                                                            validated={endpointValidated}
                                                        />
                                                        {showEndpointError && (
                                                            <FormHelperText>
                                                                <HelperText>
                                                                    <HelperTextItem variant="error">
                                                                        {endpointError}
                                                                    </HelperTextItem>
                                                                </HelperText>
                                                            </FormHelperText>
                                                        )}
                                                        {!service.endpoint.allowUserOverride && (
                                                            <div
                                                                style={{
                                                                    fontSize: "var(--pf-global--FontSize--sm)",
                                                                    color: "var(--pf-global--Color--200)",
                                                                    marginTop: "0.25rem",
                                                                }}
                                                            >
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
                                                            onChange={(data) =>
                                                                updateServiceCredentials(service.id, data)
                                                            }
                                                        />
                                                    </FormGroup>
                                                </StackItem>
                                            </>
                                        )}
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
