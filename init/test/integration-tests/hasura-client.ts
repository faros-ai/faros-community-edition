import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import pino from 'pino';
import {VError} from 'verror';

const logger = pino({
  name: 'hasura-client',
  level: process.env.LOG_LEVEL || 'info',
});

export class HasuraClient {
  private readonly api: AxiosInstance;

  constructor(url: string, adminSecret?: string) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        'X-Hasura-Role': 'admin',
        ...(adminSecret && {'X-Hasura-Admin-Secret': adminSecret}),
      },
    });
  }

  async waitUntilHealthy(): Promise<void> {
    await retry(
      async () => {
        try {
          await this.api.get('/healthz');
        } catch (e) {
          throw new VError(e, 'Failed to check Hasura health');
        }
      },
      {
        retries: 3,
        minTimeout: 10000,
        maxTimeout: 10000,
        onRetry: (err, attempt) => {
          logger.info('attempt=%d err=%o', attempt, err);
        },
      }
    );
  }

  async getVcsUserCount(): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: 'query MyQuery { vcs_User_aggregate {aggregate{count}} }',
        variables: null,
      })
      .then((response) => response.data.data.vcs_User_aggregate.aggregate.count)
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdBuildCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { cicd_Build_aggregate(where: {\
          origin: {_eq: "${origin}"}}) {aggregate{count}} }`,
        variables: null,
      })
      .then(
        (response) => response.data.data.cicd_Build_aggregate.aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdPipelineCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { cicd_Pipeline_aggregate(where: {\
          origin: {_eq: "${origin}"}}) {aggregate{count}} }`,
        variables: null,
      })
      .then(
        (response) => response.data.data.cicd_Pipeline_aggregate.aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdOrganizationCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { cicd_Organization_aggregate(where: {\
          origin: {_eq: "${origin}"}}) {aggregate{count}} }`,
        variables: null,
      })
      .then(
        (response) =>
          response.data.data.cicd_Organization_aggregate.aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdArtifactCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { cicd_Artifact_aggregate(where: {\
          origin: {_eq: "${origin}"}}) {aggregate{count}} }`,
        variables: null,
      })
      .then(
        (response) => response.data.data.cicd_Artifact_aggregate.aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdArtifactCommitAssociationCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { \
            cicd_ArtifactCommitAssociation_aggregate(where: {\
              origin: {_eq: "${origin}"}}) {aggregate{count}} \
          }`,
        variables: null,
      })
      .then(
        (response) =>
          response.data.data.cicd_ArtifactCommitAssociation_aggregate.aggregate
            .count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getCicdRepositoryCount(origin: string): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { cicd_Repository_aggregate(where: {\
          origin: {_eq: "${origin}"}}) {aggregate{count}} }`,
        variables: null,
      })
      .then(
        (response) =>
          response.data.data.cicd_Repository_aggregate.aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }

  async getVcsPullRequestCommitAssociationCount(
    origin: string
  ): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: `query MyQuery { \
            vcs_PullRequestCommitAssociation_aggregate(where: {\
              origin: {_eq: "${origin}"}}) {aggregate{count}} \
          }`,
        variables: null,
      })
      .then(
        (response) =>
          response.data.data.vcs_PullRequestCommitAssociation_aggregate
            .aggregate.count
      )
      .catch((err) => {
        logger.info(`query failed with error: ${err}`);
      });
  }
}
