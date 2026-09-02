/**
 * UI strings (PROJECT_PLAN.md §18).
 *
 * Arabic is out of scope, but keeping strings out of JSX costs nothing now and
 * is most of the work if the client later approves it. Do NOT build a content
 * translation layer — product and category names come from the database and
 * stay in English.
 *
 * Rule: no user-visible sentence is written inline in a component.
 */
export const t = {
  brand: {
    name: 'ISD Arabia',
    tagline: 'Welding & MRO consumables for Saudi industry',
  },

  nav: {
    home: 'Home',
    brands: 'Brands',
    industries: 'Industries',
    company: 'Company',
    contact: 'Contact',
    about: 'About us',
    allProducts: 'All products',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    viewAll: (name: string) => `View all ${name}`,
    mainNavigation: 'Main navigation',
    breadcrumb: 'Breadcrumb',
  },

  utility: {
    hours: 'Sun–Thu, 8:00–17:00 AST',
    callUs: 'Call us',
    emailUs: 'Email us',
  },

  search: {
    label: 'Search products',
    placeholder: 'Search by product name or part number',
    submit: 'Search',
    clear: 'Clear search',
    suggestionsLabel: 'Search suggestions',
    noResults: 'No matches found',
    noResultsHint: 'Try a part number, or browse the categories below.',
    resultsFor: (query: string) => `Results for “${query}”`,
  },

  cart: {
    title: 'Quote request',
    open: 'Open quote request',
    empty: 'Your quote request is empty.',
    emptyHint: 'Add products from the catalogue to request a quotation.',
    browseCatalogue: 'Browse the catalogue',
    itemCount: (count: number) => (count === 1 ? '1 item' : `${count} items`),
    addToQuote: 'Add to quote',
    added: 'Added to your quote request',
    remove: 'Remove',
    removed: 'Removed from your quote request',
    quantity: 'Quantity',
    increase: 'Increase quantity',
    decrease: 'Decrease quantity',
    lineNote: 'Note for this line',
    lineNotePlaceholder: 'Size, grade, or other requirement',
    review: 'Review request',
    continue: 'Continue to request details',
    clear: 'Clear all',
    cleared: 'Quote request cleared',
  },

  product: {
    sku: 'Part number',
    unit: 'Unit',
    minOrder: 'Minimum order',
    availability: 'Availability',
    brand: 'Brand',
    description: 'Description',
    keyFeatures: 'Key features',
    specifications: 'Specifications',
    downloads: 'Downloads',
    related: 'Related products',
    requestCallback: 'Request a callback',
    noImage: 'No image available',
    availabilityLabels: {
      in_stock: 'In stock',
      made_to_order: 'Made to order',
      on_request: 'Available on request',
    },
  },

  listing: {
    filters: 'Filters',
    clearFilters: 'Clear all filters',
    sort: 'Sort by',
    loadMore: 'Load more products',
    showing: (shown: number, total: number) =>
      `Showing ${shown.toLocaleString('en')} of ${total.toLocaleString('en')} products`,
    empty: 'No products match these filters.',
    emptyHint: 'Try removing a filter, or browse the full catalogue.',
    sortOptions: {
      newest: 'Newest first',
      oldest: 'Oldest first',
      name_asc: 'Name A–Z',
      name_desc: 'Name Z–A',
      relevance: 'Best match',
    },
  },

  catalogue: {
    download: 'Download catalogue',
    downloadTitle: 'Download the product catalogue',
    downloadIntro: 'Tell us where to send it and the download will start immediately.',
    fileSize: (mb: string) => `PDF · ${mb} MB`,
    pageCount: (pages: number) => `${pages} pages`,
    consent: 'I agree to be contacted about this enquiry.',
    submit: 'Get the catalogue',
    successTitle: 'Your download is ready',
    successBody: 'The download should have started. If it did not, use the link below.',
    downloadAgain: 'Download again',
  },

  quote: {
    yourDetails: 'Your details',
    deliveryAddress: 'Delivery address',
    additionalRequirements: 'Additional requirements',
    summary: 'Request summary',
    submit: 'Submit quotation request',
    submitting: 'Submitting…',
    consent: 'I agree to be contacted about this enquiry.',
    successTitle: 'Quotation request received',
    successBody: 'Our team will review your request and respond with pricing and availability.',
    responseTime: 'We typically respond within one business day.',
    quoteNumber: 'Your reference',
    printThis: 'Print this page',
    backToCatalogue: 'Back to the catalogue',
    unavailableLines: 'Some items are no longer available and have been highlighted below.',
    removeUnavailable: 'Remove unavailable items',
    fields: {
      name: 'Full name',
      designation: 'Job title',
      company: 'Company',
      email: 'Work email',
      phone: 'Phone',
      line1: 'Address line 1',
      line2: 'Address line 2',
      city: 'City',
      region: 'Region',
      postalCode: 'Postal code',
      country: 'Country',
      message: 'Anything else we should know?',
      optional: 'optional',
    },
  },

  footer: {
    information: 'Information',
    industries: 'Industries',
    contact: 'Contact',
    rights: (year: number) => `© ${year} ISD Arabia. All rights reserved.`,
    privacy: 'Privacy policy',
    terms: 'Terms of use',
  },

  common: {
    loading: 'Loading…',
    error: 'Something went wrong.',
    retry: 'Try again',
    close: 'Close',
    required: 'Required',
    skipToContent: 'Skip to content',
  },
} as const;

export type Strings = typeof t;
