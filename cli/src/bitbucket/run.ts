import {Airbyte} from '../airbyte/airbyte-client';
import {display, errorLog, sleep} from '../utils';
import ProgressBar from 'progress';

import {
  runInput,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';
import VError from 'verror';
import {Bitbucket} from 'bitbucket';
import {APIClient} from 'bitbucket/src/client/types';

const BITBUCKET_SOURCE_ID = '5a19e927-51a2-4d5f-9b26-b35aba0910e0';
const BITBUCKET_CONNECTION_ID = '2093cc9f-81d5-47df-8c14-d898c89f4c81';
const DEFAULT_CUTOFF_DAYS = 30;

export async function runBitbucket(airbyte: Airbyte): Promise<void> {
  try {
    const authenticationMethod = await runSelect({
      name: 'authenticationMethod',
      message: 'Choose your authentication method',
      choices: ['Username/Password', 'Personal Access Token'],
    });

    let bitbucket = new Bitbucket({});
    let username, password, token;

    switch (authenticationMethod) {
      case 'Username/Password':
        username = await runInput({
          name: 'username',
          message: 'Username?',
        });
        password = await runPassword({
          name: 'password',
          message: 'Password?',
        });
        bitbucket = new Bitbucket({
          auth: {
            username,
            password,
          },
        });
        break;
      case 'Personal Access Token':
        token = await runPassword({
          name: 'token',
          message: 'Personal Access Token?',
        });
        bitbucket = new Bitbucket({
          auth: {
            token,
          },
        });
        break;
    }

    const workspaces = await runSelect({
      name: 'workspaces',
      message: 'Pick your favorite workspace',
      choices: await getWorkspaces(bitbucket),
    });

    const repositories = await runMultiSelect({
      name: 'repos',
      message: 'Pick your favorite repos',
      limit: 10,
      choices: await getRepos(workspaces, bitbucket),
    });

    if (repositories.length === 0) {
      return;
    }

    display('Setting up source');
    await airbyte.setupSource({
      connectionConfiguration: {
        workspaces: [workspaces],
        repositories,
        cutoff_days: DEFAULT_CUTOFF_DAYS,
        username,
        password,
        token,
        pagelen: 10,
      },
      name: 'Bitbucket',
      sourceId: BITBUCKET_SOURCE_ID,
    });

    display('Setup succeeded');
  } catch (error) {
    errorLog('Setup failed', error);
    return;
  }

  try {
    display('Syncing');
    const job = await airbyte.triggerSync(BITBUCKET_CONNECTION_ID);

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

interface Workspace {
  name: string;
  slug: string;
}

interface Repository {
  full_name: string;
}

async function getWorkspaces(
  bitbucket: APIClient
): Promise<ReadonlyArray<string>> {
  const {data, headers} = await bitbucket.workspaces
    .getWorkspaces({})
    .catch((err: string | undefined) => {
      throw new VError(err);
    });

  return (data.values as ReadonlyArray<Workspace>).map((workspace) => {
    return workspace.slug;
  });
}

async function getRepos(
  workspace: string,
  bitbucket: APIClient
): Promise<ReadonlyArray<string>> {
  const {data, headers} = await bitbucket.repositories
    .list({workspace})
    .catch((err: string | undefined) => {
      throw new VError(err);
    });
    return (data.values as ReadonlyArray<Repository>).map((repo) => {
      return repo.full_name;
    });
}
