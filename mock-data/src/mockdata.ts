import {DateTime} from 'luxon';

import {Hasura} from './hasura';

const ORIGIN = 'faros-ce-mock-data';
const SOURCE = 'FarosCE-MockData';
const REPO = 'Example Repo';
const ORG = 'Example Org';

export class MockData {
  private hasura: Hasura;
  constructor(hasuraBaseUrl: string) {
    this.hasura = new Hasura(hasuraBaseUrl);
  }

  private static randomInt(max: number): number {
    return Math.floor(Math.random() * (max - 1) + 1);
  }

  /**
   * Uploads 4 week period randomized sample data to populate the DORA
   * dashboard for 2 apps (App1 and App2). Each deployment corresponds
   * to a single PR and commit.
   *
   * App 1 has twice as many Prod deployments as App 1 and shorter lead times.
   * It not deployed to `QA` environments, spending less time in each
   * environment before reaching Prod compared to App 2. App 1 has more
   * incidents than the App 2.
   */
  async uploadData(): Promise<void> {
    // First delete all existing mock data
    await this.deleteData();

    const numWeeks = 4;
    const apps = [
      {id: 'App 1', name: 'App 1'},
      {id: 'App 2', name: 'App 2'},
    ];

    apps.forEach(
      async (x) =>
        await this.hasura.postApplication(x.id, x.name, 'faros', ORIGIN)
    );

    let num = 0;
    for (let week = 1; week <= numWeeks; week++) {
      // Create 4 complete weeks that start on Sunday to match Metabase weeks
      const weekStart = DateTime.now()
        .minus({weeks: week})
        .startOf('week')
        .minus({days: 1});

      const weeklyDeploys = 13;
      for (let i = 0; i < weeklyDeploys; i++) {
        const commitSha = `commit-${num}`;

        const prCreateTime = weekStart.plus({hours: MockData.randomInt(56)});
        const mergedAt = prCreateTime.plus({hours: MockData.randomInt(24)});
        await this.writePRAndReview(num, commitSha, prCreateTime, mergedAt);

        // 2 in 3 deployment are to App 1
        const app = i % 3 !== 0 ? apps[0] : apps[1];
        const artifactId = `artifact-${num}`;
        await this.hasura.postArtifactCommitAssociation(
          artifactId,
          commitSha,
          REPO,
          ORG,
          SOURCE,
          ORIGIN
        );
        await this.writeDeployments(app.id, num, artifactId, mergedAt);
        num++;
      }
    }
  }

  /**
   * Deletes mock data, i.e. data uploaded by the upload script of
   * this module. Data is deleted in the order of table foreign key
   * constraints.
   */
  async deleteData(): Promise<void> {
    await Promise.all([
      this.hasura.deleteArtifactCommitAssociation(ORIGIN),
      this.hasura.deleteArtifactDeployment(ORIGIN),
      this.hasura.deleteIncidentApplicationImpact(ORIGIN),
      this.hasura.deletePullRequestReview(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteArtifact(ORIGIN),
      this.hasura.deleteDeployment(ORIGIN),
      this.hasura.deleteIncident(ORIGIN),
      this.hasura.deletePullRequest(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteComputeApplication(ORIGIN),
      this.hasura.deleteCommit(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteCICDRepository(ORIGIN),
      this.hasura.deleteVCSRepository(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteCICDOrganization(ORIGIN),
      this.hasura.deleteVCSUser(ORIGIN),
      this.hasura.deleteVCSOrganization(ORIGIN),
    ]);
  }

  private async writePRAndReview(
    num: number,
    commitSha: string,
    prCreateTime: DateTime,
    mergedAt: DateTime
  ): Promise<void> {
    const prId = `pr-${num}`;
    await this.hasura.postPullRequest(
      prId,
      `author-${MockData.randomInt(3)}`,
      {category: 'Merged', detail: 'Merged'},
      commitSha,
      prCreateTime,
      mergedAt,
      REPO,
      ORG,
      SOURCE,
      ORIGIN
    );

    // post PR Review
    await this.hasura.postPullRequestReview(
      `review-${num}`,
      {category: 'Approved', detail: 'Approved'},
      prId,
      mergedAt.minus({minutes: MockData.randomInt(60)}),
      REPO,
      ORG,
      SOURCE,
      ORIGIN
    );
  }

  private async writeDeployments(
    appId: string,
    deployNum: number,
    artifactId: string,
    prMergedAt: DateTime
  ): Promise<void> {
    const envs = ['Dev', 'QA', 'Staging', 'Prod'];
    let deploymentTime = prMergedAt;
    for (const env of envs) {
      const deployId = `deployment-${deployNum}-${env}`;
      if (env === 'QA' && appId === 'App 1') {
        continue;
      }

      await this.hasura.postDeployment(
        deployId,
        appId,
        'Success',
        env,
        deploymentTime,
        deploymentTime.plus({minutes: 30}),
        SOURCE,
        ORIGIN
      );
      await this.hasura.postArtifactDeployment(
        artifactId,
        deployId,
        REPO,
        ORG,
        SOURCE,
        ORIGIN
      );

      let timeInEnv = 0;
      switch (env) {
        case 'Dev':
          timeInEnv = appId === 'App 1' ? 12 : 24;
          break;
        case 'QA':
          timeInEnv = 24;
          break;
        case 'Staging':
          timeInEnv =
            appId === 'App 1' ? MockData.randomInt(24) : MockData.randomInt(72);
          break;
        default:
          timeInEnv = 0;
      }
      deploymentTime = deploymentTime.plus({hours: timeInEnv});

      if (env === 'Prod') {
        this.writeIncidents(deployNum, appId, deploymentTime);
      }
    }
  }

  /**
   * 2 in 3 deploymens for App 1 results in an incident whilst
   * 1 in 2 deployments for App 2 results in an incident
   */
  private async writeIncidents(
    num: number,
    appId: string,
    deploymentTime: DateTime
  ): Promise<void> {
    const severity = `Sev${MockData.randomInt(6)}`;
    const incidentTime = deploymentTime.plus({hours: MockData.randomInt(3)});
    if (appId === 'App 1' && MockData.randomInt(4) % 3 !== 0) {
      await this.hasura.postIncidentApplicationImpact(
        `incident-${num}`,
        {category: 'Resolved'},
        {category: severity},
        incidentTime,
        incidentTime.plus({minutes: MockData.randomInt(24 * 60)}),
        appId,
        ORIGIN
      );
    } else if (appId === 'App 2' && MockData.randomInt(3) % 2 === 0) {
      await this.hasura.postIncidentApplicationImpact(
        `incident-${num}`,
        {category: 'Resolved'},
        {category: severity},
        incidentTime,
        incidentTime.plus({minutes: MockData.randomInt(12 * 60)}),
        appId,
        ORIGIN
      );
    }
  }
}
