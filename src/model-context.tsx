import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Model {
  hostname: {
    value: string;
  };
  networkInterface: {
    selectedInterface: string | null;
    useVlan: boolean;
    vlanId: number | null;
  };
  networkAddress: {
    ipv4: {
      method: 'dhcp' | 'static';
      address: string;
      subnetMask: string;
      gateway: string;
      autoDns: boolean;
      primaryDns: string;
      secondaryDns: string;
    };
    ipv6: {
      method: 'dhcp' | 'static' | 'disabled';
      address: string;
      gateway: string;
      autoDns: boolean;
      primaryDns: string;
      secondaryDns: string;
    };
  };
  networkServices: {
    ntp: {
      autoConfig: boolean;
      servers: string[];
    };
  };
  enrollment: {
    url: string;
    skipTlsVerification: boolean;
    authMethod: 'username-password' | 'token';
    username: string;
    password: string;
    token: string;
  };
}

// Initial state
const initialModel: Model = {
  hostname: {
    value: '',
  },
  networkInterface: {
    selectedInterface: null,
    vlanId: 1,
    useVlan: false,
  },
  networkAddress: {
    ipv4: {
      method: 'dhcp',
      address: '',
      subnetMask: '',
      gateway: '',
      autoDns: true,
      primaryDns: '',
      secondaryDns: '',
    },
    ipv6: {
      method: 'disabled',
      address: '',
      gateway: '',
      autoDns: true,
      primaryDns: '',
      secondaryDns: '',
    },
  },
  networkServices: {
    ntp: {
      autoConfig: true,
      servers: [],
    },
  },
  enrollment: {
    url: '',
    skipTlsVerification: false,
    authMethod: 'username-password',
    username: '',
    password: '',
    token: '',
  },
};

// Context type combining existing NetworkManager model and application model
interface ModelContextType {
  networkManager?: any; // Keep existing NetworkManager model
  model: Model;
  updateModel: (section: keyof Model, updates: Partial<Model[keyof Model]>) => void;
  updateNestedModel: <T extends keyof Model, K extends keyof Model[T]>(
    section: T,
    subsection: K,
    updates: Partial<Model[T][K]>
  ) => void;
}

// Create context
export const ModelContext = createContext<ModelContextType | undefined>(undefined);

// Provider component
export const ModelProvider: React.FunctionComponent<{ children: ReactNode; networkManager?: any }> = ({ children, networkManager }) => {
  const [model, setModel] = useState<Model>(initialModel);

  const updateModel = (section: keyof Model, updates: Partial<Model[keyof Model]>) => {
    setModel(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates,
      },
    }));
  };

  const updateNestedModel = <T extends keyof Model, K extends keyof Model[T]>(
    section: T,
    subsection: K,
    updates: Partial<Model[T][K]>
  ) => {
    setModel(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          ...updates,
        },
      },
    }));
  };

  return (
    <ModelContext.Provider value={{ networkManager, model: model, updateModel: updateModel, updateNestedModel: updateNestedModel }}>
      {children}
    </ModelContext.Provider>
  );
};

// Hook to use model context
export const useModelContext = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModelContext must be used within a ModelProvider');
  }
  return context;
};