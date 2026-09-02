import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  RequireAnonymous,
  RequireAuth,
  RequirePasswordChange,
} from '@/components/layout/route-guards';
import { LoginPage } from '@/pages/login-page';
import { ChangePasswordPage } from '@/pages/change-password-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { CategoriesPage } from '@/pages/categories-page';
import { TaxonomyPage } from '@/pages/taxonomy-page';
import { ProductsPage } from '@/pages/products-page';
import { ProductFormPage } from '@/pages/product-form-page';
import { PlaceholderPage } from '@/pages/placeholder-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * Admin routes (PROJECT_PLAN.md §11).
 *
 * Three guard layers, in order of how a session progresses:
 *   RequireAnonymous       login only
 *   RequirePasswordChange  the forced rotation, reachable only mid-rotation
 *   RequireAuth            everything else
 *
 * The catalogue screens are stubbed here so the shell, navigation and guards
 * are exercisable end to end from Phase 1; each is filled in over Phases 2–5.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<RequireAnonymous />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RequirePasswordChange />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="brands" element={<TaxonomyPage kind="brand" />} />
              <Route path="industries" element={<TaxonomyPage kind="industry" />} />
              <Route path="products" element={<ProductsPage />} />
              {/* 'new' and an id share one component — the form differs only
                  in whether it loads a record first and offers "Save and add
                  another". */}
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id" element={<ProductFormPage />} />
              <Route
                path="quotations"
                element={<PlaceholderPage title="Quotations" phase="Phase 3" />}
              />
              <Route
                path="catalogue"
                element={<PlaceholderPage title="Catalogue" phase="Phase 4" />}
              />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
