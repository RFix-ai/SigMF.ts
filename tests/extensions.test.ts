/**
 * SigMF Extension Support Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerExtension,
  unregisterExtension,
  getExtension,
  getAllExtensions,
  clearExtensions,
  hasExtension,
  getNamespace,
  getFieldName,
  createFieldKey,
  getUsedExtensions,
  validateExtensionDeclarations,
  validateExtensionFields,
  getUnsupportedRequiredExtensions,
  createExtensionDeclaration,
  registerCommonExtensions,
  ANTENNA_EXTENSION,
  CAPTURE_DETAILS_EXTENSION,
} from '../src/extensions.js';
import { SigMFMetadata } from '../src/types.js';

describe('Extension Registry', () => {
  beforeEach(() => {
    clearExtensions();
  });

  afterEach(() => {
    clearExtensions();
  });

  describe('registerExtension', () => {
    it('should register an extension', () => {
      registerExtension({
        name: 'test',
        version: '1.0.0',
        description: 'Test extension',
      });

      expect(hasExtension('test')).toBe(true);
    });

    it('should overwrite existing extension', () => {
      registerExtension({ name: 'test', version: '1.0.0' });
      registerExtension({ name: 'test', version: '2.0.0' });

      const ext = getExtension('test');
      expect(ext?.version).toBe('2.0.0');
    });
  });

  describe('unregisterExtension', () => {
    it('should unregister an extension', () => {
      registerExtension({ name: 'test', version: '1.0.0' });
      const result = unregisterExtension('test');

      expect(result).toBe(true);
      expect(hasExtension('test')).toBe(false);
    });

    it('should return false for non-existent extension', () => {
      const result = unregisterExtension('missing');
      expect(result).toBe(false);
    });
  });

  describe('getExtension', () => {
    it('should return extension definition', () => {
      registerExtension({
        name: 'test',
        version: '1.0.0',
        globalFields: [{ name: 'field1', required: false, type: 'string' }],
      });

      const ext = getExtension('test');
      expect(ext).toBeDefined();
      expect(ext?.globalFields).toHaveLength(1);
    });

    it('should return undefined for non-existent extension', () => {
      expect(getExtension('missing')).toBeUndefined();
    });
  });

  describe('getAllExtensions', () => {
    it('should return all registered extensions', () => {
      registerExtension({ name: 'ext1', version: '1.0.0' });
      registerExtension({ name: 'ext2', version: '1.0.0' });

      const all = getAllExtensions();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no extensions', () => {
      expect(getAllExtensions()).toHaveLength(0);
    });
  });

  describe('hasExtension', () => {
    it('should return true for registered extension', () => {
      registerExtension({ name: 'test', version: '1.0.0' });
      expect(hasExtension('test')).toBe(true);
    });

    it('should return false for non-existent extension', () => {
      expect(hasExtension('missing')).toBe(false);
    });
  });
});

describe('Field Key Utilities', () => {
  describe('getNamespace', () => {
    it('should extract namespace from key', () => {
      expect(getNamespace('antenna:gain')).toBe('antenna');
      expect(getNamespace('core:datatype')).toBe('core');
    });

    it('should return undefined for invalid key', () => {
      expect(getNamespace('invalid')).toBeUndefined();
      expect(getNamespace('')).toBeUndefined();
    });
  });

  describe('getFieldName', () => {
    it('should extract field name from key', () => {
      expect(getFieldName('antenna:gain')).toBe('gain');
      expect(getFieldName('core:sample_rate')).toBe('sample_rate');
    });

    it('should return full key if no colon', () => {
      expect(getFieldName('invalid')).toBe('invalid');
    });
  });

  describe('createFieldKey', () => {
    it('should create field key from namespace and name', () => {
      expect(createFieldKey('antenna', 'gain')).toBe('antenna:gain');
      expect(createFieldKey('core', 'datatype')).toBe('core:datatype');
    });
  });
});

describe('Extension Validation', () => {
  beforeEach(() => {
    clearExtensions();
  });

  afterEach(() => {
    clearExtensions();
  });

  describe('getUsedExtensions', () => {
    it('should find extensions used in global', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'antenna:gain': 10,
          'custom:field': 'value',
        },
        captures: [],
        annotations: [],
      };

      const used = getUsedExtensions(metadata);
      expect(used.has('antenna')).toBe(true);
      expect(used.has('custom')).toBe(true);
      expect(used.has('core')).toBe(false); // core is excluded
    });

    it('should find extensions used in captures', () => {
      const metadata: SigMFMetadata = {
        global: { 'core:datatype': 'cf32_le', 'core:version': '1.0.0' },
        captures: [
          { 'core:sample_start': 0, 'capture_details:gain': 30 },
        ],
        annotations: [],
      };

      const used = getUsedExtensions(metadata);
      expect(used.has('capture_details')).toBe(true);
    });

    it('should find extensions used in annotations', () => {
      const metadata: SigMFMetadata = {
        global: { 'core:datatype': 'cf32_le', 'core:version': '1.0.0' },
        captures: [],
        annotations: [
          { 'core:sample_start': 0, 'signal:modulation': 'FM' },
        ],
      };

      const used = getUsedExtensions(metadata);
      expect(used.has('signal')).toBe(true);
    });
  });

  describe('validateExtensionDeclarations', () => {
    it('should pass when all extensions are declared', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [{ name: 'antenna', version: '1.0.0', optional: true }],
          'antenna:gain': 10,
        },
        captures: [],
        annotations: [],
      };

      const errors = validateExtensionDeclarations(metadata);
      expect(errors).toHaveLength(0);
    });

    it('should fail when extension is used but not declared', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'antenna:gain': 10, // Not declared
        },
        captures: [],
        annotations: [],
      };

      const errors = validateExtensionDeclarations(metadata);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("'antenna'");
    });
  });

  describe('validateExtensionFields', () => {
    it('should validate registered extension fields', () => {
      registerExtension({
        name: 'test',
        version: '1.0.0',
        globalFields: [
          { name: 'count', required: false, type: 'number' },
        ],
      });

      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
          'test:count': 'not a number', // Wrong type
        },
        captures: [],
        annotations: [],
      };

      const errors = validateExtensionFields(metadata);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("'number'");
    });

    it('should require required fields', () => {
      registerExtension({
        name: 'test',
        version: '1.0.0',
        globalFields: [
          { name: 'required_field', required: true, type: 'string' },
        ],
      });

      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
          // Missing test:required_field
        },
        captures: [],
        annotations: [],
      };

      const errors = validateExtensionFields(metadata);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Required');
    });

    it('should skip unregistered extensions', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [{ name: 'unregistered', version: '1.0.0', optional: true }],
          'unregistered:anything': 'any value',
        },
        captures: [],
        annotations: [],
      };

      const errors = validateExtensionFields(metadata);
      expect(errors).toHaveLength(0);
    });
  });

  describe('getUnsupportedRequiredExtensions', () => {
    it('should return empty for all supported extensions', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [
            { name: 'antenna', version: '1.0.0', optional: false },
          ],
        },
        captures: [],
        annotations: [],
      };

      const unsupported = getUnsupportedRequiredExtensions(metadata, new Set(['antenna']));
      expect(unsupported).toHaveLength(0);
    });

    it('should return required but unsupported extensions', () => {
      const metadata: SigMFMetadata = {
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.0.0',
          'core:extensions': [
            { name: 'required_ext', version: '1.0.0', optional: false },
            { name: 'optional_ext', version: '1.0.0', optional: true },
          ],
        },
        captures: [],
        annotations: [],
      };

      const unsupported = getUnsupportedRequiredExtensions(metadata, new Set());
      expect(unsupported).toContain('required_ext');
      expect(unsupported).not.toContain('optional_ext');
    });
  });
});

describe('Extension Helpers', () => {
  describe('createExtensionDeclaration', () => {
    it('should create declaration with defaults', () => {
      const decl = createExtensionDeclaration('test', '1.0.0');
      expect(decl.name).toBe('test');
      expect(decl.version).toBe('1.0.0');
      expect(decl.optional).toBe(true);
    });

    it('should create required declaration', () => {
      const decl = createExtensionDeclaration('test', '2.0.0', false);
      expect(decl.optional).toBe(false);
    });
  });
});

describe('Common Extensions', () => {
  beforeEach(() => {
    clearExtensions();
  });

  afterEach(() => {
    clearExtensions();
  });

  describe('registerCommonExtensions', () => {
    it('should register antenna extension', () => {
      registerCommonExtensions();
      expect(hasExtension('antenna')).toBe(true);
    });

    it('should register capture_details extension', () => {
      registerCommonExtensions();
      expect(hasExtension('capture_details')).toBe(true);
    });
  });

  describe('ANTENNA_EXTENSION', () => {
    it('should have expected fields', () => {
      expect(ANTENNA_EXTENSION.name).toBe('antenna');
      expect(ANTENNA_EXTENSION.globalFields?.some(f => f.name === 'gain')).toBe(true);
      expect(ANTENNA_EXTENSION.captureFields?.some(f => f.name === 'azimuth_angle')).toBe(true);
    });
  });

  describe('CAPTURE_DETAILS_EXTENSION', () => {
    it('should have expected fields', () => {
      expect(CAPTURE_DETAILS_EXTENSION.name).toBe('capture_details');
      expect(CAPTURE_DETAILS_EXTENSION.captureFields?.some(f => f.name === 'gain')).toBe(true);
    });
  });
});
