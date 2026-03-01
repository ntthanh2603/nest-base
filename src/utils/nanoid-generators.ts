import { customAlphabet } from 'nanoid';

// Shared alphabet for all ID generators
const ALPHABET =
  '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate unique ID with specified length
 * @param length - Length of the generated ID (default: 12)
 * @returns Unique ID string
 */
export const generateId = (length: number = 12): string => {
  const nanoid = customAlphabet(ALPHABET, length);
  return nanoid();
};
