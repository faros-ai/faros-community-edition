import nock from 'nock';

import {AirbyteInit, FAROS_DEST_REPO} from '../../../src/airbyte/init';

describe('airbyte', () => {
  test('get latest Faros Destination version', async () => {
    expect(await AirbyteInit.getLatestImageTag(FAROS_DEST_REPO)).toBeTruthy();
  });

  test('send identity and start event with email', async () => {
    const host = 'http://test.test.com';

    const bodies = [];
    const analyticsMock = nock(host)
      .post('/v1/batch', (body) => {
        bodies.push(body);
        return body;
      })
      .once()
      .reply(200, {});

    const email = 'test@test.com';
    const userId = '35d3e578-aa0b-540c-b5d0-6bd33f231dfb';
    const version = '123';
    const source = 'test';

    process.env.FAROS_EMAIL = email;
    process.env.FAROS_INIT_VERSION = version;
    process.env.FAROS_START_SOURCE = source;
    const segmentUser = AirbyteInit.makeSegmentUser();
    expect(segmentUser).toStrictEqual({userId, email, version, source});

    await AirbyteInit.sendIdentityAndStartEvent(segmentUser, host);
    analyticsMock.done();

    expect(bodies.length).toEqual(1);
    expect(bodies[0]).toStrictEqual({
      batch: [
        {
          _metadata: expect.anything(),
          context: expect.anything(),
          integrations: expect.anything(),
          messageId: expect.anything(),
          timestamp: expect.anything(),
          traits: {email, version, source},
          type: 'identify',
          userId,
        },
        {
          _metadata: expect.anything(),
          context: expect.anything(),
          event: 'Start',
          integrations: expect.anything(),
          messageId: expect.anything(),
          properties: expect.anything(),
          timestamp: expect.anything(),
          type: 'track',
          userId,
        },
      ],
      sentAt: expect.anything(),
    });
  });
});
