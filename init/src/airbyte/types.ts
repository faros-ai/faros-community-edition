interface ConnectorDefinition {
  dockerImageTag: string;
  dockerRepository: string;
  name: string;
}

export interface DestinationDefinition extends ConnectorDefinition {
  destinationDefinitionId: string;
}

export interface SourceDefinition extends ConnectorDefinition {
  sourceDefinitionId: string;
}
