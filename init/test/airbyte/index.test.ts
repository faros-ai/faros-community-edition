import nock from 'nock';

import {AirbyteInit, FAROS_DEST_REPO} from '../../src/airbyte/init';

describe('airbyte', () => {
  test('get latest Faros Destination version', async () => {
    expect(await AirbyteInit.getLatestImageTag(FAROS_DEST_REPO)).toBeTruthy();
  });

  test('send identity event with email', async () => {
    const host = 'http://test.test.com';

    let identify;
    const identityMock = nock(host)
      .post('/v1/batch', (body) => {
        identify = body;
        return body;
      })
      .reply(200, {});

    const email = 'test@test.com';
    const userId = '35d3e578-aa0b-540c-b5d0-6bd33f231dfb';

    process.env.FAROS_EMAIL = email;
    const segmentUser = AirbyteInit.makeSegmentUser();
    expect(segmentUser).toStrictEqual({userId, email});

    await AirbyteInit.sendIdentity(segmentUser, host);
    identityMock.done();

    expect(identify).toStrictEqual({
      batch: [
        {
          _metadata: expect.anything(),
          context: expect.anything(),
          messageId: expect.anything(),
          timestamp: expect.anything(),
          traits: {email},
          type: 'identify',
          userId,
        },
      ],
      sentAt: expect.anything(),
      timestamp: expect.anything(),
    });
  });

  test('send identity event even if email is not set', async () => {
    const host = 'http://test.test.com';

    let identify;
    const identityMock = nock(host)
      .post('/v1/batch', (body) => {
        identify = body;
        return body;
      })
      .reply(200, {});

    const email = 'anonymous@anonymous.me';

    delete process.env.FAROS_EMAIL;
    const segmentUser = AirbyteInit.makeSegmentUser();
    expect(segmentUser).toStrictEqual({userId: expect.anything(), email});

    await AirbyteInit.sendIdentity(segmentUser, host);
    identityMock.done();

    expect(identify).toStrictEqual({
      batch: [
        {
          _metadata: expect.anything(),
          context: expect.anything(),
          messageId: expect.anything(),
          timestamp: expect.anything(),
          traits: {email},
          type: 'identify',
          userId: expect.anything(),
        },
      ],
      sentAt: expect.anything(),
      timestamp: expect.anything(),
    });
  });
});
