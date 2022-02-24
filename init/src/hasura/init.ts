import axios, {AxiosInstance} from 'axios';
import fs from 'fs-extra';
import {
  compact,
  difference,
  find,
  flatten,
  groupBy,
  pickBy,
  union,
  upperFirst,
  values,
} from 'lodash';
import path from 'path';
import pino from 'pino';
import pluralize from 'pluralize';
import {VError} from 'verror';

import {BASE_RESOURCES_DIR} from '../config';
import {
  ArrayRelationship,
  ForeignKey,
  ObjectRelationship,
  Source,
  TableRelationships,
} from './types';

const RESOURCES_DIR = path.join(BASE_RESOURCES_DIR, 'hasura');

class HasuraInit {
  constructor(
    private readonly api: AxiosInstance,
    private readonly logger: pino.Logger
  ) {}

  private async listAllTables(): Promise<ReadonlyArray<string>> {
    const response = await this.api.post('/v2/query', {
      type: 'run_sql',
      args: {
        source: 'default',
        sql: await fs.readFile(
          path.join(RESOURCES_DIR, 'list-all-tables.sql'),
          'utf8'
        ),
        cascade: false,
        read_only: true,
      },
    });
    const result: string[] = flatten(response.data.result);
    return result.filter(
      (table) => table !== 'tablename' && !table.startsWith('flyway_')
    );
  }

  private async listAllForeignKeys(): Promise<ReadonlyArray<ForeignKey>> {
    const response = await this.api.post('/v2/query', {
      type: 'run_sql',
      args: {
        source: 'default',
        sql: await fs.readFile(
          path.join(RESOURCES_DIR, 'list-all-foreign-keys.sql'),
          'utf8'
        ),
        cascade: false,
        read_only: true,
      },
    });
    const result: string[][] = response.data.result;
    const foreignKeys: ForeignKey[] = result
      .filter(
        (row) =>
          row.length === 3 && row[0] !== 'child_table' && !row[2].includes(',')
      )
      .map((row) => {
        return {
          childTable: row[0],
          parentTable: row[1],
          column: row[2],
          relationshipNames: {object: row[1], array: pluralize(row[0])},
        };
      });
    const conflictingKeys = flatten(
      values(
        pickBy(
          groupBy(foreignKeys, (fk) => [fk.childTable, fk.parentTable]),
          (k) => k.length > 1
        )
      )
    );
    const fixedKeys: ForeignKey[] = compact(
      conflictingKeys.map((key) => {
        const modelParts = compact(key.parentTable.split('_'));
        if (!modelParts.length) {
          return undefined;
        }
        return {
          childTable: key.childTable,
          parentTable: key.parentTable,
          column: key.column,
          relationshipNames: {
            object: `${key.parentTable}__${key.column}`,
            array: `${pluralize(key.childTable)}By${upperFirst(key.column)}`,
          },
        };
      })
    );
    return union(difference(foreignKeys, conflictingKeys), fixedKeys);
  }

  private async getDbSource(): Promise<Source> {
    const response = await this.api.post('/v1/metadata', {
      type: 'export_metadata',
      version: 2,
      args: {},
    });
    const sources: Source[] = response.data.metadata.sources;
    const defaultSource = find(sources, (source) => source.name === 'default');
    if (!defaultSource) {
      throw new VError('Faros database not connected to Hasura');
    }
    return defaultSource;
  }

  private async trackTable(table: string): Promise<void> {
    this.logger.debug('Adding %s table to Hasura schema', table);
    await this.api.post('/v1/metadata', {
      type: 'pg_track_table',
      args: {
        source: 'default',
        table,
        configuration: {},
      },
    });
  }

  private async createObjectRelationship(fk: ForeignKey): Promise<void> {
    this.logger.debug('Creating object relationship for %o', fk);
    await this.api.post('/v1/metadata', {
      type: 'pg_create_object_relationship',
      args: {
        table: fk.childTable,
        name: fk.relationshipNames.object,
        source: 'default',
        using: {
          foreign_key_constraint_on: [fk.column],
        },
      },
    });
  }

  private async createArrayRelationship(fk: ForeignKey): Promise<void> {
    this.logger.debug('Creating array relationship for %o', fk);
    await this.api.post('/v1/metadata', {
      type: 'pg_create_array_relationship',
      args: {
        table: fk.parentTable,
        name: fk.relationshipNames.array,
        source: 'default',
        using: {
          foreign_key_constraint_on: {
            table: fk.childTable,
            columns: [fk.column],
          },
        },
      },
    });
  }

  private async loadMetadata(metadata: any): Promise<void> {
    await this.api.post('/v1/metadata', {
      type: 'replace_metadata',
      version: 2,
      args: {
        allow_inconsistent_metadata: false,
        metadata,
      },
    });
  }

  static createSourceMetadata(
    tableNames: ReadonlyArray<string>,
    foreignKeys: ReadonlyArray<ForeignKey>
  ): Source {
    const rels: {
      [table: string]: {
        objectRels: ObjectRelationship[];
        arrayRels: ArrayRelationship[];
      };
    } = {};
    for (const table of tableNames) {
      rels[table] = {objectRels: [], arrayRels: []};
    }
    for (const fk of foreignKeys) {
      rels[fk.childTable].objectRels.push({
        name: fk.relationshipNames.object,
        using: {foreign_key_constraint_on: fk.column},
      });
      rels[fk.parentTable].arrayRels.push({
        name: fk.relationshipNames.array,
        using: {
          foreign_key_constraint_on: {
            column: fk.column,
            table: {name: fk.childTable, schema: 'public'},
          },
        },
      });
    }

    const tables = tableNames.map((name) => {
      return {
        table: {name, schema: 'public'},
        object_relationships: rels[name].objectRels,
        array_relationships: rels[name].arrayRels,
      };
    });
    const source = {
      name: 'default',
      kind: 'postgres',
      tables,
      configuration: {
        connection_info: {
          use_prepared_statements: true,
          database_url: {
            from_env: 'HASURA_GRAPHQL_DATABASE_URL',
          },
          isolation_level: 'read-committed',
          pool_settings: {
            connection_lifetime: 600,
            retries: 1,
            idle_timeout: 180,
            max_connections: 50,
          },
        },
      },
    };
    return source;
  }

  async trackAllTablesAndRelationships(): Promise<void> {
    const allTableNames = await this.listAllTables();
    const source = await this.getDbSource();
    const foreignKeys = await this.listAllForeignKeys();

    const trackedTables = source.tables.filter(
      (table) => table.table.schema === 'public'
    );

    if (trackedTables.length === 0) {
      await this.loadMetadata({
        version: 3,
        sources: [HasuraInit.createSourceMetadata(allTableNames, foreignKeys)],
      });
      this.logger.info('Loaded source metadata into Hasura');
      return;
    }

    const untrackedTableNames = difference(
      allTableNames,
      trackedTables.map((table) => table.table.name)
    );
    for (const table of untrackedTableNames) {
      await this.trackTable(table);
    }

    const relMap: Record<string, TableRelationships> = {};
    let newObjectRels = 0;
    let newArrayRels = 0;
    for (const table of trackedTables) {
      relMap[table.table.name] = {
        objectRels: table.object_relationships,
        arrayRels: table.array_relationships,
      };
    }
    for (const fk of foreignKeys) {
      if (
        !find(
          relMap[fk.childTable]?.objectRels ?? [],
          (rel) =>
            rel.name === fk.relationshipNames.object &&
            rel.using.foreign_key_constraint_on === fk.column
        )
      ) {
        await this.createObjectRelationship(fk);
        newObjectRels++;
      }
      if (
        !find(
          relMap[fk.parentTable]?.arrayRels ?? [],
          (rel) =>
            rel.name === fk.relationshipNames.array &&
            rel.using.foreign_key_constraint_on.column === fk.column
        )
      ) {
        await this.createArrayRelationship(fk);
        newArrayRels++;
      }
    }

    this.logger.info(
      'Added %d tables to Hasura schema',
      untrackedTableNames.length
    );
    this.logger.info(
      'Added %d object relationships to Hasura schema',
      newObjectRels
    );
    this.logger.info(
      'Added %d array relationships to Hasura schema',
      newArrayRels
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    throw new VError('Usage: node init.js <hasura url>');
  }

  const logger = pino({
    name: 'hasura-init',
    level: process.env.LOG_LEVEL || 'info',
  });

  const hasura = new HasuraInit(
    axios.create({
      baseURL: args[0],
      headers: {'X-Hasura-Role': 'admin'},
    }),
    logger
  );

  await hasura.trackAllTablesAndRelationships();

  logger.info('Hasura setup is complete');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
