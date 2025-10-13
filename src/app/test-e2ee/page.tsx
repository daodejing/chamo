'use client';

/**
 * E2EE Test Harness Page
 * This page is only for E2E testing of the encryption library.
 * It will be removed before production.
 */

import { useState } from 'react';
import {
  generateFamilyKey,
  importFamilyKey,
  createInviteCodeWithKey,
  parseInviteCode,
  initializeFamilyKey,
  getFamilyKey,
} from '@/lib/e2ee/key-management';
import { encryptMessage, decryptMessage, encryptFile, decryptFile } from '@/lib/e2ee/encryption';

export default function E2EETestPage() {
  const [status, setStatus] = useState<string>('Ready');
  const [result, setResult] = useState<string>('');

  const testMessageEncryption = async () => {
    try {
      setStatus('Testing message encryption...');
      const { familyKey, base64Key } = await generateFamilyKey();

      const plaintext = 'Hello, E2EE World!';
      const encrypted = await encryptMessage(plaintext, familyKey);
      const decrypted = await decryptMessage(encrypted, familyKey);

      if (decrypted === plaintext) {
        setStatus('✅ Message encryption test passed');
        setResult(JSON.stringify({ plaintext, encrypted: encrypted.slice(0, 40) + '...', decrypted }, null, 2));
      } else {
        setStatus('❌ Message encryption test failed');
      }
    } catch (error) {
      setStatus('❌ Error: ' + (error as Error).message);
    }
  };

  const testFileEncryption = async () => {
    try {
      setStatus('Testing file encryption...');
      const { familyKey } = await generateFamilyKey();

      // Create a fake JPEG file
      const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const blob = new Blob([fileContent], { type: 'image/jpeg' });

      const encrypted = await encryptFile(blob, familyKey);
      const decrypted = await decryptFile(encrypted, familyKey);

      const decryptedBytes = new Uint8Array(await decrypted.arrayBuffer());
      const match = decryptedBytes.every((byte, idx) => byte === fileContent[idx]);

      if (match && decrypted.type === 'image/jpeg') {
        setStatus('✅ File encryption test passed');
        setResult(JSON.stringify({
          originalType: blob.type,
          encryptedType: encrypted.type,
          decryptedType: decrypted.type,
          bytesMatch: match
        }, null, 2));
      } else {
        setStatus('❌ File encryption test failed');
      }
    } catch (error) {
      setStatus('❌ Error: ' + (error as Error).message);
    }
  };

  const testKeyStorage = async () => {
    try {
      setStatus('Testing key storage...');
      const { base64Key } = await generateFamilyKey();

      // Store key
      await initializeFamilyKey(base64Key);

      // Retrieve key
      const retrievedKey = await getFamilyKey();

      if (retrievedKey) {
        setStatus('✅ Key storage test passed');
        setResult('Key stored and retrieved from IndexedDB');
      } else {
        setStatus('❌ Key storage test failed');
      }
    } catch (error) {
      setStatus('❌ Error: ' + (error as Error).message);
    }
  };

  const testInviteCode = async () => {
    try {
      setStatus('Testing invite code...');
      const { base64Key } = await generateFamilyKey();
      const code = 'FAMILY-TEST123';

      const inviteCode = createInviteCodeWithKey(code, base64Key);
      const parsed = parseInviteCode(inviteCode);

      if (parsed.code === code && parsed.base64Key === base64Key) {
        setStatus('✅ Invite code test passed');
        setResult(JSON.stringify({ inviteCode: inviteCode.slice(0, 50) + '...', parsed }, null, 2));
      } else {
        setStatus('❌ Invite code test failed');
      }
    } catch (error) {
      setStatus('❌ Error: ' + (error as Error).message);
    }
  };

  const testPerformance = async () => {
    try {
      setStatus('Testing encryption performance...');
      const { familyKey } = await generateFamilyKey();
      const message = 'A'.repeat(100);

      // Warm up
      await encryptMessage(message, familyKey);

      // Benchmark
      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await encryptMessage(message, familyKey);
      }
      const end = performance.now();

      const avgTime = (end - start) / iterations;
      const target = 20; // 20ms target from tech spec

      if (avgTime < target) {
        setStatus(`✅ Performance test passed: ${avgTime.toFixed(2)}ms avg`);
        setResult(JSON.stringify({ avgTime, target, iterations }, null, 2));
      } else {
        setStatus(`⚠️ Performance below target: ${avgTime.toFixed(2)}ms avg (target: ${target}ms)`);
      }
    } catch (error) {
      setStatus('❌ Error: ' + (error as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">E2EE Test Harness</h1>

      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          ⚠️ This page is for testing only and will be removed before production.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={testMessageEncryption}
          data-testid="test-message-encryption"
          className="w-full p-4 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Message Encryption
        </button>

        <button
          onClick={testFileEncryption}
          data-testid="test-file-encryption"
          className="w-full p-4 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test File Encryption
        </button>

        <button
          onClick={testKeyStorage}
          data-testid="test-key-storage"
          className="w-full p-4 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Key Storage (IndexedDB)
        </button>

        <button
          onClick={testInviteCode}
          data-testid="test-invite-code"
          className="w-full p-4 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Test Invite Code
        </button>

        <button
          onClick={testPerformance}
          data-testid="test-performance"
          className="w-full p-4 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test Performance (< 20ms target)
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded">
        <h2 className="text-xl font-bold mb-2">Status</h2>
        <p data-testid="test-status" className="mb-4">{status}</p>

        {result && (
          <>
            <h3 className="text-lg font-semibold mb-2">Result</h3>
            <pre data-testid="test-result" className="bg-white p-4 rounded border overflow-auto text-xs">
              {result}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
