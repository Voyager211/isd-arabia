import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CartItem, CartState } from '@isd/shared-types';
import { CART_MAX_AGE_MS, CART_STORAGE_KEY } from '@isd/shared-types';

import { cartReducer, readPersistedCart } from './cart-context';

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    name: 'TIG Torch WP-26 Flexible',
    slug: 'tig-torch-wp-26-flexible',
    sku: 'WP-26-FLEX',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/torch.jpg',
    unit: 'piece',
    quantity: 1,
    ...overrides,
  };
}

const empty: CartState = { items: [], updatedAt: 0 };

describe('cartReducer', () => {
  it('adds a new line', () => {
    const next = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    expect(next.items).toHaveLength(1);
    expect(next.items[0].quantity).toBe(1);
  });

  it('increments an existing line rather than duplicating it', () => {
    // Clicking "Add to quote" twice means two of the item, not two lines.
    const once = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    const twice = cartReducer(once, { type: 'ADD_ITEM', item: item({ quantity: 3 }) });

    expect(twice.items).toHaveLength(1);
    expect(twice.items[0].quantity).toBe(4);
  });

  it('removes a line', () => {
    const withItem = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    const next = cartReducer(withItem, { type: 'REMOVE_ITEM', productId: 'p1' });
    expect(next.items).toHaveLength(0);
  });

  it('sets an explicit quantity', () => {
    const withItem = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    const next = cartReducer(withItem, { type: 'SET_QUANTITY', productId: 'p1', quantity: 12 });
    expect(next.items[0].quantity).toBe(12);
  });

  it('removes the line when the quantity drops below one', () => {
    const withItem = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    const next = cartReducer(withItem, { type: 'SET_QUANTITY', productId: 'p1', quantity: 0 });
    expect(next.items).toHaveLength(0);
  });

  it('stores a trimmed note and drops an empty one', () => {
    const withItem = cartReducer(empty, { type: 'ADD_ITEM', item: item() });

    const noted = cartReducer(withItem, {
      type: 'SET_NOTE',
      productId: 'p1',
      note: '  2.4mm collet  ',
    });
    expect(noted.items[0].note).toBe('2.4mm collet');

    const cleared = cartReducer(noted, { type: 'SET_NOTE', productId: 'p1', note: '   ' });
    expect(cleared.items[0].note).toBeUndefined();
  });

  it('clears every line', () => {
    const withItems = cartReducer(cartReducer(empty, { type: 'ADD_ITEM', item: item() }), {
      type: 'ADD_ITEM',
      item: item({ productId: 'p2' }),
    });
    expect(cartReducer(withItems, { type: 'CLEAR_CART' }).items).toHaveLength(0);
  });

  it('stamps updatedAt on every mutation', () => {
    const next = cartReducer(empty, { type: 'ADD_ITEM', item: item() });
    expect(next.updatedAt).toBeGreaterThan(0);
  });
});

describe('readPersistedCart', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
  });

  it('returns an empty cart when nothing is stored', () => {
    expect(readPersistedCart().items).toHaveLength(0);
  });

  it('restores a stored cart', () => {
    store.set(
      CART_STORAGE_KEY,
      JSON.stringify({ items: [item()], updatedAt: Date.now() } satisfies CartState),
    );
    expect(readPersistedCart().items).toHaveLength(1);
  });

  it('discards a cart older than the expiry window', () => {
    const stale = Date.now() - CART_MAX_AGE_MS - 1;
    store.set(CART_STORAGE_KEY, JSON.stringify({ items: [item()], updatedAt: stale }));
    expect(readPersistedCart().items).toHaveLength(0);
  });

  it('discards malformed JSON instead of throwing', () => {
    // An uncaught throw here white-screens the whole site.
    store.set(CART_STORAGE_KEY, '{ not json');
    expect(readPersistedCart().items).toHaveLength(0);
  });

  it('discards a payload with the wrong shape', () => {
    store.set(CART_STORAGE_KEY, JSON.stringify({ items: 'nope', updatedAt: Date.now() }));
    expect(readPersistedCart().items).toHaveLength(0);
  });

  it('survives localStorage throwing, as it does in private browsing', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new DOMException('SecurityError');
        },
      },
    });
    expect(readPersistedCart().items).toHaveLength(0);
  });
});
