import type { ComponentContract } from './types';

export const contracts: Record<ComponentContract, { name: string; journey: string; scope: string }> = {
  signup: { name: 'Signup', journey: 'Create account', scope: 'Keyboard · Labels · Validation' },
  login: { name: 'Login', journey: 'Sign in', scope: 'Keyboard · Credentials · Feedback' },
  dialog: { name: 'Confirmation dialog', journey: 'Confirm a change', scope: 'Focus trap · Escape · Cancel' },
  navigation: { name: 'Navigation', journey: 'Choose a destination', scope: 'Keyboard · Current page · Destinations' },
};
export const isContract = (value: string): value is ComponentContract => Object.hasOwn(contracts, value);
