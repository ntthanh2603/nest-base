import { randomInt } from 'crypto';

/**
 * Generate a secure 6-digit OTP using cryptographic random integers.
 * This is more secure than Math.random() which is predictable.
 * @returns A 6-digit string OTP (e.g., "123456")
 */
export const generate6DigitOtp = (): string => {
  return randomInt(100000, 1000000).toString();
};
