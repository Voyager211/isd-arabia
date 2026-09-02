'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { MenuCategory } from '@isd/shared-types';
import { t } from '@/lib/i18n/en';
import { STATIC_NAV } from '@/lib/site-config';

/**
 * Navigation bar with mega-menu panels (PROJECT_PLAN.md §9.1).
 *
 * The panel content is rendered in the server HTML — it is only the open/close
 * behaviour that needs the client. Hiding the links behind a JS-only fetch
 * would remove the catalogue's primary internal link graph from every crawl.
 *
 * Accessibility floor (§5.5): opens on hover with an intent delay AND on
 * focus/Enter for keyboard users, arrow keys move between top-level items,
 * Escape closes and returns focus to the trigger.
 */

const HOVER_INTENT_MS = 150;

export function MegaMenu({ menu }: { menu: MenuCategory[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const panelId = useId();

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // A short delay before opening stops the panel flashing as the pointer
  // crosses the nav bar on its way somewhere else.
  const scheduleOpen = useCallback(
    (slug: string) => {
      clearTimers();
      openTimer.current = setTimeout(() => setOpenSlug(slug), HOVER_INTENT_MS);
    },
    [clearTimers],
  );

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenSlug(null), HOVER_INTENT_MS);
  }, [clearTimers]);

  // Escape closes from anywhere inside the menu, including the panel links.
  useEffect(() => {
    if (!openSlug) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenSlug(null);
      navRef.current?.querySelector<HTMLButtonElement>(`[data-slug="${openSlug}"]`)?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openSlug]);

  // Outside click closes.
  useEffect(() => {
    if (!openSlug) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.parentElement?.contains(event.target as Node)) {
        setOpenSlug(null);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openSlug]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const triggers = Array.from(
      navRef.current?.querySelectorAll<HTMLElement>('[data-nav-item]') ?? [],
    );
    if (!triggers.length) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      triggers[(index + 1) % triggers.length].focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      triggers[(index - 1 + triggers.length) % triggers.length].focus();
    }
  };

  return (
    <div className="relative" onMouseLeave={scheduleClose}>
      <ul ref={navRef} className="flex items-stretch gap-1">
        <li>
          <Link
            data-nav-item
            href="/"
            className="flex h-12 items-center px-3 text-body-sm font-medium text-text-primary hover:text-action-secondary"
            onKeyDown={(event) => onTriggerKeyDown(event, 0)}
            onFocus={() => setOpenSlug(null)}
          >
            {t.nav.home}
          </Link>
        </li>

        {menu.map((group, index) => {
          const isOpen = openSlug === group.slug;

          return (
            <li key={group._id} onMouseEnter={() => scheduleOpen(group.slug)}>
              <button
                data-nav-item
                data-slug={group.slug}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${panelId}-${group.slug}`}
                className="flex h-12 items-center gap-1 px-3 text-body-sm font-medium text-text-primary hover:text-action-secondary"
                onClick={() => setOpenSlug(isOpen ? null : group.slug)}
                onFocus={() => setOpenSlug(group.slug)}
                onKeyDown={(event) => onTriggerKeyDown(event, index + 1)}
              >
                {group.name}
                <ChevronDown
                  aria-hidden
                  className={`size-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </li>
          );
        })}

        {STATIC_NAV.filter((entry) => entry.href !== '/products').map((entry, index) => (
          <li key={entry.href}>
            <Link
              data-nav-item
              href={entry.href}
              className="flex h-12 items-center px-3 text-body-sm font-medium text-text-primary hover:text-action-secondary"
              onFocus={() => setOpenSlug(null)}
              onKeyDown={(event) => onTriggerKeyDown(event, menu.length + 1 + index)}
            >
              {t.nav[entry.labelKey]}
            </Link>
          </li>
        ))}
      </ul>

      {menu.map((group) => (
        <div
          key={group._id}
          id={`${panelId}-${group.slug}`}
          hidden={openSlug !== group.slug}
          onMouseEnter={clearTimers}
          className="absolute inset-x-0 top-full z-50 border-t border-border-subtle bg-surface-page shadow-overlay"
        >
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-6 md:grid-cols-3 xl:grid-cols-5">
            {group.children.map((column) => (
              <div key={column._id}>
                <Link
                  href={`/category/${column.slug}`}
                  className="mb-3 block font-display text-h3 font-semibold text-surface-inverse hover:text-action-secondary"
                >
                  {column.name}
                </Link>
                <ul className="space-y-1.5">
                  {column.children.map((leaf) => (
                    <li key={leaf._id}>
                      <Link
                        href={`/category/${leaf.slug}`}
                        className="block text-body-sm text-text-secondary hover:text-action-secondary"
                      >
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="col-span-full border-t border-border-subtle pt-4 xl:col-span-1 xl:border-t-0 xl:border-s xl:ps-8 xl:pt-0">
              <Link
                href={`/category/${group.slug}`}
                className="text-body-sm font-semibold text-action-secondary hover:underline"
              >
                {t.nav.viewAll(group.name)}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
