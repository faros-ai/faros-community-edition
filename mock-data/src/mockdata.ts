import {DateTime} from 'luxon';

import {Hasura} from './hasura';
import { randomBytes, randomInt } from 'crypto';

const ORIGIN = 'faros-ce-mock-data';
const SOURCE = 'FarosCE-MockData';
const REPO = 'Example Repo';
const ORG = 'Example Org';

const TASK_PRIORITIES = ['High', 'Low', 'Medium'];
const TASK_TYPES = ['Bug', 'Story', 'Task'];
const TASK_STATUSES = ['Todo', 'InProgress', 'Done'];
const TASK_CHANGE_CATEGORIES = [
  {category: 'InProgress', detail: 'Coding', minBeforeStage: 72},
  {category: 'InProgress', detail: 'Review', minBeforeStage: 48},
  {category: 'InProgress', detail: 'QA', minBeforeStage: 24},
  {category: 'Done', detail: 'Done', minBeforeStage: 12},
];

export class MockData {
  private hasura: Hasura;
  constructor(hasuraBaseUrl: string, adminSecret?: string) {
    this.hasura = new Hasura(hasuraBaseUrl, adminSecret);
  }

  private static randomInt(max: number, min?: number): number {
    const minimum = min ?? 1;
    return Math.floor(Math.random() * (max - minimum) + minimum);
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

      // At least 5 Prs per week up to max of 14
      const weeklyPRs = 5 + MockData.randomInt(9);
      for (let i = 0; i < weeklyPRs; i++) {
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
      await this.writeTasks(week, weekStart);
      await this.writeCopilot(week, weekStart);
      await this.writeSurveys(numWeeks);
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
      this.hasura.deleteTask(ORIGIN),
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
      this.hasura.deleteMetricValueTag(ORIGIN),
      this.hasura.deleteUserToolUsage(ORIGIN),
      this.hasura.deleteSurveyQuestionResponse(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteCICDRepository(ORIGIN),
      this.hasura.deleteVCSRepository(ORIGIN),
      this.hasura.deleteMetricValue(ORIGIN),
      this.hasura.deleteTag(ORIGIN),
      this.hasura.deleteUserTool(ORIGIN),
      this.hasura.deleteSurveyQuestionAssociation(ORIGIN),
    ]);

    await Promise.all([
      this.hasura.deleteCICDOrganization(ORIGIN),
      this.hasura.deleteVCSUser(ORIGIN),
      this.hasura.deleteVCSOrganization(ORIGIN),
      this.hasura.deleteMetricDefinition(ORIGIN),
      this.hasura.deleteSurveySurvey(ORIGIN),
      this.hasura.deleteSurveyQuestion(ORIGIN)
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
      `author-${MockData.randomInt(4, 1)}`,
      {category: 'Merged', detail: 'Merged'},
      commitSha,
      prCreateTime,
      mergedAt,
      MockData.randomInt(200, 2000),
      MockData.randomInt(0, 1000),
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

  /**
   * Creates a random number of tasks for each week, with a minimum of 6
   * and a max of 11. Task status, priority and points are all random.
   *
   * Each task will have at least one status changelog entry for `Todo` status.
   * In-progress tasks get a random number of status changelog entries minus
   * the `Done` state.
   * Done tasks have all status change log entries
   */
  private async writeTasks(weekNum: number, week: DateTime): Promise<void> {
    const numTasks = 6 + MockData.randomInt(6);
    for (let i = 1; i <= numTasks; i++) {
      const taskId = `task-${weekNum}-${i}`;
      const createdAt = week.plus({
        minutes: MockData.randomInt(60 * 24 * 3),
      });
      const type = TASK_TYPES[MockData.randomInt(3, 0)];
      const priority = TASK_PRIORITIES[MockData.randomInt(3, 0)];
      const status = {category: TASK_STATUSES[MockData.randomInt(3, 0)]};
      const points = MockData.randomInt(10);
      const statusChangelog = [
        {
          status: {category: 'Todo', detail: 'Todo'},
          changedAt: createdAt.toMillis(),
        },
      ];
      let updatedAt = createdAt;

      // Pick number status changes based on status. In progress has random
      let statusChanges = 0;
      if (status.category === 'Done') {
        statusChanges = 4;
      } else if (status.category === 'InProgress') {
        statusChanges = MockData.randomInt(4, 0);
      }

      let changedAt = createdAt;
      TASK_CHANGE_CATEGORIES.slice(0, statusChanges).forEach((t) => {
        changedAt = changedAt.plus({
          hours: MockData.randomInt(t.minBeforeStage, 0),
        });
        statusChangelog.push({
          status: {category: t.category, detail: t.detail},
          changedAt: changedAt.toMillis(),
        });
        updatedAt = changedAt;
      });

      await this.hasura.postTask(
        taskId,
        createdAt,
        updatedAt,
        type,
        priority,
        points,
        status,
        statusChangelog,
        SOURCE,
        ORIGIN
      );
    }
  }

  private async writeCopilot(weekNum: number, week: DateTime): Promise<void> {
    const languageTags = [
      'go',
      'python',
      'typescript',
    ].map((lang) => {
      return {
        faros_Tag: {
          uid: 'copilotLanguage__' + lang,
          key: 'copilotLanguage',
          value: lang,
        },
      };
    });

    const ideTags = ['jetbrains', 'vscode'].map((i) => {
      return {
        faros_Tag: {
          uid: 'copilotEditor__' + i,
          key: 'copilotEditor',
          value: i,
        },
      };
    });

    for (const tag of [...languageTags, ...ideTags]) {
      await this.hasura.postTag(
        tag.faros_Tag.uid,
        tag.faros_Tag.key,
        tag.faros_Tag.value,
        ORIGIN
      );
    }

    const metricDefs = [
      'DailyActiveUserTrend',
      'DailyGeneratedLineCount_Accept',
      'DailyGeneratedLineCount_Discard',
      'DailySuggestionReferenceCount_Accept',
      'DailySuggestionReferenceCount_Discard',
      'DailyActiveChatUserTrend',
      'DailyChatAcceptanceCount',
      'DailyChatTurnCount',
    ].map((d) => {
      return {
        faros_MetricDefinition: {
          uid: d,
          name: d,
          valueType: {category: 'Numeric'},
        },
      };
    });

    for (const def of metricDefs) {
      await this.hasura.postMetricDefinition(
        def.faros_MetricDefinition.uid,
        def.faros_MetricDefinition.name,
        def.faros_MetricDefinition.valueType,
        ORIGIN
      );
    }

    const metricDefToFun: Record<string, () => number> = {
      DailyActiveUserTrend: (): number => MockData.randomInt(3, 1),
      DailyGeneratedLineCount_Accept: (): number => MockData.randomInt(10, 2),
      DailyGeneratedLineCount_Discard: (): number => MockData.randomInt(100, 10),
      DailySuggestionReferenceCount_Accept: (): number => MockData.randomInt(10, 2),
      DailySuggestionReferenceCount_Discard: (): number => MockData.randomInt(100, 10),
      DailyActiveChatUserTrend: (): number => MockData.randomInt(3, 1),
      DailyChatAcceptanceCount: (): number => MockData.randomInt(10, 1),
      DailyChatTurnCount: (): number => MockData.randomInt(20, 3),
    };

    const tools = [1, 2, 3].map((u) => {
      return {
        user: {uid: `author-${u}`, source: SOURCE},
        organization: {uid: ORG, source: SOURCE},
        tool: {category: 'GitHubCopilot'},
        inactive: false,
        startedAt: DateTime.now().minus({weeks: MockData.randomInt(4, 2)}),
        endedAt: DateTime.now(),
        origin: ORIGIN,
      };
    });

    for (const t of tools) {
      await this.hasura.postUserTool(
        t.user,
        t.organization,
        t.tool,
        t.inactive,
        t.startedAt,
        t.endedAt,
        t.origin
      );
    }


    for (let i = 1; i <= 10; i++) {
      const computedAt = week.plus({days: MockData.randomInt(6)});

      const usedAt = computedAt;
      await this.hasura.postUserToolUsage(
        tools[MockData.randomInt(tools.length, 1)],
        usedAt,
        usedAt.plus({hours: 2}),
        ORIGIN
      );
      for (const def of metricDefs) {

        const metricValue = {
          uid: `mv-week${weekNum}-${i}`,
          computedAt,
          value: metricDefToFun[def.faros_MetricDefinition.name]().toString(),
          definition: def.faros_MetricDefinition.uid,
          origin: ORIGIN
        };

        await this.hasura.postMetricValue(
          metricValue.uid,
          metricValue.computedAt,
          metricValue.value,
          metricValue.definition,
          metricValue.origin,
        );

        await this.hasura.postMetricValueTag(
          metricValue,
          languageTags[MockData.randomInt(languageTags.length)].faros_Tag.uid,
          ORIGIN
        );

        await this.hasura.postMetricValueTag(
          metricValue,
          ideTags[MockData.randomInt(ideTags.length)].faros_Tag.uid,
          ORIGIN
        );
      }
    }
  }



  private async writeSurveys(numWeeks: number): Promise<void> {
    const nResponses = 10;
    const likerts = [
      'Strongly Disagree',
      'Disagree',
      'Neutral',
      'Agree',
      'Strongly Agree',
    ];
    function randArr(arr: any[]): any {return arr[randomInt(0, arr.length)]};


    // Cadence Surveys
    const cSurvey = {
      uid: 'survey-1',
      name: 'Copilot Weekly Survey',
      type: {category: 'Custom', detail: 'AI Transformation'},
      source: SOURCE,
      origin: ORIGIN
    };

    await this.hasura.postSurveySurvey(
      cSurvey.uid,
      cSurvey.name,
      cSurvey.type,
      cSurvey.source,
      cSurvey.origin
    );

    interface questionInfo {
      question: string;
      responseType?: {category: string; detail: string};
      generateResponse: () => string;
    }

    async function writeQuestions(
      questions: questionInfo[],
      survey: any,
      hasura: Hasura
    ): Promise<void> {
      let qid = 0;
      for (const qi of questions) {
        const q = {
          uid: `question-${qid}`,
          source: SOURCE
        };
        await hasura.postSurveyQuestion(
          q.uid,
          qi.question,
          {category: 'CodingAssistants', detail: 'CodingAssistants'},
          qi.responseType,
          SOURCE,
          ORIGIN
        );
        qid++;
        await hasura.postSurveyQuestionAssociation(cSurvey, q, ORIGIN);
        for (let i = 0; i <= nResponses; i++) {
          await hasura.postSurveyQuestionResponse(
            `response-${i}`,
            ORIGIN,
            DateTime.now().minus({days: randomInt(0, numWeeks * 7)}),
            qi.generateResponse(),
            survey,
            q
          );
        }
      }
    }

    const cQuestions: questionInfo[] = [
      {
        question: 'How often are you using your coding assistant?',
        responseType: {category: 'MultipleChoice', detail: 'MultipleChoice'},
        generateResponse: (): string => randArr([
          'I have not started to use it yet',
          'I used it for some time, but not anymore',
          'Rarely',
          'Frequently',
          'Very Frequently',
        ])
      },
      {
        question: 'On average how many hours per day did you save ' +
                  'in the past week?',
        responseType: {category: 'NumericEntry', detail: 'NumericEntry'},
        generateResponse: () => randomInt(0, 10).toString()
      }, ...[
        'Understanding code',
        'Preparing to code',
        'Writing new code',
        'Debugging code',
        'Refactoring code',
        'Reviewing code',
        'Documenting code',
        'Writing tests',
      ].map((task) => {
        return {
          question: 'In the past week, Copilot helped me with the following ' +
                    `tasks: [${task}]`,
          responseType: {category: 'LikertScale', detail: 'LikertScale'},
          generateResponse: () => randArr(likerts),
        };
      })
    ];
    await writeQuestions(cQuestions, cSurvey, this.hasura);



    // PR Surveys
    const prSurvey = {
      uid: 'survey-2',
      name: 'GitHub Copilot Survey',
      type: {category: 'Custom', detail: 'AI Transformation'},
      source: SOURCE,
      origin: ORIGIN
    };
    await this.hasura.postSurveySurvey(
      prSurvey.uid,
      prSurvey.name,
      prSurvey.type,
      prSurvey.source,
      prSurvey.origin
    );

    const prQuestions: questionInfo[] = [
      {
        question:
          'Based on your experience, estimate how much total coding time' +
          'you saved using copilot for this PR? (in minutes)',
        responseType: {category: 'NumericEntry', detail: 'NumericEntry'},
        generateResponse: () => randomInt(5, 60).toString(),
      }, ...[
        'Be happier in my job',
        'Be more productive',
        'Deal with repetitive tasks',
        'Improve Productivity',
        'Learn new skills',
        'Refactor or debug code',
        'Stay in flow',
        'Write better code',
      ].map((task) => {
        return {
          question: `(optional) Copilot helps me to: [${task}]`,
          responseType: {category: 'LikertScale', detail: 'LikertScale'},
          generateResponse: () => randArr(likerts),
        };
      })
    ];
    await writeQuestions(prQuestions, prSurvey, this.hasura);

  }
}
