/**
 * Enquirer prompts. These are isolated in their own module to ease mocking
 * (`jest` works best when mocking a module at a time and prompts typically
 * need to be mocked).
 */
import enquirer from 'enquirer';

export interface ConfirmConfig {
  name: string;
  message: string;
}

class CustomConfirm extends (enquirer as any).Confirm {
  constructor(cfg: ConfirmConfig) {
    super(cfg);
  }

  format(input: string): string {
    return super.format(this.isTrue(input) ? 'yes' : 'no');
  }
}

export function runConfirm(cfg: ConfirmConfig): Promise<boolean> {
  return new CustomConfirm(cfg).run();
}

export interface SelectConfig {
  name: string;
  message: string;
  choices: ReadonlyArray<string>;
}

export function runSelect(cfg: SelectConfig): Promise<string> {
  return new (enquirer as any).Select(cfg).run();
}

export interface PasswordConfig {
  name: string;
  message: string;
}

export function runPassword(cfg: PasswordConfig): Promise<string> {
  return new (enquirer as any).Password(cfg).run();
}

export interface MultiSelectConfig {
  name: string;
  message: string;
  choices: ReadonlyArray<string>;
  limit: number;
}

export function runMultiSelect(
  cfg: MultiSelectConfig
): Promise<ReadonlyArray<string>> {
  return new (enquirer as any).MultiSelect(cfg).run();
}

export interface InputConfig {
  name: string;
  message: string;
}

export function runInput(cfg: InputConfig): Promise<string> {
  return new (enquirer as any).Input(cfg).run();
}
