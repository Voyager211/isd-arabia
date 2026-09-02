import type { CategoryNode } from '@isd/shared-types';

/**
 * Flattens a category tree depth-first, parents before children.
 *
 * The API returns the tree nested because that is what the menu and the
 * sidebar render; the sitemap needs every node as a flat list.
 */
export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];

  const walk = (list: CategoryNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };

  walk(nodes);
  return out;
}
