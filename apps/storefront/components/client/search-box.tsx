'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import type { SearchSuggestion } from '@isd/shared-types';
import { t } from '@/lib/i18n/en';
import { api } from '@/lib/api/client';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';

/**
 * Header search with typeahead (PROJECT_PLAN.md §9.6).
 *
 * Fires after 2 characters, debounced 300ms, max 8 suggestions. Enter goes to
 * the full /search results page rather than the first suggestion — buyers
 * often type a partial part number and want the list.
 */

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // An AbortController per keystroke means a slow earlier response cannot
    // land after a faster later one and overwrite it.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.get<{ data: SearchSuggestion[] }>('/search/suggest', {
          params: { q: trimmed },
          signal: controller.signal,
        });
        setSuggestions(response.data.data);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch {
        // A failed suggestion lookup is not worth interrupting the user for —
        // Enter still runs the full search.
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const submit = (destination?: string) => {
    setIsOpen(false);
    router.push(destination ?? `/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!isOpen || !suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      submit(`/products/${suggestions[activeIndex].slug}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim().length >= MIN_QUERY_LENGTH) submit();
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          {t.search.label}
        </label>

        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-surface-raised ps-3 focus-within:border-action-secondary">
          <Search aria-hidden className="size-4 shrink-0 text-text-muted" />
          <input
            id={`${listboxId}-input`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length && setIsOpen(true)}
            placeholder={t.search.placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            className="h-10 w-full bg-transparent text-body-sm outline-none placeholder:text-text-muted"
          />

          {isLoading ? (
            <Loader2 aria-hidden className="me-3 size-4 shrink-0 animate-spin text-text-muted" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="me-2 p-1 text-text-muted hover:text-text-primary"
              aria-label={t.search.clear}
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t.search.suggestionsLabel}
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface-page shadow-overlay"
        >
          {suggestions.length ? (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.slug}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <Link
                  href={`/products/${suggestion.slug}`}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    index === activeIndex ? 'bg-surface-sunken' : 'hover:bg-surface-raised'
                  }`}
                >
                  <Image
                    src={
                      suggestion.imageUrl
                        ? cloudinaryUrl(suggestion.imageUrl, 'productThumb')
                        : PLACEHOLDER_IMAGE
                    }
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-[var(--radius-control)] border border-border-subtle bg-white object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm text-text-primary">
                      {suggestion.name}
                    </span>
                    <span className="block truncate text-caption text-text-secondary" data-tabular>
                      {suggestion.sku} · {suggestion.categoryName}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-body-sm text-text-secondary">{t.search.noResults}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
