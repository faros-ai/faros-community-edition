import {Octokit} from '@octokit/core';
import axios from 'axios';
import {Command, Option} from 'commander';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {display, errorLog, parseIntegerPositive, toStringList} from '../utils';
import {runMultiSelect, runPassword} from '../utils/prompts';

const GITHUB_SOURCE_ID = '5d9079ca-8173-406f-bfdb-41f19c62daff';
const GITHUB_CONNECTION_ID = '6421df4e-0c5a-4666-a530-9c01de683518';
const DEFAULT_CUTOFF_DAYS = 30;

interface GithubConfig {
  readonly airbyte: Airbyte;
  readonly token?: string;
  readonly repoList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeGithubCommand(): Command {
  const cmd = new Command()
    .name('github')
    .option('--token <token>', 'Personal Access Token')
    .addOption(
      new Option(
        '--repo-list <repo-list>',
        'Comma-separated list of repos to sync'
      ).argParser(toStringList)
    )
    .option(
      '--cutoff-days <cutoff-days>',
      'only fetch commits, issues and pull requests updated in the last number of days',
      parseIntegerPositive,
      DEFAULT_CUTOFF_DAYS
    );

  cmd.action((options) => {
    const airbyte = new Airbyte(
      axios.create({
        baseURL: `${options.airbyteUrl}/api/v1`,
      })
    );

    runGithub({...options, airbyte});
  });

  return cmd;
}

export async function runGithub(cfg: GithubConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();

  const token =
    cfg.token ||
    (await runPassword({
      name: 'token',
      message: 'Personal Access Token?',
    }));

  const startDate = new Date();
  startDate.setDate(
    startDate.getDate() - (cfg.cutoffDays || DEFAULT_CUTOFF_DAYS)
  );

  try {
    const repos =
      cfg.repoList ||
      (await runMultiSelect({
        name: 'repos',
        message: 'Pick your favorite repos',
        limit: 10,
        choices: await getRepos(token),
      }));

    if (repos.length === 0) {
      return;
    }

    display('Setting up source');
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        repository: repos.join(' '),
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        credentials: {
          option_title: 'PAT Credentials',
          personal_access_token: token,
        },
        page_size_for_large_streams: 10,
      },
      name: 'GitHub',
      sourceId: GITHUB_SOURCE_ID,
    });

    display('Setup succeeded');
  } catch (error) {
    errorLog('Setup failed', error);
    return;
  }

  await cfg.airbyte.triggerAndTrackSync(GITHUB_CONNECTION_ID);
}

async function getRepos(token: string): Promise<ReadonlyArray<string>> {
  const octokit = new Octokit({auth: token});
  const response = await octokit.request('GET /user/repos', {}).catch((err) => {
    throw new VError(err);
  });
  return response.data.map((repo) => repo.full_name);
}
