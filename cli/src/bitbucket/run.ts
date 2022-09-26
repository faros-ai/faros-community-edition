import axios from 'axios';
import {Bitbucket} from 'bitbucket';
import {APIClient} from 'bitbucket/src/client/types';
import {Command, Option} from 'commander';
import ProgressBar from 'progress';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {display, errorLog, sleep, toStringList} from '../utils';
import {
  runInput,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const BITBUCKET_SOURCE_ID = '5a19e927-51a2-4d5f-9b26-b35aba0910e0';
const BITBUCKET_CONNECTION_ID = '2093cc9f-81d5-47df-8c14-d898c89f4c81';
const DEFAULT_CUTOFF_DAYS = 30;

interface BitbucketConfig {
  readonly airbyte: Airbyte;
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly workspace?: string;
  readonly repoList?: ReadonlyArray<string>;
}

export function makeBitbucketCommand(): Command {
  const cmd = new Command()
    .name('bitbucket')
    .option('--username <username>', 'Username')
    .option('--password <password>', 'Password')
    .option('--token <token>', 'Personal Access Token')
    .option('--workspace <workspace>', 'Workspace')
    .addOption(
      new Option(
        '--repo-list <repo-list>',
        'Comma-separated list of repos to sync'
      ).argParser(toStringList)
    );

  cmd.action((options) => {
    const airbyte = new Airbyte(
      axios.create({
        baseURL: `${options.airbyteUrl}/api/v1`,
      })
    );

    runBitbucket({...options, airbyte});
  });

  return cmd;
}

export async function runBitbucket(cfg: BitbucketConfig): Promise<void> {
  try {
    await cfg.airbyte.waitUntilHealthy();

    let authenticationMethod;
    if (cfg.token) {
      authenticationMethod = 'Personal Access Token';
    } else if (cfg.username || cfg.password) {
      authenticationMethod = 'Username/Password';
    } else {
      authenticationMethod = await runSelect({
        name: 'authenticationMethod',
        message: 'Choose your authentication method',
        choices: ['Username/Password', 'Personal Access Token'],
      });
    }

    let bitbucket = new Bitbucket({});
    let username, password, token;

    switch (authenticationMethod) {
      case 'Username/Password':
        username =
          cfg.username ||
          (await runInput({
            name: 'username',
            message: 'Username?',
          }));
        password =
          cfg.password ||
          (await runPassword({
            name: 'password',
            message: 'Password?',
          }));
        bitbucket = new Bitbucket({
          auth: {
            username,
            password,
          },
        });
        break;
      case 'Personal Access Token':
        token =
          cfg.password ||
          (await runPassword({
            name: 'token',
            message: 'Personal Access Token?',
          }));
        bitbucket = new Bitbucket({
          auth: {
            token,
          },
        });
        break;
    }

    const workspaces =
      cfg.workspace ||
      (await runSelect({
        name: 'workspaces',
        message: 'Pick your favorite workspace',
        choices: await getWorkspaces(bitbucket),
      }));

    const repositories =
      cfg.repoList ||
      (await runMultiSelect({
        name: 'repos',
        message: 'Pick your favorite repos',
        limit: 10,
        choices: await getRepos(workspaces, bitbucket),
      }));

    if (repositories.length === 0) {
      return;
    }

    display('Setting up source');
    await cfg.airbyte.setupSource({
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

  await cfg.airbyte.triggerAndTrackSync(BITBUCKET_CONNECTION_ID);
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
  const {data} = await bitbucket.workspaces
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
  const {data} = await bitbucket.repositories
    .list({workspace})
    .catch((err: string | undefined) => {
      throw new VError(err);
    });
  return (data.values as ReadonlyArray<Repository>).map((repo) => {
    return repo.full_name;
  });
}
