/**
 * Vitest global setup
 */

import '@testing-library/jest-dom';

// Mock Web Crypto API if not available in test environment
if (typeof global.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto as Crypto;
}
