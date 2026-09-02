import type { CataloguePublic, Industry, MenuCategory } from '@isd/shared-types';

import { getActiveCatalogue, getIndustries, getMenu } from './catalogue';

/**
 * Data the global shell needs on every page.
 *
 * The API is on a free tier that sleeps after 15 minutes of inactivity
 * (PROJECT_PLAN.md §14.2). If a cold start or a restart makes these calls fail,
 * the header and footer must still render — a chrome fetch failing should
 * degrade the navigation, not blank the page the visitor came for.
 */
export interface ShellData {
  menu: MenuCategory[];
  industries: Pick<Industry, '_id' | 'name' | 'slug'>[];
  /** Null when nothing is published; the download buttons then render nothing. */
  catalogue: CataloguePublic | null;
}

export async function getShellData(): Promise<ShellData> {
  const [menu, industries, catalogue] = await Promise.all([
    getMenu().catch(() => [] as MenuCategory[]),
    getIndustries().catch(() => [] as Industry[]),
    getActiveCatalogue().catch(() => null),
  ]);

  return {
    menu,
    industries: industries.slice(0, 9).map(({ _id, name, slug }) => ({ _id, name, slug })),
    catalogue,
  };
}
