import { Types } from 'mongoose';

import { PRODUCT_LIST_DEFAULT_LIMIT, PRODUCT_LIST_MAX_LIMIT } from '@isd/shared-types';

import {
  buildProductFilter,
  buildProductSort,
  normalisePaging,
  toSlugArray,
} from './product-filter.util';

const id = () => new Types.ObjectId();

describe('buildProductFilter', () => {
  it('always excludes soft-deleted records', () => {
    expect(buildProductFilter({})).toMatchObject({ isDeleted: false });
  });

  it('restricts to active products for public listings', () => {
    expect(buildProductFilter({})).toMatchObject({ isActive: true });
  });

  it('includes inactive products for admin listings', () => {
    const filter = buildProductFilter({ includeInactive: true });
    expect(filter.isActive).toBeUndefined();
    // Soft-deleted records stay excluded even for admins — the admin list is
    // not a recycle bin.
    expect(filter.isDeleted).toBe(false);
  });

  it('filters categories through categoryPath, not category', () => {
    // categoryPath carries the ancestors, so a parent id matches everything
    // beneath it in one indexed query.
    const categoryId = id();
    const filter = buildProductFilter({ categoryIds: [categoryId] });

    expect(filter.categoryPath).toEqual({ $in: [categoryId] });
    expect(filter.category).toBeUndefined();
  });

  it('combines category, brand and industry filters', () => {
    const filter = buildProductFilter({
      categoryIds: [id()],
      brandIds: [id()],
      industryIds: [id()],
    });

    expect(filter).toHaveProperty('categoryPath');
    expect(filter).toHaveProperty('brand');
    expect(filter).toHaveProperty('industries');
  });

  it('omits empty id arrays rather than emitting an impossible $in', () => {
    // `{ $in: [] }` matches nothing, which would turn "no brand selected" into
    // "no results".
    const filter = buildProductFilter({ brandIds: [], categoryIds: [], industryIds: [] });

    expect(filter.brand).toBeUndefined();
    expect(filter.categoryPath).toBeUndefined();
    expect(filter.industries).toBeUndefined();
  });

  it('adds a $text stage for a search term', () => {
    expect(buildProductFilter({ search: 'WP-26' }).$text).toEqual({ $search: 'WP-26' });
  });

  it('ignores a blank or whitespace-only search term', () => {
    expect(buildProductFilter({ search: '   ' }).$text).toBeUndefined();
    expect(buildProductFilter({ search: '' }).$text).toBeUndefined();
  });

  it('applies the featured and new-arrival flags only when given', () => {
    expect(buildProductFilter({ featured: true }).isFeatured).toBe(true);
    expect(buildProductFilter({ featured: false }).isFeatured).toBe(false);
    expect(buildProductFilter({}).isFeatured).toBeUndefined();
    expect(buildProductFilter({ newArrival: true }).isNewArrival).toBe(true);
  });
});

describe('buildProductSort', () => {
  it('sorts by displayOrder then recency by default', () => {
    expect(buildProductSort(undefined, false)).toEqual({ displayOrder: 1, createdAt: -1 });
  });

  it('defaults to relevance when a text search is present', () => {
    // A plain field, not { $meta: 'textScore' } — the service materialises the
    // score before the $facet, because $text metadata is unreachable inside one.
    expect(buildProductSort(undefined, true)).toEqual({ score: -1, createdAt: -1 });
  });

  it('falls back to newest when relevance is asked for without a text search', () => {
    // Mongo has no textScore to sort by outside a $text query, and asking for
    // one is an error rather than an empty result.
    expect(buildProductSort('relevance', false)).toEqual({ createdAt: -1 });
  });

  it.each([
    ['oldest', { createdAt: 1 }],
    ['name_asc', { name: 1 }],
    ['name_desc', { name: -1 }],
  ] as const)('maps %s', (sort, expected) => {
    expect(buildProductSort(sort, false)).toEqual(expected);
  });
});

describe('normalisePaging', () => {
  it('defaults to page 1 at the standard page size', () => {
    expect(normalisePaging()).toEqual({
      page: 1,
      limit: PRODUCT_LIST_DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('computes skip from page and limit', () => {
    expect(normalisePaging(3, 24)).toEqual({ page: 3, limit: 24, skip: 48 });
  });

  it('caps the page size', () => {
    // Without the cap a caller can ask for 100,000 products and exhaust the
    // free-tier instance's memory.
    expect(normalisePaging(1, 100_000).limit).toBe(PRODUCT_LIST_MAX_LIMIT);
  });

  it('clamps nonsense input instead of rejecting it', () => {
    // A malformed ?page= in a shared link should still render page 1.
    expect(normalisePaging(0, 24).page).toBe(1);
    expect(normalisePaging(-5, 24).page).toBe(1);
    expect(normalisePaging(Number.NaN, Number.NaN)).toEqual({
      page: 1,
      limit: PRODUCT_LIST_DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('floors fractional input', () => {
    expect(normalisePaging(2.9, 24.7)).toEqual({ page: 2, limit: 24, skip: 24 });
  });
});

describe('toSlugArray', () => {
  it('accepts a single value', () => {
    expect(toSlugArray('kaspro')).toEqual(['kaspro']);
  });

  it('accepts repeated query parameters', () => {
    expect(toSlugArray(['kaspro', 'esab'])).toEqual(['kaspro', 'esab']);
  });

  it('accepts a comma-separated list', () => {
    expect(toSlugArray('kaspro,esab')).toEqual(['kaspro', 'esab']);
  });

  it('lowercases, trims and de-duplicates', () => {
    expect(toSlugArray([' KASPRO ', 'kaspro', 'Esab'])).toEqual(['kaspro', 'esab']);
  });

  it('returns an empty array for nothing', () => {
    expect(toSlugArray(undefined)).toEqual([]);
    expect(toSlugArray('')).toEqual([]);
    expect(toSlugArray(',, ,')).toEqual([]);
  });
});
