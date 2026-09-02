import { buildTree, flattenTree, type FlatCategory } from './category-tree.util';

function category(overrides: Partial<FlatCategory> & { _id: string }): FlatCategory {
  return {
    name: overrides._id,
    slug: overrides._id,
    parent: null,
    ancestors: [],
    level: 0,
    displayOrder: 0,
    showInMenu: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildTree', () => {
  it('nests children under their parent', () => {
    const tree = buildTree([
      category({ _id: 'welding' }),
      category({ _id: 'tig', parent: 'welding', level: 1 }),
      category({ _id: 'torches', parent: 'tig', level: 2 }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]._id).toBe('welding');
    expect(tree[0].children[0]._id).toBe('tig');
    expect(tree[0].children[0].children[0]._id).toBe('torches');
  });

  it('does not depend on the input being parent-first', () => {
    const tree = buildTree([
      category({ _id: 'torches', parent: 'tig', level: 2 }),
      category({ _id: 'tig', parent: 'welding', level: 1 }),
      category({ _id: 'welding' }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0]._id).toBe('torches');
  });

  it('sorts by displayOrder then name at every level', () => {
    const tree = buildTree([
      category({ _id: 'b', name: 'Bravo', displayOrder: 1 }),
      category({ _id: 'a', name: 'Alpha', displayOrder: 1 }),
      category({ _id: 'z', name: 'Zulu', displayOrder: 0 }),
      category({ _id: 'z2', name: 'Second', parent: 'z', displayOrder: 1, level: 1 }),
      category({ _id: 'z1', name: 'First', parent: 'z', displayOrder: 0, level: 1 }),
    ]);

    expect(tree.map((node) => node._id)).toEqual(['z', 'a', 'b']);
    expect(tree[0].children.map((node) => node._id)).toEqual(['z1', 'z2']);
  });

  it('promotes an orphan to a root instead of dropping it', () => {
    // The parent is missing because it is inactive or filtered out of the menu
    // projection. Dropping the child would make a whole branch silently
    // unreachable — far harder to spot than it appearing a level too high.
    const tree = buildTree([category({ _id: 'orphan', parent: 'missing-parent', level: 1 })]);

    expect(tree).toHaveLength(1);
    expect(tree[0]._id).toBe('orphan');
  });

  it('returns an empty array for no input', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('keeps siblings under the same parent together', () => {
    const tree = buildTree([
      category({ _id: 'welding' }),
      category({ _id: 'tig', parent: 'welding', level: 1, displayOrder: 0 }),
      category({ _id: 'mig', parent: 'welding', level: 1, displayOrder: 1 }),
      category({ _id: 'arc', parent: 'welding', level: 1, displayOrder: 2 }),
    ]);

    expect(tree[0].children.map((node) => node._id)).toEqual(['tig', 'mig', 'arc']);
  });
});

describe('flattenTree', () => {
  it('returns nodes depth-first with parents before children', () => {
    const tree = buildTree([
      category({ _id: 'welding' }),
      category({ _id: 'tig', parent: 'welding', level: 1 }),
      category({ _id: 'torches', parent: 'tig', level: 2 }),
      category({ _id: 'tools', displayOrder: 1 }),
    ]);

    expect(flattenTree(tree).map((node) => node._id)).toEqual([
      'welding',
      'tig',
      'torches',
      'tools',
    ]);
  });
});
