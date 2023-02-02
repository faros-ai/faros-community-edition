import axios, {AxiosInstance} from 'axios';
import {VError} from 'verror';

export function wrapApiError(cause: unknown, msg: string): Error {
  // Omit verbose axios error
  const truncated = new VError((cause as Error).message);
  return new VError(truncated, msg);
}

// 12 hours
const SYNC_POLL_MILLIS = 2_000;

export interface AttributeMappings {
  readonly id: number;
  readonly group_id: number;
  readonly table_id: number;
  readonly card_id?: number;
  readonly attribute_mappings: Map<string, string | number>;
}

export interface MetabaseConfig {
  readonly url: string;
  readonly username: string;
  readonly password: string;
}

interface FieldParams {
  [param: string]: any;
}

export class Metabase {
  constructor(private readonly api: AxiosInstance) {}

  static async fromConfig(cfg: MetabaseConfig): Promise<Metabase> {
    const token = await Metabase.sessionToken(cfg);
    const api = axios.create({
      baseURL: `${cfg.url}/api`,
      headers: {
        'X-Metabase-Session': token,
      },
    });
    return new Metabase(api);
  }

  private static async sessionToken(cfg: MetabaseConfig): Promise<string> {
    const {url, username, password} = cfg;
    try {
      const {data} = await axios.post(`${url}/api/session`, {
        username,
        password,
      });
      return data.id;
    } catch (err) {
      throw wrapApiError(err, 'failed to get session token');
    }
  }

  async getDatabases(): Promise<any[]> {
    try {
      const {data} = await this.api.get('database');
      return Array.isArray(data) ? data : data?.data || [];
    } catch (err) {
      throw wrapApiError(err, 'unable to get databases');
    }
  }

  async getDatabase(name: string): Promise<any | undefined> {
    try {
      const dbs = await this.getDatabases();
      return dbs.find((d: any) => d?.details?.dbname === name);
    } catch (err) {
      throw wrapApiError(err, 'unable to find database: ' + name);
    }
  }

  async syncSchema(databaseName: string): Promise<void> {
    const db = await this.getDatabase(databaseName);

    if (!db) {
      throw new VError('unable to find database: ' + databaseName);
    }

    await this.api.post(`database/${db.id}/sync_schema`);
  }

  async syncTables(
    schema: string,
    fieldsByTable: Map<string, Set<string>>,
    timeout: number
  ): Promise<void> {
    const dbs = await this.getDatabases();
    for (const db of dbs) {
      try {
        await this.api.post(`database/${db.id}/sync_schema`);
      } catch (err) {
        throw wrapApiError(err, `failed to sync database ${db.id}`);
      }
    }

    const checkSync = async (allTables: any[]): Promise<boolean> => {
      const tables = allTables.filter((t: any) => {
        return t.schema === schema && fieldsByTable.has(t.name);
      });
      // First check all tables are synced
      if (tables.length < fieldsByTable.size) {
        return false;
      }
      // Next check all fields of each table are synced
      for (const table of tables) {
        const metadata = await this.getQueryMetadata(table.id);
        const actualFields = new Set<string>(
          metadata?.fields?.map((f: any) => f.name)
        );
        for (const field of fieldsByTable.get(table.name) || []) {
          if (!actualFields.has(field)) {
            return false;
          }
        }
      }
      return true;
    };

    let isSynced = await checkSync(await this.getTables());
    const deadline = Date.now() + timeout;
    while (!isSynced && Date.now() < deadline) {
      await new Promise((resolve) => {
        setTimeout(resolve, SYNC_POLL_MILLIS);
        return;
      });
      try {
        isSynced = await checkSync(await this.getTables());
      } catch (err) {
        throw wrapApiError(err, 'failed to get tables');
      }
    }
    if (!isSynced) {
      throw new VError(
        'failed to sync tables %s within timeout: %s ms',
        Array.from(fieldsByTable.keys()),
        timeout
      );
    }
  }

  async getTables(): Promise<any[]> {
    try {
      const {data} = await this.api.get('table');
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get tables');
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async putTables(ids: ReadonlyArray<number>, params: any): Promise<void> {
    try {
      if (ids.length) {
        await this.api.put('table', {ids, ...params});
      }
    } catch (err) {
      throw wrapApiError(err, `unable to put tables: ${ids}`);
    }
  }

  async getQueryMetadata(tableId: number): Promise<any> {
    try {
      const {data} = await this.api.get(`table/${tableId}/query_metadata`, {
        params: {include_sensitive_fields: true},
      });
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get metadata for table: ' + tableId);
    }
  }

  async putFieldParams(id: number, params: FieldParams): Promise<void> {
    try {
      await this.api.put(`field/${id}`, params);
    } catch (err) {
      throw wrapApiError(
        err,
        `unable to set field params of ${id} to ${params}`
      );
    }
  }

  async getCard(cardId: number): Promise<any> {
    try {
      const {data} = await this.api.get(`card/${cardId}`);
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get card: ' + cardId);
    }
  }

  async getCards(collectionId?: number): Promise<any[]> {
    try {
      const {data} = await this.api.get('card');
      return data.filter(
        (c: any) => !collectionId || c.collection_id === collectionId
      );
    } catch (err) {
      throw wrapApiError(err, 'unable to get cards');
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async postCard(card: any): Promise<any> {
    try {
      const {data} = await this.api.post('card', card);
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to post card');
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async putCard(id: number, card: any): Promise<any> {
    try {
      card.description = card.description ?? null;
      const {data} = await this.api.put(`card/${id}`, card);
      return data;
    } catch (err) {
      throw wrapApiError(err, `unable to put card: ${id}`);
    }
  }

  /** Removes leading, trailing and repeated slashes */
  private static normalizePath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/\/+/, '/');
  }

  async getCollection(id: number): Promise<any | undefined> {
    try {
      const {data} = await this.api.get(`collection/${id}`);
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get collection with id: ' + id);
    }
  }

  /**
   * Lists collections under a given collection.
   * Returns a map from name to ID
   */
  async getCollections(parentId?: number): Promise<Map<string, number>> {
    const id = parentId ?? 'root';
    try {
      const {data} = await this.api.get(`collection/${id}/items`, {
        params: {models: 'collection'},
      });
      const collections = new Map<string, number>();
      for (const collection of data.data || []) {
        collections.set(collection.name, collection.id);
      }
      return collections;
    } catch (err) {
      throw wrapApiError(err, `unable to list collections under ${id}`);
    }
  }

  /** Gets the named path of a collection */
  async getCollectionPath(collectionId: number): Promise<string> {
    const collection = await this.getCollection(collectionId);
    const ancestorById = new Map<number, string>();
    for (const ancestor of collection.effective_ancestors || []) {
      ancestorById.set(ancestor.id, ancestor.name);
    }

    const ancestors: string[] = [];
    for (const dir of collection.effective_location?.split('/') || []) {
      // Skip empty directories caused by extra slashes
      if (!dir) {
        continue;
      }

      const id = parseInt(dir, 10);
      if (isNaN(id)) {
        throw new VError(
          'collection %d has invalid dir %s in location: %s',
          collectionId,
          dir,
          collection.effective_location
        );
      }
      const ancestor = ancestorById.get(id);
      if (!ancestor) {
        throw new VError(
          'collection %d has unknown ancestor: %d',
          collectionId,
          id
        );
      }
      ancestors.push(ancestor);
    }
    ancestors.push(collection.name);
    return '/' + ancestors.join('/');
  }

  /**
   * Gets a collection by its path. Each level of the collection tree should
   * contain collections with unique names, otherwise the return value is
   * not deterministic.
   */
  async getCollectionByPath(path: string): Promise<any | undefined> {
    let parentId: number | undefined;
    for (const dir of Metabase.normalizePath(path).split('/')) {
      const collections: Map<string, number> = await this.getCollections(
        parentId
      );
      const collectionId = collections.get(dir);
      if (!collectionId) {
        return undefined;
      }
      parentId = collectionId;
    }
    return parentId ? await this.getCollection(parentId) : undefined;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async putCollection(id: number, collection: any): Promise<void> {
    try {
      await this.api.put(`collection/${id}`, collection);
    } catch (err) {
      throw wrapApiError(err, 'unable to put collection: ' + id);
    }
  }

  async postCollection(name: string, parentId?: number): Promise<number> {
    try {
      const body = {name, parent_id: parentId, color: '#9370DB'};
      const {data} = await this.api.post('collection', body);
      return data.id;
    } catch (err) {
      throw wrapApiError(err, 'unable to post collection: ' + name);
    }
  }

  async postCollectionPath(path: string): Promise<number> {
    let parentId: number | undefined;
    for (const dir of Metabase.normalizePath(path).split('/') || []) {
      const collections: Map<string, number> = await this.getCollections(
        parentId
      );
      let collectionId = collections.get(dir);
      if (!collectionId) {
        collectionId = await this.postCollection(dir, parentId);
      }
      parentId = collectionId;
    }
    if (!parentId) {
      throw new Error('path must contain at least one collection');
    }
    return parentId;
  }

  async getDashboards(): Promise<any[]> {
    try {
      const {data} = await this.api.get('dashboard');
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get dashboards');
    }
  }

  async getDashboard(id: number): Promise<any> {
    try {
      const {data} = await this.api.get(`dashboard/${id}`);
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to get dashboard: ' + id);
    }
  }

  async postDashboard(
    name: string,
    description: string,
    parameters: any[],
    collectionId: number
  ): Promise<any> {
    try {
      const {data} = await this.api.post('dashboard', {
        name,
        description: description ?? null,
        parameters,
        collection_id: collectionId,
      });
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to post dashboard: ' + name);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async postCardToDashboard(id: number, card: any): Promise<any> {
    try {
      const {data} = await this.api.post(`dashboard/${id}/cards`, {
        ...card,
        // Accept cardId or card_id
        cardId: card.cardId ?? card.card_id,
        // v45+ size options. For v44 and below Metabase ignores them
        size_x: card.sizeX,
        size_y: card.sizeY,
      });
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to add card to dashboard: ' + id);
    }
  }

  async dashboardBookmark(id: number): Promise<any> {
    try {
      const {data} = await this.api.post(`bookmark/dashboard/${id}`);
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to bookmark dashboard: ' + id);
    }
  }
}
