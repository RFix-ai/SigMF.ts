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

    it('should have collection fields', () => {
      expect(ANTENNA_EXTENSION.collectionFields?.some(f => f.name === 'hagl')).toBe(true);
    });
  });

  describe('CAPTURE_DETAILS_EXTENSION', () => {
    it('should have expected fields', () => {
      expect(CAPTURE_DETAILS_EXTENSION.name).toBe('capture_details');
      expect(CAPTURE_DETAILS_EXTENSION.captureFields?.some(f => f.name === 'gain')).toBe(true);
    });
  });
});

describe('validateExtensionFields edge cases', () => {
  beforeEach(() => {
    clearExtensions();
  });

  afterEach(() => {
    clearExtensions();
  });

  it('should validate capture fields', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      captureFields: [
        { name: 'capture_value', required: false, type: 'number' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
      },
      captures: [
        { 'core:sample_start': 0, 'test:capture_value': 'not a number' },
      ],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toContain('captures');
  });

  it('should validate annotation fields', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      annotationFields: [
        { name: 'annotation_value', required: false, type: 'string' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
      },
      captures: [],
      annotations: [
        { 'core:sample_start': 0, 'test:annotation_value': 123 }, // Wrong type
      ],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toContain('annotations');
  });

  it('should handle null values correctly', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      globalFields: [
        { name: 'nullable', required: false, type: 'null' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
        'test:nullable': null,
      },
      captures: [],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors).toHaveLength(0);
  });

  it('should handle array values correctly', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      globalFields: [
        { name: 'items', required: false, type: 'array' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
        'test:items': [1, 2, 3],
      },
      captures: [],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors).toHaveLength(0);
  });

  it('should handle boolean values correctly', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      globalFields: [
        { name: 'enabled', required: false, type: 'boolean' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
        'test:enabled': true,
      },
      captures: [],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors).toHaveLength(0);
  });

  it('should skip validation when no extensions declared', () => {
    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
      },
      captures: [],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors).toHaveLength(0);
  });

  it('should ignore unknown fields in registered extensions', () => {
    registerExtension({
      name: 'test',
      version: '1.0.0',
      globalFields: [
        { name: 'known', required: false, type: 'string' },
      ],
    });

    const metadata: SigMFMetadata = {
      global: {
        'core:datatype': 'cf32_le',
        'core:version': '1.0.0',
        'core:extensions': [{ name: 'test', version: '1.0.0', optional: true }],
        'test:known': 'valid',
        'test:unknown': 'also valid - not checked',
      },
      captures: [],
      annotations: [],
    };

    const errors = validateExtensionFields(metadata);
    expect(errors).toHaveLength(0);
  });
});
