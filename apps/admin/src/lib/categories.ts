import type { CategoryNode } from '@isd/shared-types';

export interface LeafCategoryOption {
  _id: string;
  slug: string;
  name: string;
  /** Full trail, e.g. "Welding › TIG Welding › TIG Torches". */
  path: string;
}

/**
 * Flattens the tree to the LEAF categories only, each labelled with its full
 * path.
 *
 * Products can only be filed against a leaf (the API rejects anything else),
 * so offering the parents in a product form would just produce a 400 the admin
 * has to decode. The path label is what makes the choice unambiguous when
 * several branches contain a "Nozzles".
 */
export function flattenCategories(nodes: CategoryNode[]): LeafCategoryOption[] {
  const out: LeafCategoryOption[] = [];

  const walk = (list: CategoryNode[], trail: string[]) => {
    for (const node of list) {
      const path = [...trail, node.name];

      if (node.children.length === 0) {
        out.push({ _id: node._id, slug: node.slug, name: node.name, path: path.join(' › ') });
      } else {
        walk(node.children, path);
      }
    }
  };

  walk(nodes, []);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
