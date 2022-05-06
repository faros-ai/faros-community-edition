import fs from 'fs-extra';
import path from 'path';

import {BASE_RESOURCES_DIR} from '../config';

export interface Dashboard {
  readonly name: string;
  readonly template: string;
}

export async function loadDashboards(): Promise<ReadonlyArray<Dashboard>> {
  const dir = path.join(BASE_RESOURCES_DIR, 'metabase', 'dashboards');
  const dirents = await fs.readdir(dir, {withFileTypes: true});
  const promises = dirents
    .filter((dirent) => dirent.isFile() && !dirent.name.startsWith('.'))
    .map(async (dirent) => {
      const dashboardPath = path.join(dir, dirent.name);
      return {
        name: path.parse(dashboardPath).name,
        template: await fs.readFile(dashboardPath, 'utf-8'),
      };
    });
  return await Promise.all(promises);
}

export async function loadDashboard(name: string): Promise<Dashboard> {
  const dashboardPath = path.join(
    BASE_RESOURCES_DIR,
    'metabase',
    'dashboards',
    name
  );

  const template = await fs.readFile(dashboardPath, 'utf-8');

  return {name, template};
}
