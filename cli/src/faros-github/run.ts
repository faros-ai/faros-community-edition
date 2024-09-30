import {Command, Option} from 'commander';
import {isFinite, parseInt} from 'lodash';

import {Airbyte} from '../airbyte/airbyte-client';
import {Metabase} from '../metabase/metabase-client';
import {
  display,
  Emoji,
  errorLog,
  parseIntegerPositive,
  runAndValidateInput,
  toStringList,
} from '../utils';
import {runInput, runPassword, runSelect} from '../utils/prompts';

const DEFAULT_CUTOFF_DAYS = 30;

interface Token {
  type: 'token';
  personal_access_token: string;
}

interface App {
  type: 'app';
  app_id: number;
  private_key: string;
}

type GitHubAuth = Token | App;

interface FarosGithubConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
  url?: string;
  personalAccessToken?: string;
  appId?: number;
  privateKey?: string;
  readonly cutoffDays?: number;
  readonly organizations?: ReadonlyArray<string>;
  readonly excludedOrganizations?: ReadonlyArray<string>;
  readonly repositories?: ReadonlyArray<string>;
  readonly excludedRepositories?: ReadonlyArray<string>;
}

export function makeFarosGithubCommand(): Command {
  const cmd = new Command()
    .name('faros-github')
    .option('--url <url>', 'GitHub URL')
    .option('--personal-access-token <token>', 'GitHub Personal Access Token')
    .option('--app-id <appId>', 'GitHub App ID', parseIntegerPositive)
    .option('--private-key <key>', 'GitHub App Private Key')
    .addOption(
      new Option(
        '--organizations <organizations>',
        'Comma-separated list of organizations to sync'
      ).argParser(toStringList)
    )
    .addOption(
      new Option(
        '--excluded-organizations <excluded-organizations>',
        'Comma-separated list of organizations to exclude from sync'
      ).argParser(toStringList)
    )
    .addOption(
      new Option(
        '--repositories <repositories>',
        'Comma-separated list of repositories to sync'
      ).argParser(toStringList)
    )
    .addOption(
      new Option(
        '--excluded-repositories <excluded-repositories>',
        'Comma-separated list of repositories to exclude from sync'
      ).argParser(toStringList)
    )
    .option(
      '--cutoff-days <cutoff-days>',
      'only fetch commits, issues and pull requests updated in the last ' +
        'number of days',
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

    await runFarosGithub({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runFarosGithub(cfg: FarosGithubConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  try {
    const githubSourceId = await cfg.airbyte.findFarosSource('Faros GitHub');

    const authentication = await createAuthCreds(cfg);
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        url: cfg.url,
        authentication,
        organizations: cfg.organizations,
        excluded_organizations: cfg.excludedOrganizations,
        repositories: cfg.repositories,
        excluded_repositories: cfg.excludedRepositories,
        cutoff_days: cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
      },
      name: 'Faros GitHub',
      sourceId: githubSourceId,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  const githubConnectionId = await cfg.airbyte.findFarosConnection(
    'FarosGitHub - Faros'
  );
  await cfg.airbyte.triggerAndTrackSync(
    githubConnectionId,
    'FarosGitHub',
    cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
    cfg.repositories?.length || 0
  );

  try {
    await cfg.metabase.forceSync();
  } catch (error) {
    // main intent is to have filters immediately populated with values
    // we do nothing on failure, basic functionalities are not impacted
    // daily/hourly metabase db scans will eventually get us there
  }
}

async function createAuthCreds(cfg: FarosGithubConfig): Promise<GitHubAuth> {
  if (!cfg.personalAccessToken && (!cfg.privateKey || !cfg.appId)) {
    display('Invalid GitHub authentication. Configure it now.', Emoji.WARNING);

    const authType = await runSelect({
      name: 'auth-type',
      message: 'Select your authentication method',
      choices: ['Personal Access Token', 'GitHub App'],
    });

    if (authType === 'Personal Access Token') {
      const token = await runAndValidateInput(
        runPassword,
        {
          name: 'personal_access_token',
          message: 'Enter your GitHub Personal Access Token',
        },
        'Personal Access Token cannot be empty'
      );
      return {
        type: 'token',
        personal_access_token: token,
      };
    }

    const appId = await runAndValidateInput(
      runInput,
      {name: 'app_id', message: 'Enter your GitHub App ID'},
      'Please enter a valid integer for the App ID',
      (input: any) => isFinite(parseInt(input))
    );

    const privateKey = await runAndValidateInput(
      runPassword,
      {name: 'private_key', message: 'Enter your GitHub App private key'},
      'Private key cannot be empty'
    );

    return {
      type: 'app',
      app_id: parseInt(appId),
      private_key: privateKey,
    };
  }

  if (cfg.personalAccessToken) {
    return {
      type: 'token',
      personal_access_token: cfg.personalAccessToken,
    };
  }

  if (cfg.appId && cfg.privateKey) {
    return {
      type: 'app',
      app_id: cfg.appId,
      private_key: cfg.privateKey,
    };
  }

  throw new Error('Invalid GitHub authentication configuration');
}
