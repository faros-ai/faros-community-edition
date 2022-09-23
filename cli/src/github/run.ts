import {Airbyte} from '../airbyte/airbyte-client';
import {display, errorLog, sleep} from '../utils';
import ProgressBar from 'progress';
import {Octokit} from '@octokit/core';
import {runMultiSelect, runPassword} from '../utils/prompts';
import VError from 'verror';

const GITHUB_SOURCE_ID = '5d9079ca-8173-406f-bfdb-41f19c62daff';
const GITHUB_CONNECTION_ID = '6421df4e-0c5a-4666-a530-9c01de683518';
const DEFAULT_CUTOFF_DAYS = 30;

export async function runGithub(airbyte: Airbyte): Promise<void> {
  const token = await runPassword({
    name: 'token',
    message: 'Personal Access Token?',
  });

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_CUTOFF_DAYS);

  try {
    const repos = await runMultiSelect({
      name: 'repos',
      message: 'Pick your favorite repos',
      limit: 10,
      choices: await getRepos(token),
    });

    if (repos.length === 0) {
      return;
    }

    display('Setting up source');
    await airbyte.setupSource({
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

  try {
    display('Syncing');
    const job = await airbyte.triggerSync(GITHUB_CONNECTION_ID);

    const syncBar = new ProgressBar(':bar', {
      total: 2,
      complete: '.',
      incomplete: ' ',
    });

    let val = 1;
    while (true) {
      syncBar.tick(val);
      val *= -1;
      const status = await airbyte.getJobStatus(job);
      if (status !== 'running') {
        syncBar.terminate();
        display('Syncing ' + status);
        break;
      }
      await sleep(100);
    }
  } catch (error) {
    errorLog('Sync failed', error);
    return;
  }
}

async function getRepos(token: string): Promise<ReadonlyArray<string>> {
  const octokit = new Octokit({auth: token});
  const response = await octokit.request('GET /user/repos', {}).catch((err) => {
    throw new VError(err);
  });
  return response.data.map((repo) => repo.full_name);
}
