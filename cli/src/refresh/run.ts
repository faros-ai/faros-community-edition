import {Command} from 'commander';

import {Airbyte} from '../airbyte/airbyte-client';
import {BITBUCKET_CONNECTION_ID} from '../bitbucket/run';
import {GITHUB_CONNECTION_ID} from '../github/run';
import {GITLAB_CONNECTION_ID} from '../gitlab/run';
import {JIRA_CONNECTION_ID} from '../jira/run';
import {Metabase} from '../metabase/metabase-client';
import {display} from '../utils';

interface RefreshConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
}

export function makeRefreshCommand(): Command {
  const cmd = new Command().name('refresh');

  cmd.action(async (options) => {
    const airbyte = new Airbyte(options.airbyteUrl);
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.metabaseUsername,
      password: options.metabasePassword,
    });

    await runRefresh({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runRefresh(cfg: RefreshConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  let work = false;

  if (await cfg.airbyte.isActiveConnection(GITHUB_CONNECTION_ID)) {
    display('refreshing GitHub');
    work = true;
    await cfg.airbyte.refresh(GITHUB_CONNECTION_ID);
  }

  if (await cfg.airbyte.isActiveConnection(GITLAB_CONNECTION_ID)) {
    display('refreshing GitLab');
    work = true;
    await cfg.airbyte.refresh(GITLAB_CONNECTION_ID);
  }

  if (await cfg.airbyte.isActiveConnection(BITBUCKET_CONNECTION_ID)) {
    display('refreshing Bitbucket');
    work = true;
    await cfg.airbyte.refresh(BITBUCKET_CONNECTION_ID);
  }

  if (await cfg.airbyte.isActiveConnection(JIRA_CONNECTION_ID)) {
    display('refreshing Jira');
    work = true;
    await cfg.airbyte.refresh(JIRA_CONNECTION_ID);
  }

  if (!work) {
    display('nothing to refresh');
  }
}
