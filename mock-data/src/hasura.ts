import axios, {AxiosInstance} from 'axios';
import {DateTime} from 'luxon';

export class Hasura {
  private readonly api: AxiosInstance;
  constructor(private readonly baseURL: string, adminSecret?: string) {
    this.api = axios.create(
      {
        baseURL: `${baseURL}/api/rest/`,
        headers: {
          'Content-Type': 'application/json',
          ...(adminSecret && {'X-Hasura-Admin-Secret': adminSecret}),
        }
      }
    );
  }

  async postApplication(
    uid: string,
    name: string,
    platform: string,
    origin: string
  ): Promise<void> {
    await this.api.post('compute_application', {
      uid,
      name,
      platform,
      data_origin: origin,
    });
  }

  async postArtifactCommitAssociation(
    artifactId: string,
    commitSha: string,
    repository: string,
    organization: string,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('cicd_artifact_commit_association', {
      data_artifact_id: artifactId,
      data_artifact_repository: repository,
      data_artifact_organization: organization,
      data_commit_organization: organization,
      data_commit_repository: repository,
      data_commit_sha: commitSha,
      data_commit_source: source,
      data_artifact_source: source,
      data_origin: origin,
    });
  }

  async postArtifactDeployment(
    artifactId: string,
    deployId: string,
    repository: string,
    organization: string,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('cicd_artifact_deployment', {
      data_artifact_id: artifactId,
      data_artifact_repository: repository,
      data_artifact_organization: organization,
      data_artifact_source: source,
      data_deploy_id: deployId,
      data_deploy_source: source,
      data_origin: origin,
    });
  }

  async postDeployment(
    deployId: string,
    appId: string,
    status: string,
    env: string,
    startTime: DateTime,
    endTime: DateTime,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('cicd_deployment', {
      data_deploy_id: deployId,
      data_deploy_source: source,
      compute_Application: appId,
      status: {category: status, detail: status},
      env: {category: env, detail: env},
      deploy_start_time: startTime,
      deploy_end_time: endTime,
      data_origin: origin,
    });
  }

  async postIncidentApplicationImpact(
    incidentId: string,
    status: any,
    severity: any,
    createdAt: DateTime,
    resolvedAt: DateTime,
    appId: string,
    origin: string
  ): Promise<void> {
    await this.api.post('ims_incident_application_impact', {
      data_incident_id: incidentId,
      data_incident_status: status,
      data_incident_severity: severity,
      data_created_at: createdAt,
      data_resolved_at: resolvedAt,
      compute_Application: appId,
      data_origin: origin,
    });
  }

  async postMetricDefinition(
    uid: string,
    name: string,
    valueType: any,
    origin: string
  ): Promise<void> {
    await this.api.post('faros_metric_definition', {
      data_uid: uid,
      data_name: name,
      data_value_type: valueType,
      data_origin: origin,
    });
  }

  async postMetricValue(
    uid: string,
    computedAt: DateTime,
    value: string,
    definition: string,
    origin: string
  ): Promise<void> {
    await this.api.post('faros_metric_value', {
      data_uid: uid,
      data_computedAt: computedAt,
      data_value: value,
      data_definition: definition,
      data_origin: origin,
    });
  }

  async postMetricValueTag(
    value: any,
    tag: string,
    origin: string
  ): Promise<void> {
    await this.api.post('faros_metric_value_tag', {
      data_value_uid: value.uid,
      data_value_definition_uid: value.definition,
      data_tag_id: tag,
      data_origin: origin,
    });
  }

  async postPullRequest(
    id: string,
    author: string,
    state: any,
    commitSha: string,
    createTime: DateTime,
    mergeTime: DateTime,
    linesAdded: number,
    linesDeleted: number,
    repository: string,
    organization: string,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('vcs_pull_request', {
      data_pull_request_id: id,
      data_pull_request_author: author,
      data_pull_request_state: state,
      data_merge_commit_sha: commitSha,
      data_pull_request_create_time: createTime,
      data_pull_request_merge_time: mergeTime,
      data_pull_request_lines_added: linesAdded,
      data_pull_request_lines_deleted: linesDeleted,
      data_pull_request_repository: repository,
      data_pull_request_organization: organization,
      data_pull_request_source: source,
      data_origin: origin,
    });
  }

  async postPullRequestReview(
    id: string,
    state: any,
    pullRequestId: string,
    submittedAt: DateTime,
    repository: string,
    organization: string,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('vcs_pull_request_review', {
      data_review_id: id,
      data_pull_request_id: pullRequestId,
      data_review_state: state,
      data_review_submitted_at: submittedAt,
      data_review_repository: repository,
      data_review_organization: organization,
      data_review_source: source,
      data_origin: origin,
    });
  }

  async postSurveyQuestion(
    uid: string,
    question: string,
    responseType: any,
    questionType: any,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('survey_question', {
      data_uid: uid,
      data_question: question,
      data_response_category: responseType.category,
      data_response_detail: responseType.detail,
      data_question_category: questionType.category,
      data_question_detail: questionType.detail,
      data_source: source,
      data_origin: origin,
    });
  }

  async postSurveyQuestionResponse(
    uid: string,
    origin: string,
    submittedAt: DateTime,
    response: string,
    survey: any,
    question: any
  ): Promise<void> {
    await this.api.post('survey_question_response', {
      data_uid: uid,
      data_origin: origin,
      data_submitted_at: submittedAt,
      data_response: response,
      data_survey_uid: survey.uid,
      data_survey_source: survey.source,
      data_question_uid: question.uid,
      data_question_source: question.source,
    });
  }

  async postSurveySurvey(
    uid: string,
    name: string,
    type: any,
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('survey_survey', {
      data_uid: uid,
      data_name: name,
      data_type_category: type.category,
      data_type_detail: type.detail,
      data_source: source,
      data_origin: origin,
    });
  }

  async postSurveyQuestionAssociation(
    survey: any,
    question: any,
    origin: string
  ): Promise<void> {
    await this.api.post('survey_survey_question_association', {
      data_survey_uid: survey.uid,
      data_survey_source: survey.source,
      data_question_uid: question.uid,
      data_question_source: question.source,
      data_origin: origin
    });
  }

  async postTag(
    uid: string,
    key: string,
    value: string,
    origin: string
  ): Promise<void> {
    await this.api.post('faros_tag', {
      data_uid: uid,
      data_key: key,
      data_value: value,
      data_origin: origin,
    });
  }

  async postTask(
    taskId: string,
    createdAt: DateTime,
    updatedAt: DateTime,
    type: string,
    priority: string,
    points: number,
    status: {category: string},
    statusChangelog: {
      status: {category: string; detail: string};
      changedAt: number;
    }[],
    source: string,
    origin: string
  ): Promise<void> {
    await this.api.post('tms_task', {
      data_task_id: taskId,
      data_task_created_at: createdAt,
      data_task_updated_at: updatedAt,
      data_task_type: type,
      data_task_status: status,
      data_task_points: points,
      data_task_priority: priority,
      data_task_status_changelog: statusChangelog,
      data_task_source: source,
      data_origin: origin,
    });
  }

  async postUserTool(
    user: any,
    organization: any,
    tool: any,
    inactive: boolean,
    startedAt: DateTime,
    endedAt: DateTime | null | undefined,
    origin: string,
  ): Promise<void> {
    await this.api.post('vcs_user_tool', {
      data_user_uid: user.uid,
      data_user_source: user.source,
      data_org_uid: organization.uid,
      data_org_source: organization.source,
      data_tool: tool,
      data_inactive: inactive,
      data_started_at: startedAt,
      data_ended_at: endedAt,
      data_origin: origin
    });
  }

  // currently excludes branch, repo, file, and charactersAdded
  async postUserToolUsage(
    tool: any,
    usedAt: DateTime,
    recordedAt: DateTime,
    origin: string,
  ): Promise<void> {
    await this.api.post('vcs_user_tool_usage', {
      data_user_uid: tool.user.uid,
      data_user_source: tool.user.source,
      data_org_uid: tool.organization.uid,
      data_org_source: tool.organization.source,
      data_tool: tool.tool,
      data_used_at: usedAt,
      data_recorded_at: recordedAt,
      data_origin: origin,
    });
  }

  async deleteArtifactCommitAssociation(origin: string): Promise<void> {
    await this.api.post('delete_cicd_artifact_commit_association', {
      data_origin: origin,
    });
  }

  async deleteArtifactDeployment(origin: string): Promise<void> {
    await this.api.post('delete_cicd_artifact_deployment', {
      data_origin: origin,
    });
  }

  async deleteCICDOrganization(origin: string): Promise<void> {
    await this.api.post('delete_cicd_organization', {
      data_origin: origin,
    });
  }

  async deleteCICDRepository(origin: string): Promise<void> {
    await this.api.post('delete_cicd_repository', {
      data_origin: origin,
    });
  }

  async deleteVCSUser(origin: string): Promise<void> {
    await this.api.post('delete_vcs_user', {
      data_origin: origin,
    });
  }

  async deleteVCSOrganization(origin: string): Promise<void> {
    await this.api.post('delete_vcs_organization', {
      data_origin: origin,
    });
  }
  async deleteVCSRepository(origin: string): Promise<void> {
    await this.api.post('delete_vcs_repository', {
      data_origin: origin,
    });
  }
  async deleteCommit(origin: string): Promise<void> {
    await this.api.post('delete_vcs_commit', {
      data_origin: origin,
    });
  }

  async deletePullRequest(origin: string): Promise<void> {
    await this.api.post('delete_vcs_pull_request', {
      data_origin: origin,
    });
  }

  async deletePullRequestReview(origin: string): Promise<void> {
    await this.api.post('delete_vcs_pull_request_review', {
      data_origin: origin,
    });
  }

  async deleteComputeApplication(origin: string): Promise<void> {
    await this.api.post('delete_compute_application', {
      data_origin: origin,
    });
  }
  async deleteIncident(origin: string): Promise<void> {
    await this.api.post('delete_ims_incident', {
      data_origin: origin,
    });
  }

  async deleteDeployment(origin: string): Promise<void> {
    await this.api.post('delete_cicd_deployment', {
      data_origin: origin,
    });
  }

  async deleteArtifact(origin: string): Promise<void> {
    await this.api.post('delete_cicd_artifact', {
      data_origin: origin,
    });
  }

  async deleteTask(origin: string): Promise<void> {
    await this.api.post('delete_tms_task', {
      data_origin: origin,
    });
  }

  async deleteIncidentApplicationImpact(origin: string): Promise<void> {
    await this.api.post('delete_ims_incident_application_impact', {
      data_origin: origin,
    });
  }

  async deleteMetricDefinition(origin: string): Promise<void> {
    await this.api.post('delete_faros_metric_definition', {
      data_origin: origin,
    });
  }

  async deleteMetricValue(origin: string): Promise<void> {
    await this.api.post('delete_faros_metric_value', {
      data_origin: origin,
    });
  }

  async deleteMetricValueTag(origin: string): Promise<void> {
    await this.api.post('delete_faros_metric_value_tag', {
      data_origin: origin,
    });
  }

  async deleteTag(origin: string): Promise<void> {
    await this.api.post('delete_faros_tag', {
      data_origin: origin,
    });
  }

  async deleteUserTool(origin: string): Promise<void> {
    await this.api.post('delete_vcs_user_tool', {
      data_origin: origin,
    });
  }

  async deleteUserToolUsage(origin: string): Promise<void> {
    await this.api.post('delete_vcs_user_tool_usage', {
      data_origin: origin,
    });
  }

  async deleteSurveyQuestion(origin: string): Promise<void> {
    await this.api.post('delete_survey_question', {
      data_origin: origin,
    });
  }

  async deleteSurveyQuestionResponse(origin: string): Promise<void> {
    await this.api.post('delete_survey_question_response', {
      data_origin: origin,
    });
  }

  async deleteSurveySurvey(origin: string): Promise<void> {
    await this.api.post('delete_survey_survey', {
      data_origin: origin,
    });
  }

  async deleteSurveyQuestionAssociation(origin: string): Promise<void> {
    await this.api.post('delete_survey_survey_question_association', {
      data_origin: origin,
    });
  }
}
