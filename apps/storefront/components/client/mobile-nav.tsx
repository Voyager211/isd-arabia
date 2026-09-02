'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

import type { MenuCategory } from '@isd/shared-types';
import { t } from '@/lib/i18n/en';
import { CONTACT, STATIC_NAV } from '@/lib/site-config';

/**
 * Off-canvas navigation drawer below `lg` (PROJECT_PLAN.md §9.1, §5.3).
 *
 * The mega-menu becomes an accordion here — three levels do not fit a phone
 * viewport as columns, and a horizontally scrolling menu is unusable with a
 * thumb.
 */
export function MobileNav({ menu }: { menu: MenuCategory[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape closes and focus returns to the trigger — the accessibility floor
  // requires focus restoration, not just dismissal.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t.nav.openMenu}
        aria-expanded={isOpen}
        className="-ms-2 p-2 lg:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-60 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.mainNavigation}
            tabIndex={-1}
            className="absolute inset-y-0 start-0 flex w-[min(88vw,360px)] flex-col bg-surface-page shadow-overlay outline-none"
          >
            <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
              <span className="font-display text-h3 font-bold text-surface-inverse">
                {t.brand.name}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.nav.closeMenu}
                className="p-2"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul>
                {menu.map((group) => {
                  const isExpanded = expanded === group.slug;

                  return (
                    <li key={group._id} className="border-b border-border-subtle">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : group.slug)}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center justify-between px-2 py-3 text-start text-body font-semibold text-text-primary"
                      >
                        {group.name}
                        <ChevronDown
                          aria-hidden
                          className={`size-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded ? (
                        <ul className="pb-3 ps-4">
                          {group.children.map((column) => (
                            <li key={column._id} className="py-1.5">
                              <Link
                                href={`/category/${column.slug}`}
                                onClick={() => setIsOpen(false)}
                                className="block text-body-sm font-semibold text-text-primary"
                              >
                                {column.name}
                              </Link>
                              <ul className="ps-3 pt-1">
                                {column.children.map((leaf) => (
                                  <li key={leaf._id}>
                                    <Link
                                      href={`/category/${leaf.slug}`}
                                      onClick={() => setIsOpen(false)}
                                      className="block py-1 text-body-sm text-text-secondary"
                                    >
                                      {leaf.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}

                {STATIC_NAV.map((entry) => (
                  <li key={entry.href} className="border-b border-border-subtle">
                    <Link
                      href={entry.href}
                      onClick={() => setIsOpen(false)}
                      className="block px-2 py-3 text-body font-semibold text-text-primary"
                    >
                      {t.nav[entry.labelKey]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* The utility bar is hidden below md, so its contact details are
                repeated here rather than being unreachable on a phone. */}
            <div className="border-t border-border-subtle px-4 py-4 text-caption text-text-secondary">
              <a className="block py-0.5" href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>
                {CONTACT.phone}
              </a>
              <a className="block py-0.5" href={`mailto:${CONTACT.email}`}>
                {CONTACT.email}
              </a>
              <p className="pt-1">{t.utility.hours}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
