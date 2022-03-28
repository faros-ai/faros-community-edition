import {InvalidArgumentError, Option, program} from 'commander';
import pino from 'pino';

import {Dashboards} from './dashboards';

const logger = pino({
  name: 'metabase-init',
  level: process.env.LOG_LEVEL || 'info',
});

async function main(): Promise<void> {
  program
    .requiredOption('--metabase-url <string>')
    .requiredOption('--username <string>')
    .requiredOption('--password <string>')
    .requiredOption('--database <string>')
    .addOption(new Option('--export <dashboardId>').conflicts('import'))
    .addOption(new Option('--import').conflicts('export'));

  program.parse();
  const options = program.opts();

  if (!options.export && !options.import) {
    throw new InvalidArgumentError('Must use with import or export');
  }

  const dashboards = await Dashboards.fromConfig({
    metabase: {
      url: options.metabaseUrl,
      username: options.username,
      password: options.password,
    },
    databaseName: options.database,
    logger,
  });

  if (options.export) {
    console.log(await dashboards.export(parseInt(options.export, 10)));
  } else {
    await dashboards.import();
    logger.info('Metabase import is complete');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
