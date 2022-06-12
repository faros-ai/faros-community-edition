import {Option, program} from 'commander';
import pino from 'pino';

import {Dashboards} from './dashboards';
import {Metabase} from './metabase';

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
    .addOption(
      new Option('--export <dashboardId>')
        .conflicts('importOne')
        .conflicts('importNew')
    )
    .addOption(
      new Option('--import-one <filename>')
        .conflicts('export')
        .conflicts('importNew')
    )
    .addOption(
      new Option('--import-new').conflicts('export').conflicts('importOne')
    )
    .addOption(new Option('--sync-schema'));

  program.parse();
  const options = program.opts();

  if (options.syncSchema) {
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.username,
      password: options.password,
    });

    await metabase.syncSchema(options.database);
    logger.info('Metabase sync schema triggered');
  } else {
    if (!options.export && !options.importOne && !options.importNew) {
      program.help();
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
      if (options.importNew) {
        await dashboards.importNew();
      } else {
        await dashboards.importOne(options.importOne);
      }
      logger.info('Metabase import is complete');
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
