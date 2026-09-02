import type { CategoryNode } from '@isd/shared-types';

/**
 * Flat category row as it comes back from Mongo, with ids already stringified.
 */
export type FlatCategory = Omit<CategoryNode, 'children'> & {
  parent: string | null;
};

/**
 * Assembles a flat list into a tree in one pass.
 *
 * Kept pure and separate from the service so the ordering and orphan rules can
 * be tested without a database.
 *
 * Orphan handling is the part worth stating: a node whose parent is missing
 * from the input — because the parent is inactive, soft-deleted, or filtered
 * out by `showInMenu` — is promoted to a root rather than dropped. Silently
 * discarding it would make a whole branch of the catalogue unreachable from
 * the menu with no error anywhere, which is far harder to notice than a
 * category appearing one level too high.
 */
export function buildTree(categories: FlatCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();

  for (const category of categories) {
    nodes.set(category._id, { ...category, children: [] });
  }

  const roots: CategoryNode[] = [];

  for (const category of categories) {
    const node = nodes.get(category._id)!;
    const parent = category.parent ? nodes.get(category.parent) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortRecursive(roots);
  return roots;
}

/**
 * `displayOrder` first, then name. The database sort already does this, but
 * the tree is also built from data that arrived in other orders (tests, the
 * menu projection), so the invariant is re-established here rather than
 * assumed.
 */
function sortRecursive(nodes: CategoryNode[]): void {
  nodes.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  for (const node of nodes) sortRecursive(node.children);
}

/** Flattens a tree back to a list, depth-first, parents before children. */
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
