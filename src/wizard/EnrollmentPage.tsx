import React from 'react';

import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

export const EnrollmentPage: React.FunctionComponent = () => {
    const { model, updateModel } = useModelContext();
    
    const setEnrollmentUrl = (url: string) => {
        updateModel('enrollment', { url });
    };
    
    const setSkipTlsVerification = (skipTlsVerification: boolean) => {
        updateModel('enrollment', { skipTlsVerification });
    };
    
    const setAuthMethod = (authMethod: 'username-password' | 'token') => {
        updateModel('enrollment', { authMethod });
    };
    
    const setUsername = (username: string) => {
        updateModel('enrollment', { username });
    };
    
    const setPassword = (password: string) => {
        updateModel('enrollment', { password });
    };
    
    const setToken = (token: string) => {
        updateModel('enrollment', { token });
    };

    const isValidUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const isHttpsUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const urlValidated = model.enrollment.url ? (isValidUrl(model.enrollment.url) ? 'success' : 'error') : 'default';

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure enrollment service connection:</p>
            </StackItem>
            <StackItem>
                <FormGroup 
                    label="Enrollment Service URL" 
                    isRequired
                    helperTextInvalid="Please enter a valid HTTP or HTTPS URL"
                    validated={urlValidated}
                >
                    <TextInput
                        id="enrollment-url"
                        value={model.enrollment.url}
                        onChange={(_, value) => setEnrollmentUrl(value)}
                        placeholder="https://enrollment.example.com"
                        validated={urlValidated}
                    />
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
            {model.enrollment.authMethod === 'username-password' ? (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="Username" isRequired>
                                <TextInput
                                    id="username"
                                    value={model.enrollment.username}
                                    onChange={(_, value) => setUsername(value)}
                                    placeholder="Enter username"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Password" isRequired>
                                <TextInput
                                    id="password"
                                    type="password"
                                    value={model.enrollment.password}
                                    onChange={(_, value) => setPassword(value)}
                                    placeholder="Enter password"
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            ) : (
                <StackItem>
                    <FormGroup label="Token" isRequired>
                        <TextInput
                            id="token"
                            value={model.enrollment.token}
                            onChange={(_, value) => setToken(value)}
                            placeholder="Enter authentication token"
                        />
                    </FormGroup>
                </StackItem>
            )}
        </Stack>
    );
};