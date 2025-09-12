import React from 'react';

import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Stack, StackItem, Flex, FlexItem, ValidatedOptions } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

// Validation functions
const validateUrl = (url: string): string | null => {
    if (!url.trim()) return 'URL is required';

    try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return 'URL must use HTTP or HTTPS protocol';
        }
        if (!urlObj.hostname) {
            return 'URL must have a valid hostname';
        }
        return null;
    } catch {
        return 'Invalid URL format';
    }
};

const validateUsername = (username: string): string | null => {
    if (!username.trim()) return 'Username is required';
    if (username.length < 2) return 'Username must be at least 2 characters';
    if (username.length > 64) return 'Username must be 64 characters or less';
    // Allow alphanumeric, underscore, hyphen, dot, @
    if (!/^[a-zA-Z0-9._@-]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and common symbols (._@-)';
    }
    return null;
};

const validatePassword = (password: string): string | null => {
    if (!password.trim()) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password.length > 128) return 'Password must be 128 characters or less';
    return null;
};

const validateToken = (token: string): string | null => {
    if (!token.trim()) return 'Token is required';
    if (token.length < 10) return 'Token must be at least 10 characters';
    if (token.length > 512) return 'Token must be 512 characters or less';
    // Basic token format validation - alphanumeric, hyphens, underscores, dots
    if (!/^[a-zA-Z0-9._-]+$/.test(token)) {
        return 'Token contains invalid characters';
    }
    return null;
};

export const EnrollmentPage: React.FunctionComponent = () => {
    const { model, updateModel } = useModelContext();

    // Validation states
    const [validationErrors, setValidationErrors] = React.useState({
        url: null as string | null,
        username: null as string | null,
        password: null as string | null,
        token: null as string | null,
    });

    const setEnrollmentUrl = (url: string) => {
        const error = validateUrl(url);
        setValidationErrors(prev => ({ ...prev, url: error }));
        updateModel('enrollment', { url });
    };

    const setSkipTlsVerification = (skipTlsVerification: boolean) => {
        updateModel('enrollment', { skipTlsVerification });
    };

    const setAuthMethod = (authMethod: 'username-password' | 'token') => {
        updateModel('enrollment', { authMethod });
    };

    const setUsername = (username: string) => {
        const error = validateUsername(username);
        setValidationErrors(prev => ({ ...prev, username: error }));
        updateModel('enrollment', { username });
    };

    const setPassword = (password: string) => {
        const error = validatePassword(password);
        setValidationErrors(prev => ({ ...prev, password: error }));
        updateModel('enrollment', { password });
    };

    const setToken = (token: string) => {
        const error = validateToken(token);
        setValidationErrors(prev => ({ ...prev, token: error }));
        updateModel('enrollment', { token });
    };

    const isValidUrl = (url: string): boolean => {
        return validateUrl(url) === null;
    };

    const isHttpsUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure enrollment service connection:</p>
            </StackItem>
            <StackItem>
                <FormGroup
                    label="Enrollment Service URL"
                    isRequired
                >
                    <TextInputGroup validated={validationErrors.url ? ValidatedOptions.error : (model.enrollment.url && !validationErrors.url ? ValidatedOptions.success : ValidatedOptions.warning)}>
                        <TextInputGroupMain
                            id="enrollment-url"
                            value={model.enrollment.url}
                            onChange={(_, value) => setEnrollmentUrl(value)}
                            placeholder="https://enrollment.example.com"
                        />
                    </TextInputGroup>
                    {validationErrors.url && (
                        <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                            {validationErrors.url}
                        </div>
                    )}
                </FormGroup>
            </StackItem>
            {isValidUrl(model.enrollment.url) && isHttpsUrl(model.enrollment.url) && (
                <StackItem>
                    <Checkbox
                        id="skip-tls-verification"
                        label="Skip TLS verification (insecure)"
                        isChecked={model.enrollment.skipTlsVerification}
                        onChange={(_, checked) => setSkipTlsVerification(checked)}
                    />
                </StackItem>
            )}
            <StackItem>
                <FormGroup label="Authentication Method">
                    <Flex>
                        <FlexItem>
                            <Radio
                                id="auth-username-password"
                                name="auth-method"
                                label="Username and password"
                                isChecked={model.enrollment.authMethod === 'username-password'}
                                onChange={() => setAuthMethod('username-password')}
                            />
                        </FlexItem>
                        <FlexItem>
                            <Radio
                                id="auth-token"
                                name="auth-method"
                                label="Token"
                                isChecked={model.enrollment.authMethod === 'token'}
                                onChange={() => setAuthMethod('token')}
                            />
                        </FlexItem>
                    </Flex>
                </FormGroup>
            </StackItem>
            {model.enrollment.authMethod === 'username-password'
? (
    <StackItem>
        <Stack hasGutter>
            <StackItem>
                <FormGroup label="Username" isRequired>
                    <TextInputGroup validated={validationErrors.username ? ValidatedOptions.error : (model.enrollment.username && !validationErrors.username ? ValidatedOptions.success : ValidatedOptions.warning)}>
                        <TextInputGroupMain
                                        id="username"
                                        value={model.enrollment.username}
                                        onChange={(_, value) => setUsername(value)}
                                        placeholder="Enter username"
                        />
                    </TextInputGroup>
                    {validationErrors.username && (
                    <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                        {validationErrors.username}
                    </div>
                                )}
                </FormGroup>
            </StackItem>
            <StackItem>
                <FormGroup label="Password" isRequired>
                    <TextInputGroup validated={validationErrors.password ? ValidatedOptions.error : (model.enrollment.password && !validationErrors.password ? ValidatedOptions.success : ValidatedOptions.warning)}>
                        <TextInputGroupMain
                                        id="password"
                                        type="password"
                                        value={model.enrollment.password}
                                        onChange={(_, value) => setPassword(value)}
                                        placeholder="Enter password"
                        />
                    </TextInputGroup>
                    {validationErrors.password && (
                    <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                        {validationErrors.password}
                    </div>
                                )}
                </FormGroup>
            </StackItem>
        </Stack>
    </StackItem>
            )
: (
    <StackItem>
        <FormGroup label="Token" isRequired>
            <TextInputGroup validated={validationErrors.token ? ValidatedOptions.error : (model.enrollment.token && !validationErrors.token ? ValidatedOptions.success : ValidatedOptions.warning)}>
                <TextInputGroupMain
                                id="token"
                                value={model.enrollment.token}
                                onChange={(_, value) => setToken(value)}
                                placeholder="Enter authentication token"
                />
            </TextInputGroup>
            {validationErrors.token && (
            <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                {validationErrors.token}
            </div>
                        )}
        </FormGroup>
    </StackItem>
            )}
        </Stack>
    );
};
