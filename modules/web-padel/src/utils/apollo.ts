import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { createHttpLink } from '@apollo/client/link/http';
import { setContext } from '@apollo/client/link/context';
import { getApiUrl } from './api';
import { showErrorToast } from './toastHelper';

const apiUrl = getApiUrl();

const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      user { id name email userid status }
      token
      refreshToken
      expiresIn
    }
  }
`;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  userid: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

const STORAGE_KEY = 'padel_user';

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (reason?: unknown) => void;
}> = [];

const drainQueue = (token: string | null, error: unknown = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

const getStoredUser = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveUser = (payload: any): AuthUser => {
  const expiresIn = payload.expiresIn ?? 30;
  const authUser: AuthUser = {
    id: payload.user.id,
    name: payload.user.name,
    email: payload.user.email,
    userid: payload.user.userid,
    token: payload.token,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  return authUser;
};

const isTokenExpired = (user: AuthUser | null, bufferMs = 5000): boolean => {
  if (!user?.expiresAt) return true;
  return Date.now() >= user.expiresAt - bufferMs;
};

const performRefresh = async (refreshToken: string): Promise<void> => {
  console.log('[TOKEN] Refresh request sent');
  const response = await fetch(`${apiUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Type': 'authenticate' },
    body: JSON.stringify({
      query: REFRESH_TOKEN_MUTATION.loc?.source.body,
      variables: { refreshToken },
    }),
  });

  if (!response.ok) {
    throw new Error('Refresh HTTP ' + response.status);
  }

  const result = await response.json();
  if (result.errors || !result.data?.refreshToken) {
    throw new Error(result.errors?.[0]?.message || 'Invalid refresh response');
  }

  saveUser(result.data.refreshToken);
  console.log('[TOKEN] Refresh succeeded, expiresAt=', getStoredUser()?.expiresAt);
};

const triggerAuthError = (message: string) => {
  showErrorToast(message);
  setTimeout(() => {
    if (window.location.pathname !== '/auth') {
      window.location.href = '/auth';
    }
  }, 1500);
};

/**
 * Proactively refresh token if expired or about to expire.
 * Serialized: concurrent callers queue on the same refresh.
 * Returns null only when no session exists or refresh fails.
 */
const ensureValidToken = async (): Promise<string | null> => {
  const user = getStoredUser();

  // No session at all — let caller decide (login flow)
  if (!user?.refreshToken) {
    return null;
  }

  // Token still valid — return immediately
  if (!isTokenExpired(user)) {
    return user.token;
  }

  // Already refreshing? Queue behind it
  if (isRefreshing) {
    return new Promise<string | null>((resolve, reject) => {
      pendingQueue.push({ resolve, reject });
    });
  }

  // Start refresh
  isRefreshing = true;
  try {
    await performRefresh(user.refreshToken);
    const newUser = getStoredUser();
    const token = newUser?.token ?? null;
    drainQueue(token);
    return token;
  } catch (err) {
    console.error('[TOKEN] Refresh failed:', err);
    drainQueue(null, err);
    localStorage.removeItem(STORAGE_KEY);
    triggerAuthError('Session expired, please login again');
    return null;
  } finally {
    isRefreshing = false;
  }
};

/**
 * Fetch wrapper — only acts when a session exists.
 * No-session requests (login, etc.) pass through untouched.
 */
const rawFetch = async (input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  const user = getStoredUser();

  // No session — pass through (login, register, etc.)
  if (!user?.refreshToken) {
    return fetch(input, options);
  }

  // Token valid — send as-is
  if (!isTokenExpired(user)) {
    return fetch(input, options);
  }

  // Expired — refresh then retry with new token
  console.warn('[TOKEN] Token expired, refreshing before request');
  const token = await ensureValidToken();
  if (!token) {
    throw new Error('Unauthorized');
  }

  if (options?.headers) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', 'Bearer ' + token);
    // Remove X-Request-Type so backend validates the new token and populates ctx user
    headers.delete('X-Request-Type');
    return fetch(input, { ...options, headers });
  }
  return fetch(input, options);
};

const httpLink = createHttpLink({
  uri: apiUrl + '/query',
  fetch: rawFetch,
});

const authLink = setContext((_, { headers }) => {
  try {
    const user = getStoredUser();

    // No session — send as authenticate flow
    if (!user?.refreshToken) {
      return { headers: { ...headers, 'X-Request-Type': 'authenticate' } };
    }

    // Token valid — attach bearer
    if (!isTokenExpired(user)) {
      return { headers: { ...headers, Authorization: 'Bearer ' + user.token } };
    }

    // Expired — rawFetch will handle refresh+retry; send no auth header for now
    return { headers: { ...headers, 'X-Request-Type': 'authenticate' } };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { headers: { ...headers, 'X-Request-Type': 'authenticate' } };
  }
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
    },
  },
});

export { ApolloProvider, gql };
