import {Bitbucket} from 'bitbucket';
import {APIClient} from 'bitbucket/src/client/types';
import {Command, Option} from 'commander';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {wrapApiError} from '../cli';
import {Metabase} from '../metabase/metabase-client';
import {
  display,
  Emoji,
  errorLog,
  parseIntegerPositive,
  toStringList,
} from '../utils';
import {
  runInput,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const DEFAULT_CUTOFF_DAYS = 30;
const DEFAULT_API_URL = 'https://api.bitbucket.org/2.0';

interface BitbucketConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
  readonly serverUrl?: string;
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly workspace?: string;
  readonly repoList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeBitbucketCommand(): Command {
  const cmd = new Command()
    .name('bitbucket')
    .option('--username <username>', 'Username')
    .option('--password <password>', 'App Password')
    .option('--workspace <workspace>', 'Workspace')
    .addOption(
      new Option(
        '--repo-list <repo-list>',
        'Comma-separated list of repos to sync'
      ).argParser(toStringList)
    )
    .option(
      '--cutoff-days <cutoff-days>',
      'only fetch entities updated after this cutoff',
      parseIntegerPositive,
      DEFAULT_CUTOFF_DAYS
    );

  cmd.action(async (options) => {
    const airbyte = new Airbyte(options.airbyteUrl);
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.metabaseUsername,
      password: options.metabasePassword,
    });
    await runBitbucket({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runBitbucket(cfg: BitbucketConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();

  const serverUrl = DEFAULT_API_URL;

  const username =
    cfg.username ||
    (await runInput({
      name: 'username',
      message: 'Username?',
    }));

  if (!cfg.password) {
    display(
      `Provide Bitbucket "App Password" with read permissions:  
      Account: read
      Pull Requests: read
      Issues: read
      Workspace membership: read
      Projects: read
      Repositories: read
      Pipelines: read`
    );
    display('Note: Bitbucket Server not yet supported');
  }
  const password =
    cfg.password ||
    (await runPassword({
      name: 'token',
      message: 'Enter your App Password',
    }));
  const bitbucket = new Bitbucket({
    auth: {
      username,
      password,
    },
  });

  let workspaces = cfg.workspace;
  let repos = cfg.repoList;

  try {
    if (!repos || repos.length === 0) {
      try {
        if ((await getWorkspaces(bitbucket)).length === 0) {
          throw new VError('No workspaces found');
        }
      } catch (error) {
        errorLog(
          'No workspaces found with those credentials %s',
          Emoji.FAILURE
        );
        return;
      }
      let done = false;
      while (!done) {
        workspaces =
          cfg.workspace ||
          (await runSelect({
            name: 'workspaces',
            message: 'Select your favorite workspace',
            choices: await getWorkspaces(bitbucket),
          }));

        repos =
          cfg.repoList ||
          (await runMultiSelect({
            name: 'repos',
            message:
              'Select your favorite repos with SPACEBAR; press ENTER when done',
            limit: 10,
            choices: await getRepos(workspaces, bitbucket),
          }));

        if (repos.length === 0) {
          display(
            'Your selection was empty; remember to use the SPACEBAR to select!',
            Emoji.EMPTY
          );
          const tryAgainPrompt = await runSelect({
            name: 'tryAgainPrompt',
            message:
              // eslint-disable-next-line max-len
              'Do you want to try selecting again with the current credentials?',
            choices: ['Yes', 'No, let me start over'],
          });

          switch (tryAgainPrompt) {
            case 'Yes':
              continue;
            case 'No, let me start over':
              return;
          }
        }
        done = true;
      }
    }

    const bitbucketSourceId = await cfg.airbyte.findFarosSource('Bitbucket');
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        serverUrl,
        workspaces: [workspaces],
        repositories: repos,
        cutoff_days: cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
        username,
        password,
        pagelen: 10,
      },
      name: 'Bitbucket',
      sourceId: bitbucketSourceId,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  const bitbucketConnectionId = await cfg.airbyte.findFarosConnection(
    'Bitbucket - Faros'
  );
  await cfg.airbyte.triggerAndTrackSync(
    bitbucketConnectionId,
    'Bitbucket',
    cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
    repos?.length || 0
  );

  try {
    await cfg.metabase.forceSync();
  } catch (error) {
    // main intent is to have filters immediately populated with values
    // we do nothing on failure, basic functionalities are not impacted
    // daily/hourly metabase db scans will eventually get us there
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
  const {data} = await bitbucket.workspaces
    .getWorkspaces({})
    .catch((err: string | undefined) => {
      throw wrapApiError(err, 'Failed to get workspaces');
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
      throw wrapApiError(err, 'Failed to get repos');
    });
  return (data.values as ReadonlyArray<Repository>).map((repo) => {
    return repo.full_name;
  });
}
