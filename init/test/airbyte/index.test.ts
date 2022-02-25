import {AirbyteInit} from '../../src/airbyte/init';

describe('airbyte', () => {
  test('get latest faros destination version', async () => {
    expect(await AirbyteInit.getLatestFarosDestinationVersion()).toBeTruthy();
  });
});
