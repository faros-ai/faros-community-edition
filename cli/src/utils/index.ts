import chalk from 'chalk';
import {promisify} from 'util';
import VError from 'verror';

export function sleep(millis: number): Promise<void> {
  return promisify(setTimeout)(millis);
}

export function display(msg: any, ...args: any[]): void {
  if (!process.env.FAROS_SILENT) {
    console.log(msg, ...args);
  }
}

export function verboseLog(msg: any, ...args: any[]): void {
  if (process.env.FAROS_VERBOSE) {
    console.log(msg, ...args);
  }
}

export function errorLog(msg: string, ...args: any[]): void {
  console.error(chalk.red(msg), ...args);
}

export function warn(msg: any, ...args: any[]): void {
  console.error(chalk.yellow(msg), ...args);
}

export function toStringList(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value
    .split(',')
    .map((x) => x.trim())
    .filter((p) => p);
}

export function parseInteger(value: string): number {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue) || isNaN(Number(value))) {
    throw new VError('Invalid integer: %s', value);
  }
  return parsedValue;
}

export function parseIntegerPositive(value: string): number {
  const parsedValue = parseInteger(value);
  if (parsedValue <= 0) {
    throw new VError('Not positive: %s', value);
  }
  return parsedValue;
}
