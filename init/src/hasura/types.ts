interface Table {
  schema: string;
  name: string;
}

export interface ObjectRelationship {
  name: string;
  using: {
    foreign_key_constraint_on: string;
  };
}

export interface ArrayRelationship {
  name: string;
  using: {
    foreign_key_constraint_on: {
      column: string;
      table: Table;
    };
  };
}

interface TableWithRelationships {
  table: Table;
  object_relationships: ReadonlyArray<ObjectRelationship>;
  array_relationships: ReadonlyArray<ArrayRelationship>;
}

export interface Source {
  name: string;
  kind: string;
  tables: ReadonlyArray<TableWithRelationships>;
  configuration: any;
}

export interface ForeignKey {
  childTable: string;
  parentTable: string;
  column: string;
  relationshipNames: {
    object: string;
    array: string;
  };
}

export interface TableRelationships {
  objectRels: ReadonlyArray<ObjectRelationship>;
  arrayRels: ReadonlyArray<ArrayRelationship>;
}

export interface Query {
  name: string;
  query: string;
}

export interface QueryCollection {
  name: string;
  definition: {
    queries: ReadonlyArray<Query>;
  };
}

export interface Endpoint {
  name: string;
  url: string;
  comment: string | null;
  methods: ReadonlyArray<string>;
  definition: {
    query: {
      query_name: string;
      collection_name: string;
    };
  };
}
