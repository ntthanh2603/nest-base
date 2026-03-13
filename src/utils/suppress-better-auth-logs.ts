/**
 * Suppress logs from Better Auth to avoid cluttering test output.
 * This is a temporary workaround until Better Auth provides a proper logging configuration.
 */
export function suppressBetterAuthLogs(): void {
  // eslint-disable-next-line no-console
  const originalError = console.error;
  // eslint-disable-next-line no-console
  console.error = function (...args: unknown[]) {
    const message = (args[0] as string)?.toString?.() || '';
    if (message.includes('[Better Auth]')) {
      return;
    }
    originalError.apply(console, args);
  };
}
