import type { AddressProfile } from '../address-autofill/types';

export interface ExtensionSettings {
  addressAutofill: AddressAutofillSettings;
  updatedAt: number;
}

export interface AddressAutofillSettings {
  payOpenAiEnabled: boolean;
  payPalSignupEnabled: boolean;
  countryCode: string;
  city: string;
  fixedPassword?: string;
  fixedPhone?: string;
  lastAddress: AddressProfile | null;
  updatedAt: number;
}
