'use client';

import axios from 'axios';

/**
 * Browser-side API client (PROJECT_PLAN.md §4.4).
 *
 * Used only by the handful of client components that talk to the API directly:
 * search typeahead, the quote request form, and the catalogue download modal.
 * Everything else fetches on the server — see lib/api/server.ts.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'content-type': 'application/json' },
  timeout: 15_000,
});

export interface NormalisedApiError {
  code: string;
  message: string;
  details?: { field?: string; message: string }[];
  status?: number;
}

/**
 * Flattens an Axios failure into the API's own error envelope, so callers have
 * one shape to handle whether the request failed at the network or the API.
 */
export function normaliseError(error: unknown): NormalisedApiError {
  if (axios.isAxiosError(error)) {
    const envelope = error.response?.data as
      | {
          error?: {
            code?: string;
            message?: string;
            details?: { field?: string; message: string }[];
          };
        }
      | undefined;

    if (envelope?.error) {
      return {
        code: envelope.error.code ?? 'INTERNAL_ERROR',
        message: envelope.error.message ?? 'Something went wrong.',
        details: envelope.error.details,
        status: error.response?.status,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return { code: 'TIMEOUT', message: 'The request timed out. Please try again.' };
    }

    return {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
      status: error.response?.status,
    };
  }

  return { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}
