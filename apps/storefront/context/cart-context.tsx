'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CartItem, CartState } from '@isd/shared-types';
import { CART_MAX_AGE_MS, CART_STORAGE_KEY } from '@isd/shared-types';

/**
 * Quotation cart (PROJECT_PLAN.md §10).
 *
 * Entirely client-side: no server cart, no session, no cart API. The server
 * only sees the contents once, at submission, and re-reads every product by ID
 * at that point rather than trusting anything stored here.
 */

type CartAction =
  | { type: 'HYDRATE'; state: CartState }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'SET_QUANTITY'; productId: string; quantity: number }
  | { type: 'SET_NOTE'; productId: string; note: string }
  | { type: 'CLEAR_CART' };

const EMPTY_CART: CartState = { items: [], updatedAt: 0 };

/** Exported for unit testing — the reducer is pure and tested in isolation. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  const touched = (items: CartItem[]): CartState => ({ items, updatedAt: Date.now() });

  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'ADD_ITEM': {
      const existing = state.items.find((item) => item.productId === action.item.productId);

      // Adding a product already in the cart increments rather than
      // duplicating the line — a buyer clicking "Add to quote" twice means
      // "two of these", not "show this product twice".
      if (existing) {
        return touched(
          state.items.map((item) =>
            item.productId === action.item.productId
              ? { ...item, quantity: item.quantity + action.item.quantity }
              : item,
          ),
        );
      }

      return touched([...state.items, action.item]);
    }

    case 'REMOVE_ITEM':
      return touched(state.items.filter((item) => item.productId !== action.productId));

    case 'SET_QUANTITY': {
      // A quantity of zero removes the line, which is what the stepper's
      // decrement does at 1.
      if (action.quantity < 1) {
        return touched(state.items.filter((item) => item.productId !== action.productId));
      }

      return touched(
        state.items.map((item) =>
          item.productId === action.productId ? { ...item, quantity: action.quantity } : item,
        ),
      );
    }

    case 'SET_NOTE':
      return touched(
        state.items.map((item) =>
          item.productId === action.productId
            ? { ...item, note: action.note.trim() || undefined }
            : item,
        ),
      );

    case 'CLEAR_CART':
      return touched([]);

    default:
      return state;
  }
}

/**
 * Reads the persisted cart.
 *
 * Every localStorage access is wrapped: private browsing and storage-full
 * conditions throw, and an uncaught throw here white-screens the whole site
 * (§10). A corrupt or expired payload is discarded rather than repaired.
 */
export function readPersistedCart(now = Date.now()): CartState {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return EMPTY_CART;

    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!Array.isArray(parsed.items) || typeof parsed.updatedAt !== 'number') {
      return EMPTY_CART;
    }

    if (now - parsed.updatedAt > CART_MAX_AGE_MS) return EMPTY_CART;

    return { items: parsed.items, updatedAt: parsed.updatedAt };
  } catch {
    return EMPTY_CART;
  }
}

function persistCart(state: CartState): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked. The cart still works for this session; losing
    // persistence is a far better failure than losing the page.
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  lineCount: number;
  /**
   * False until the persisted cart has been read on the client.
   *
   * Anything that renders a cart-derived value MUST check this first. The
   * server has no localStorage, so it renders an empty cart; rendering the
   * persisted count on the first client render is a React hydration mismatch
   * — the single most likely bug to slip through on this codebase (§10).
   */
  isHydrated: boolean;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setNote: (productId: string, note: string) => void;
  clearCart: () => void;
  hasItem: (productId: string) => boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const PERSIST_DEBOUNCE_MS = 300;

/**
 * Mounted in the root layout.
 *
 * It wraps `{children}` but does NOT make them client components: children
 * passed as props stay server-rendered. This is the pattern that lets the cart
 * be interactive without converting the catalogue to client rendering.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate once, after mount, so the first client render still matches the
  // server HTML.
  useEffect(() => {
    dispatch({ type: 'HYDRATE', state: readPersistedCart() });
    setIsHydrated(true);
  }, []);

  // Debounced persistence. Writing on every keystroke of a line note would hit
  // localStorage synchronously on the main thread on each character.
  useEffect(() => {
    if (!isHydrated) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persistCart(state), PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state, isHydrated]);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', productId });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', productId, quantity });
  }, []);

  const setNote = useCallback((productId: string, note: string) => {
    dispatch({ type: 'SET_NOTE', productId, note });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const items = state.items;
    return {
      items,
      /** Total units — what the badge shows. */
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      /** Distinct products. */
      lineCount: items.length,
      isHydrated,
      isOpen,
      addItem,
      removeItem,
      setQuantity,
      setNote,
      clearCart,
      hasItem: (productId: string) => items.some((item) => item.productId === productId),
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    };
  }, [state.items, isHydrated, isOpen, addItem, removeItem, setQuantity, setNote, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside <CartProvider>.');
  }
  return context;
}
