import {AxiosError} from 'axios';
import chalk from 'chalk';
import flatCache from 'flat-cache';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {stdin} from 'process';
import {promisify} from 'util';

const CACHE_ID = 'cache';

export const HOME =
  process.env.FAROS_HOME || path.resolve(os.homedir(), '.faros');

// Requiring JSON files requires tsc shenanigans beyond resolveJsonModule.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const PACKAGE = require('../../package.json');

export const CACHE = flatCache.load(CACHE_ID, HOME);

export const DOCS_URL = 'https://www.faros.ai/docs';
export const API_BASE_URL = process.env.FAROS_API_URL || 'https://api.faros.ai';

export async function sleep(millis: number): Promise<void> {
  return promisify(setTimeout)(millis);
}

export function display(msg: any, ...args: any[]): void {
  if (!process.env.FAROS_SILENT) {
    console.log(msg, ...args);
  }
}

export function verboseLog(msg: any, ...args: any[]): void {
  if (process.env.FAROS_VERBOSE) console.log(msg, ...args);
}

export function errorLog(msg: string, ...args: any[]): void {
  console.error(chalk.red(msg), ...args);
}

export function warn(msg: any, ...args: any[]): void {
  console.error(chalk.yellow(msg), ...args);
}

// https://stackoverflow.com/a/51506718/1062617
export function wrap(lines: string[]): string {
  const width = process.stdout.columns || 78;
  return lines
    .join('')
    .replace(
      new RegExp(`(?![^\\n]{1,${width}}$)([^\\n]{1,${width}})\\s`, 'g'),
      '$1\n'
    );
}

// export async function checkLatestVersion(): Promise<void> {
//   if (process.env.FAROS_SKIP_VERSION_CHECK == 'true') {
//     return;
//   }
//   const key = 'version-check';
//   const lastCheckMillis = CACHE.getKey(key);
//   // Show the message at most once per day to avoid spamming users.
//   const nowMillis = Date.now();
//   if (lastCheckMillis && lastCheckMillis > nowMillis - 1000 * 3600 * 24) {
//     return;
//   }
//   CACHE.setKey(key, nowMillis);
//   CACHE.save(true);
//   const version = await latestVersion(PACKAGE.name);
//   if (semver.lt(PACKAGE.version, version)) {
//     display(
//       wrap([
//         `A newer version of this CLI is now available (${version})! `,
//         `Please upgrade by running \`npm i -g ${PACKAGE.name}\`.`,
//       ])
//     );
//   }
// }

async function setPathPermissions(path: string, mode: string): Promise<void> {
  if (!(await fs.pathExists(path))) {
    return;
  }
  const stats = await fs.stat(path);
  const perms = '0' + (stats.mode & parseInt('777', 8)).toString(8);
  if (perms !== mode) {
    verboseLog(wrap([`Setting ${path} permissions to ${mode}`]));
    await fs.chmod(path, mode);
  }
}

export async function setHomeDirPermissions(): Promise<void> {
  // TODO: windows support
  if (process.platform === 'win32') {
    return;
  }
  await setPathPermissions(HOME, '0700');
  await setPathPermissions(path.join(HOME, CACHE_ID), '0600');
}

export function apiError(message: string, error: AxiosError): Error {
  verboseLog(error);
  return new Error(
    `${message}\n${error.message}\nResponse body: ${JSON.stringify(
      error.response?.data
    )}`
  );
}

export function assert(
  condition: any,
  msg = 'no additional info provided'
): asserts condition {
  if (!condition) {
    throw new Error('Assertion Error: ' + msg);
  }
}

// export async function readJsonInput(input: string): Promise<any> {
//   let json;
//   if (input == '-') {
//     json = await readStdin();
//   } else {
//     try {
//       json = await fs.readFile(input, 'utf8');
//     } catch (err) {
//       if (err.code != 'ENOENT') {
//         throw err;
//       }
//       json = input;
//     }
//   }
//   return JSON.parse(json);
// }

async function readStdin(): Promise<string> {
  let result = '';
  // can fail if user's terminal's default encoding is not utf8
  stdin.setEncoding('utf8');
  for await (const chunk of stdin) {
    result += chunk;
  }
  return result;
}
