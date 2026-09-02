import type { PaginationMeta } from '@isd/shared-types';

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export function skipFor(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}
