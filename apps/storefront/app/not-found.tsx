import Link from 'next/link';

import { t } from '@/lib/i18n/en';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[50dvh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-display font-bold text-surface-inverse">Page not found</p>
      <p className="mt-2 max-w-[46ch] text-body text-text-secondary">
        That page does not exist. It may have been renamed, or the product may no longer be in the
        catalogue.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/products" className="btn-secondary">
          {t.nav.allProducts}
        </Link>
        <Link href="/contact" className="btn-primary">
          {t.nav.contact}
        </Link>
      </div>
    </div>
  );
}
