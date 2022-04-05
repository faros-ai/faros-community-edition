import {Command} from 'commander';
import path from 'path';
import {pino} from 'pino';

import {MockData} from './mockdata';

const logger = pino({name: 'faros-ce-mock-data'});

function createCommand(
  name: string,
  fn: (mockData: MockData) => Promise<void>
): Command {
  return new Command(name)
    .option('-u, --url <url>', 'Hasura Service URL', 'http://localhost:8080')
    .option('--admin-secret <string>', 'Hasura Service Admin Password')
    .action(async (opts) => {
      const mockData = new MockData(opts.url, opts.adminSecret);
      await fn(mockData);
    });
}

export const program = new Command()
  .name('mock-data')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  .version(require(path.join(__dirname, '..', 'package.json')).version)
  .addCommand(
    createCommand('upload', async (mockData: MockData) => {
      logger.info('Started uploading mock data.');
      await mockData.uploadData();
      logger.info('Mock data upload complete.');
    })
    .description('upload mock data')
  )
  .addCommand(
    createCommand('delete', async (mockData: MockData) => {
      logger.info('Deleting mock data.');
      await mockData.deleteData();
      logger.info('Deleting mock data complete.');
    })
    .description('delete mock data')
  );
