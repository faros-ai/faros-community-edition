import Handlebars, {SafeString} from 'handlebars';
import {
  isEqual,
  isNumber,
  isPlainObject,
  isString,
  omit,
  omitBy,
  sortBy,
} from 'lodash';
import pino from 'pino';
import {VError} from 'verror';

import {Dashboard, loadDashboard, loadDashboards} from './config';
import {Metabase} from './metabase';

const DASHBOARD_REGEX = /\(\/dashboard\/(\d+)\)/g;
const REF_REGEX =
  /\\?"{{ (table|field|card|dashboard) \\{1,3}"([^\\"]+)\\{1,3}" }}\\?"/g;
const SYNC_TIMEOUT_MS = 100_000;

interface DatabaseMetadata {
  readonly tableIds: Record<string, number>;
  readonly fieldIds: Record<string, Record<string, number>>;
  readonly tableNames: Record<number, string>;
  readonly fieldNames: Record<number, string>;
}

interface MetabaseConfig {
  readonly url: string;
  readonly username: string;
  readonly password: string;
}

interface DashboardsConfig {
  readonly metabase: MetabaseConfig;
  readonly databaseName: string;
  readonly logger: pino.Logger;
}

export class Dashboards {
  private constructor(
    private readonly metabase: Metabase,
    private readonly databaseId: number,
    private readonly logger: pino.Logger
  ) {}

  static async fromConfig(cfg: DashboardsConfig): Promise<Dashboards> {
    if (!cfg.databaseName) {
      throw new VError('no database name given');
    }

    const metabase = await Metabase.fromConfig(cfg.metabase);
    const database = await metabase.getDatabase(cfg.databaseName);
    const databaseId = database?.id;
    if (!databaseId) {
      throw new VError('unable to find database: ' + cfg.databaseName);
    }

    return new Dashboards(metabase, databaseId, cfg.logger);
  }

  async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    const tables = await this.metabase.getTables();
    const metadata = await Promise.all(
      tables.map(async (table) => [
        table,
        await this.metabase.getQueryMetadata(table.id),
      ])
    );

    const tableIds: Record<string, number> = {};
    const fieldIds: Record<string, Record<string, number>> = {};
    const tableNames: Record<number, string> = {};
    const fieldNames: Record<number, string> = {};
    for (const [table, {fields}] of metadata) {
      if (table.db_id !== this.databaseId) {
        continue;
      }

      const tableName = Dashboards.tableName(table);
      tableIds[tableName] = table.id;
      tableNames[table.id] = tableName;
      for (const field of fields) {
        if (!fieldIds[tableName]) {
          fieldIds[tableName] = {};
        }
        fieldIds[tableName][field.name] = field.id;
        fieldNames[field.id] = `${tableName}.${field.name}`;
      }
    }
    return {tableIds, fieldIds, tableNames, fieldNames};
  }

  /** Exports a dashboard to a template string */
  async export(dashboardOrId: number | any): Promise<string> {
    const dashboard =
      typeof dashboardOrId === 'number'
        ? await this.metabase.getDashboard(dashboardOrId)
        : dashboardOrId;

    const name = dashboard.name;
    const description = dashboard.description ?? undefined;
    const {tableNames, fieldNames} = await this.getDatabaseMetadata();
    const cardNames: Record<number, string> = {};
    const parentCardById = new Map<number, any>();
    for (const cardLayout of dashboard.ordered_cards) {
      const cardId = cardLayout.card_id;
      if (cardId) {
        cardNames[cardId] = cardLayout.card.name;
      }

      // If this card references another card, then add it
      const parentCardId = Dashboards.parentCardId(cardLayout.card);
      if (parentCardId && !parentCardById.has(parentCardId)) {
        const parentCard = await this.metabase.getCard(parentCardId);
        parentCardById.set(parentCardId, parentCard);
        cardNames[parentCardId] = parentCard.name;
      }

      for (const seriesLayout of cardLayout.series) {
        const seriesCardId = seriesLayout.id;
        if (!seriesCardId) {
          throw new VError('Series does not have an id');
        }
        if (seriesCardId) {
          cardNames[seriesCardId] = seriesLayout.name;
        }
      }
    }
    const dashboards = await this.metabase.getDashboards();
    const dashboardNames: Record<number, string> = {};
    for (const item of dashboards) {
      const dashboardId = item.id;
      dashboardNames[dashboardId] = item.name;
    }

    this.templatize(
      dashboard,
      tableNames,
      fieldNames,
      cardNames,
      dashboardNames
    );

    const cards: any[] = [];
    const layout: any[] = [];
    const parameters = dashboard.parameters;
    const toCard = (card: any): any => ({
      name: card.name,
      description: card.description,
      display: card.display,
      table_id: card.table_id,
      dataset_query: card.dataset_query,
      visualization_settings: omit(
        card.visualization_settings,
        'click_behavior'
      ),
    });

    // Add all source cards first...
    for (const parentCard of parentCardById.values()) {
      // Since source cards are not part of the dashboard
      // we need to templatize them separately
      this.templatize(
        parentCard,
        tableNames,
        fieldNames,
        cardNames,
        dashboardNames
      );
      cards.push(toCard(parentCard));
    }
    // ...then add cards in the dashboard
    for (const cardLayout of dashboard.ordered_cards) {
      if (cardLayout.card_id) {
        cards.push(toCard(cardLayout.card));
      }
      const series: any = [];
      for (const seriesLayout of cardLayout.series) {
        if (seriesLayout.id) {
          cards.push(toCard(seriesLayout));
        }
        series.push({id: `{{ card "${seriesLayout.name}" }}`});
      }
      layout.push({
        row: cardLayout.row,
        col: cardLayout.col,
        // Support for v45+
        sizeX: cardLayout.sizeX ?? cardLayout.size_x,
        sizeY: cardLayout.sizeY ?? cardLayout.size_y,
        card_id: cardLayout.card_id,
        series,
        parameter_mappings: cardLayout.parameter_mappings,
        visualization_settings: cardLayout.visualization_settings,
      });
    }

    const collectionId = dashboard.collection_id;
    const path = await this.metabase.getCollectionPath(collectionId);

    // Unstringify references since they'll be populated with numbers
    const json = JSON.stringify(
      {
        name,
        description,
        cards,
        parameters,
        layout,
        path,
      },
      null,
      2
    );
    return json.replace(REF_REGEX, '{{ $1 "$2" }}') + '\n';
  }

  /** Recursive function to replace ids with named references */
  private templatize(
    cfg: any,
    tableNames: Record<number, string>,
    fieldNames: Record<number, string>,
    cardNames: Record<number, string>,
    dashboardNames: Record<number, string>
  ): void {
    if (!cfg) {
      return;
    } else if (isPlainObject(cfg)) {
      // eslint-disable-next-line prefer-const
      for (let [key, val] of Object.entries(cfg)) {
        if (Dashboards.isJSON(key)) {
          const jsonKey = JSON.parse(key);
          this.templatize(
            jsonKey,
            tableNames,
            fieldNames,
            cardNames,
            dashboardNames
          );
          delete cfg[key];
          key = JSON.stringify(jsonKey);
          cfg[key] = val;
        }

        if (isNumber(val)) {
          if (key === 'table_id' || key === 'source-table') {
            cfg[key] = `{{ table "${tableNames[val]}" }}`;
          } else if (key === 'card_id') {
            cfg[key] = `{{ card "${cardNames[val]}" }}`;
          } else if (key === 'database' || key === 'database_id') {
            // Not needed. Database will be populated on import.
            cfg[key] = undefined;
          } else if (key === 'targetId') {
            // Custom logic for click_behavior when key is targetId
            if (cfg.linkType === 'dashboard') {
              cfg[key] = `{{ dashboard "${dashboardNames[val]}" }}`;
            }
          } else if (key === 'id') {
            if (cfg.dataset_query?.query) {
              cfg[key] = `{{ card "${cardNames[val]}" }}`;
            }
          }
        } else if (isString(val)) {
          if (key === 'query') {
            cfg[key] = val.replace(/{{/g, '<<').replace(/}}/g, '>>');
          } else if (key === 'source-table') {
            const cardId = Dashboards.parentCardId(val);
            if (!cardId) {
              throw new VError('unable to extract parent card from: %s', val);
            }
            cfg[key] = `{{ card "${cardNames[cardId]}" }}`;
          } else if (key === 'text') {
            cfg[key] = val.replace(
              DASHBOARD_REGEX,
              (match, p1) =>
                `(/dashboard/{{ dashboard '${dashboardNames[Number(p1)]}' }})`
            );
          }
        } else {
          this.templatize(
            val,
            tableNames,
            fieldNames,
            cardNames,
            dashboardNames
          );
        }
      }
    } else if (Array.isArray(cfg)) {
      if (!cfg?.length) {
        return;
      } else if (cfg[0] === 'field' && isNumber(cfg[1])) {
        const fieldName = fieldNames[cfg[1]];
        if (!fieldName) {
          throw new VError('unknown field id: ' + cfg[1]);
        }
        cfg[1] = `{{ field "${fieldName}" }}`;
        if (cfg[2] && typeof cfg[2] === 'object' && cfg[2]['source-field']) {
          const sourceFieldName = fieldNames[cfg[2]['source-field']];
          if (!sourceFieldName) {
            throw new VError('unknown field id: ' + cfg[2]['source-field']);
          }
          cfg[2]['source-field'] = `{{ field "${sourceFieldName}" }}`;
        }
      }
      for (const entry of cfg) {
        this.templatize(
          entry,
          tableNames,
          fieldNames,
          cardNames,
          dashboardNames
        );
      }
    }
  }

  /**
   * Sync database metadata based on tables and fields referenced
   * in dashboard templates
   */
  private async syncTemplateMetadata(
    templates: Iterable<string>
  ): Promise<DatabaseMetadata> {
    const fieldsByTable = new Map<string, Set<string>>();
    for (const template of templates) {
      for (const [table, fields] of this.getFields(template)) {
        if (!fieldsByTable.has(table)) {
          fieldsByTable.set(table, new Set<string>());
        }
        for (const field of fields) {
          fieldsByTable.get(table)?.add(field);
        }
      }
    }

    this.logger.info(
      'Syncing tables in Metabase: %s',
      [...fieldsByTable.keys()].map((table) => table)
    );
    await this.metabase.syncTables('public', fieldsByTable, SYNC_TIMEOUT_MS);

    this.logger.info('Finished syncing tables in Metabase');
    return await this.getDatabaseMetadata();
  }

  /** Get fields referenced in template by name */
  private getFields(template: string): Map<string, Set<string>> {
    const fieldsByTable = new Map<string, Set<string>>();
    const handlebars = Handlebars.create();
    handlebars.registerHelper('table', (table: string): number => {
      if (!fieldsByTable.has(table)) {
        fieldsByTable.set(table, new Set<string>());
      }
      return 0;
    });
    handlebars.registerHelper('field', (name): number => {
      const split = name.split('.');
      if (split.length !== 2) {
        throw new VError('invalid field: ' + name);
      }
      const table = split[0];
      const field = split[1];
      if (!fieldsByTable.has(table)) {
        fieldsByTable.set(table, new Set<string>());
      }
      fieldsByTable.get(table)?.add(field);
      return 0;
    });
    handlebars.registerHelper('card', (): number => {
      return 0;
    });
    handlebars.registerHelper('dashboard', (): number => {
      return 0;
    });
    handlebars.compile(template)({});
    return fieldsByTable;
  }

  /** Returns a map from card name to its parent card name */
  private getCardDependencies(template: string): Map<string, string> {
    const handlebars = Handlebars.create();
    handlebars.registerHelper('table', (): number => 0);
    handlebars.registerHelper('field', (): number => 0);
    handlebars.registerHelper('dashboard', (): number => 0);
    handlebars.registerHelper(
      'card',
      (name: string): SafeString => new SafeString(`"${name}"`)
    );
    const dashboard = JSON.parse(handlebars.compile(template)({}));
    const cardDependencies = new Map<string, string>();
    for (const card of dashboard.cards) {
      const sourceTable = card.dataset_query?.query?.['source-table'];
      if (isString(sourceTable)) {
        cardDependencies.set(card.name, sourceTable);
        if (cardDependencies.has(sourceTable)) {
          throw new VError(
            'cards referenced by other cards must be based on tables, ' +
              // eslint-disable-next-line @typescript-eslint/quotes
              `but card '%s', which is referenced by card '%s', is not`,
            sourceTable,
            card.name
          );
        }
      }
    }
    return cardDependencies;
  }

  private renderTemplate(
    template: string,
    tableIds: Record<string, number | string>,
    fieldIds: Record<string, Record<string, number>>,
    cardIds?: Record<string, number>,
    dashboardIds?: Record<string, number>
  ): any {
    const handlebars = Handlebars.create();
    handlebars.registerHelper('table', (name: string): SafeString | number => {
      const id = tableIds[name];
      if (id) {
        return typeof id === 'string' ? new SafeString(`"${id}"`) : id;
      }
      throw new VError('unknown table: ' + name);
    });
    handlebars.registerHelper('field', (name: string): number => {
      const split = name.split('.');
      if (split.length !== 2) {
        throw new VError('invalid field: ' + name);
      }
      const table = split[0];
      const field = split[1];
      if (fieldIds[table]?.[field]) {
        return fieldIds[table]?.[field];
      }
      throw new VError('unknown field: ' + name);
    });
    handlebars.registerHelper('card', (name: string): string | number => {
      if (cardIds) {
        if (cardIds[name]) {
          return cardIds[name];
        }
        throw new VError('unknown card: ' + name);
      }
      return 'null';
    });
    handlebars.registerHelper('dashboard', (name: string): string | number => {
      if (dashboardIds) {
        if (dashboardIds[name]) {
          return dashboardIds[name];
        }
        throw new VError('unknown dashboard: ' + name);
      }
      return 'null';
    });
    return JSON.parse(
      JSON.stringify(
        JSON.parse(handlebars.compile(template)({})),
        (key, value) => {
          // ->> and #>> must not be replaced
          // https://www.postgresql.org/docs/9.4/functions-json.html
          return key === 'query' && isString(value)
            ? value.replace(/<</g, '{{').replace(/([^-#])>>/g, '$1}}')
            : value;
        }
      )
    );
  }

  async importNew(): Promise<void> {
    const dashboards = await loadDashboards();
    const existingDashboards = await this.metabase.getDashboards();
    const existingDashboardNames = new Set<string>();

    for (const item of existingDashboards) {
      existingDashboardNames.add(item.name);
      this.logger.debug('existing dashboard: %s', item.name);
    }
    // we need to quickly parse the json to access the dashboard name
    // we simply ignore missing helpers
    const handlebars = Handlebars.create();
    handlebars.registerHelper('helperMissing', function () {
      return new Handlebars.SafeString('null');
    });
    const newDashboards = dashboards.filter(
      (dashboard) =>
        !existingDashboardNames.has(
          JSON.parse(handlebars.compile(dashboard.template)({})).name
        )
    );
    return await this.import(newDashboards);
  }

  async importOne(name: string): Promise<void> {
    const dashboards = new Array(await loadDashboard(name));
    return await this.import(dashboards);
  }

  private async import(dashboards: ReadonlyArray<Dashboard>): Promise<void> {
    this.logger.info(
      'Importing dashboards: %s',
      dashboards.map((d) => d.name)
    );

    const templates = dashboards.map((d) => d.template);
    const {tableIds, fieldIds} = await this.syncTemplateMetadata(templates);

    const cards: Record<string, any[]> = {};
    const dashboardIds: Record<string, number> = {};
    const collectionIds: Record<string, number> = {};
    const updatedFieldIds = new Set<number>();
    const templatesByName: Record<string, string> = {};
    const renderedTemplates: any[] = [];
    for (const template of templates) {
      const cfg = this.renderTemplate(template, tableIds, fieldIds);
      renderedTemplates.push(cfg);
      templatesByName[cfg.name] = template;
    }
    for (const cfg of sortBy(renderedTemplates, (t) => t.priority)) {
      for (const {field, type} of cfg.fields || []) {
        if (!updatedFieldIds.has(field)) {
          const param = {semantic_type: type};
          await this.metabase.putFieldParams(field, param);
          updatedFieldIds.add(field);
        }
      }

      const collectionId = await this.metabase.postCollectionPath(cfg.path);
      const {id} = await this.metabase.postDashboard(
        cfg.name,
        cfg.description,
        cfg.parameters,
        collectionId
      );
      cards[cfg.name] = cfg.cards;
      collectionIds[cfg.name] = collectionId;
      dashboardIds[cfg.name] = id;

      if (cfg.bookmark) {
        await this.metabase.dashboardBookmark(id);
      }
    }
    this.logger.info('Created empty dashboards');

    // Second pass on the templates now that we have card and dashboard ids
    for (const [name, template] of Object.entries(templatesByName)) {
      const cardDependencies = this.getCardDependencies(template);
      const parentCardNames = new Set(cardDependencies.values());
      const parentCards: any[] = [];
      const otherCards: any[] = [];
      for (const card of cards[name]) {
        if (parentCardNames.has(card.name)) {
          parentCards.push(card);
        } else {
          otherCards.push(card);
        }
      }

      const parentCardIds = await this.createCards(
        collectionIds[name],
        parentCards,
        true
      );

      // Replace empty references to parent cards with parent card id
      for (const card of otherCards) {
        const parentCardName = cardDependencies.get(card.name);
        if (parentCardName) {
          const parentCardId = parentCardIds[parentCardName];
          if (!parentCardId) {
            throw new VError(
              // eslint-disable-next-line @typescript-eslint/quotes
              `unable to find parent card '%s' of card '%s'`,
              parentCardName,
              card.name
            );
          }
          const cardRef = `card__${parentCardId}`;
          card.dataset_query.query['source-table'] = cardRef;
        }
      }

      const otherCardIds = await this.createCards(
        collectionIds[name],
        otherCards,
        true
      );
      const cardIds = {...parentCardIds, ...otherCardIds};
      const cfg = this.renderTemplate(
        template,
        tableIds,
        fieldIds,
        cardIds,
        dashboardIds
      );

      const id = dashboardIds[cfg.name];
      for (const card of cfg.layout) {
        await this.metabase.postCardToDashboard(id, card);
      }
    }
  }

  private async createCards(
    collectionId: number,
    cards: ReadonlyArray<any>,
    upsert?: boolean
  ): Promise<Record<string, number>> {
    this.logger.info(
      'Creating %d cards in collection %s',
      cards.length,
      collectionId
    );
    const existingCardsByName: Record<string, any> = {};
    if (upsert) {
      const existingCards = await this.metabase.getCards(collectionId);
      existingCards.sort((c1, c2) => {
        // Sort cards from least to most recent so that the most
        // recent card with a name is chosen in the forEach
        const d1 = new Date(c1.created_at);
        const d2 = new Date(c2.created_at);
        return d1.getTime() - d2.getTime();
      });
      for (const card of existingCards) {
        existingCardsByName[card.name] = {
          id: card.id,
          name: card.name,
          description: card.description,
          display: card.display,
          collection_id: card.collection_id,
          database_id: card.database_id,
          table_id: card.table_id,
          dataset_query: card.dataset_query,
          visualization_settings: card.visualization_settings,
        };
      }
    }

    // Deduplicate cards by name
    const cardsByName: Record<string, any> = {};
    for (const card of cards) {
      cardsByName[card.name] = card;
    }

    const cardIds: Record<string, number> = {};
    let createdOrUpdated = 0;
    for (const card of Object.values(cardsByName)) {
      card.collection_id = collectionId;
      card.database_id = this.databaseId;
      card.dataset_query.database = this.databaseId;
      const existingCard = existingCardsByName[card.name];
      if (existingCard && upsert) {
        if (!Dashboards.equalCards(card, existingCard)) {
          await this.metabase.putCard(existingCard.id, card);
          createdOrUpdated++;
        }
        cardIds[card.name] = existingCard.id;
      } else {
        const {id} = await this.metabase.postCard(card);
        cardIds[card.name] = id;
        createdOrUpdated++;
      }
    }

    this.logger.info(
      'Created or updated %d out of %d cards in collection %s',
      createdOrUpdated,
      cards.length,
      collectionId
    );
    return cardIds;
  }

  async getOrCreateCollection(path: string): Promise<number> {
    const collection = await this.metabase.getCollectionByPath(path);
    if (collection) {
      return collection.id;
    }
    return await this.metabase.postCollectionPath(path);
  }

  private static parentCardId(cardOrRef: any | string): number | undefined {
    const cardRef = !isString(cardOrRef)
      ? cardOrRef.dataset_query?.query?.['source-table']
      : cardOrRef;
    if (!isString(cardRef) || !cardRef.startsWith('card__')) {
      return undefined;
    }
    return parseInt(cardRef.replace(/^card__/, ''), 10);
  }

  private static tableName(table: any): string {
    if (typeof table === 'string') {
      return table;
    }
    return table.name;
  }

  private static isJSON(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  private static equalCards(card1: any, card2: any): boolean {
    // series cards lack a table_id on export
    const predicate = (v: any, k: string): boolean =>
      k === 'id' || k === 'table_id' || !v;
    return isEqual(omitBy(card1, predicate), omitBy(card2, predicate));
  }
}
