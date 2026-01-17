/**
 * SigMF Extension Support
 *
 * Provides a framework for defining, registering, and validating
 * SigMF extension namespaces.
 */

import {
  ExtensionDefinition,
  ExtensionFieldDef,
  SigMFExtension,
  SigMFMetadata,
  ValidationError,
} from './types.js';

/**
 * Registry of known SigMF extensions.
 */
const extensionRegistry = new Map<string, ExtensionDefinition>();

/**
 * Register an extension definition.
 *
 * @param definition - Extension definition to register
 *
 * @example
 * ```ts
 * registerExtension({
 *   name: 'antenna',
 *   version: '1.0.0',
 *   description: 'Antenna parameters',
 *   globalFields: [
 *     { name: 'model', required: false, type: 'string', description: 'Antenna model' },
 *     { name: 'gain', required: false, type: 'number', description: 'Antenna gain in dBi' },
 *   ],
 * });
 * ```
 */
export function registerExtension(definition: ExtensionDefinition): void {
  extensionRegistry.set(definition.name, definition);
}

/**
 * Unregister an extension.
 *
 * @param name - Extension namespace name
 * @returns true if the extension was found and removed
 */
export function unregisterExtension(name: string): boolean {
  return extensionRegistry.delete(name);
}

/**
 * Get a registered extension definition.
 *
 * @param name - Extension namespace name
 * @returns Extension definition or undefined if not registered
 */
export function getExtension(name: string): ExtensionDefinition | undefined {
  return extensionRegistry.get(name);
}

/**
 * Get all registered extensions.
 *
 * @returns Array of registered extension definitions
 */
export function getAllExtensions(): ExtensionDefinition[] {
  return Array.from(extensionRegistry.values());
}

/**
 * Clear all registered extensions.
 */
export function clearExtensions(): void {
  extensionRegistry.clear();
}

/**
 * Check if an extension is registered.
 *
 * @param name - Extension namespace name
 * @returns true if the extension is registered
 */
export function hasExtension(name: string): boolean {
  return extensionRegistry.has(name);
}

/**
 * Extract the namespace from a field key.
 *
 * @param key - Field key in namespace:name format
 * @returns Namespace or undefined if no colon found
 *
 * @example
 * ```ts
 * getNamespace('antenna:gain'); // 'antenna'
 * getNamespace('invalid'); // undefined
 * ```
 */
export function getNamespace(key: string): string | undefined {
  const colonIndex = key.indexOf(':');
  return colonIndex > 0 ? key.substring(0, colonIndex) : undefined;
}

/**
 * Extract the field name from a field key.
 *
 * @param key - Field key in namespace:name format
 * @returns Field name after the colon, or the full key if no colon
 *
 * @example
 * ```ts
 * getFieldName('antenna:gain'); // 'gain'
 * getFieldName('invalid'); // 'invalid'
 * ```
 */
export function getFieldName(key: string): string {
  const colonIndex = key.indexOf(':');
  return colonIndex > 0 ? key.substring(colonIndex + 1) : key;
}

/**
 * Create a full field key from namespace and field name.
 *
 * @param namespace - Extension namespace
 * @param fieldName - Field name
 * @returns Full key in namespace:name format
 */
export function createFieldKey(namespace: string, fieldName: string): string {
  return `${namespace}:${fieldName}`;
}

/**
 * Get all extension namespaces used in a metadata object.
 *
 * @param metadata - SigMF metadata
 * @returns Set of extension namespace names (excluding 'core')
 */
export function getUsedExtensions(metadata: SigMFMetadata): Set<string> {
  const namespaces = new Set<string>();

  const extractNamespaces = (obj: Record<string, unknown>) => {
    for (const key of Object.keys(obj)) {
      const ns = getNamespace(key);
      if (ns && ns !== 'core') {
        namespaces.add(ns);
      }
    }
  };

  // Check global object
  extractNamespaces(metadata.global);

  // Check all captures
  for (const capture of metadata.captures) {
    extractNamespaces(capture);
  }

  // Check all annotations
  for (const annotation of metadata.annotations) {
    extractNamespaces(annotation);
  }

  return namespaces;
}

/**
 * Validate that all required extensions are declared.
 *
 * Checks that all extension namespaces used in the metadata are properly
 * declared in the global extensions array.
 *
 * @param metadata - SigMF metadata to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateExtensionDeclarations(metadata: SigMFMetadata): ValidationError[] {
  const errors: ValidationError[] = [];
  const usedExtensions = getUsedExtensions(metadata);
  const declaredExtensions = new Set<string>();

  // Get declared extensions
  const extensions = metadata.global['core:extensions'];
  if (extensions) {
    for (const ext of extensions) {
      declaredExtensions.add(ext.name);
    }
  }

  // Check all used extensions are declared
  for (const ns of usedExtensions) {
    if (!declaredExtensions.has(ns)) {
      errors.push({
        path: 'global.core:extensions',
        message: `Extension '${ns}' is used but not declared in core:extensions`,
        value: ns,
      });
    }
  }

  return errors;
}

/**
 * Validate extension fields against their definitions.
 *
 * Only validates fields for registered extensions.
 *
 * @param metadata - SigMF metadata to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateExtensionFields(metadata: SigMFMetadata): ValidationError[] {
  const errors: ValidationError[] = [];

  const validateObject = (
    obj: Record<string, unknown>,
    path: string,
    allowedFields: ExtensionFieldDef[] | undefined,
    extensionName: string
  ) => {
    if (!allowedFields) return;

    const fieldMap = new Map(allowedFields.map((f) => [f.name, f]));

    // Check for required fields
    for (const field of allowedFields) {
      if (field.required) {
        const key = createFieldKey(extensionName, field.name);
        if (obj[key] === undefined) {
          errors.push({
            path: `${path}.${key}`,
            message: `Required extension field is missing`,
          });
        }
      }
    }

    // Validate field types
    for (const [key, value] of Object.entries(obj)) {
      const ns = getNamespace(key);
      if (ns !== extensionName) continue;

      const fieldName = getFieldName(key);
      const fieldDef = fieldMap.get(fieldName);

      if (!fieldDef) {
        // Unknown field in a registered extension - could warn but not error
        continue;
      }

      // Type checking
      const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      if (fieldDef.type !== actualType) {
        errors.push({
          path: `${path}.${key}`,
          message: `Expected type '${fieldDef.type}' but got '${actualType}'`,
          value,
        });
      }
    }
  };

  // Get declared extensions that are registered
  const extensions = metadata.global['core:extensions'] ?? [];
  for (const ext of extensions) {
    const definition = getExtension(ext.name);
    if (!definition) continue;

    // Validate global fields
    validateObject(metadata.global, 'global', definition.globalFields, ext.name);

    // Validate capture fields
    for (let i = 0; i < metadata.captures.length; i++) {
      validateObject(
        metadata.captures[i],
        `captures[${i}]`,
        definition.captureFields,
        ext.name
      );
    }

    // Validate annotation fields
    for (let i = 0; i < metadata.annotations.length; i++) {
      validateObject(
        metadata.annotations[i],
        `annotations[${i}]`,
        definition.annotationFields,
        ext.name
      );
    }
  }

  return errors;
}

/**
 * Check if metadata uses any non-optional extensions that aren't supported.
 *
 * @param metadata - SigMF metadata to check
 * @param supportedExtensions - Set of extension names this application supports
 * @returns Array of unsupported non-optional extension names
 */
export function getUnsupportedRequiredExtensions(
  metadata: SigMFMetadata,
  supportedExtensions: Set<string>
): string[] {
  const unsupported: string[] = [];
  const extensions = metadata.global['core:extensions'] ?? [];

  for (const ext of extensions) {
    if (!ext.optional && !supportedExtensions.has(ext.name)) {
      unsupported.push(ext.name);
    }
  }

  return unsupported;
}

/**
 * Create an extension declaration object.
 *
 * @param name - Extension namespace name
 * @param version - Extension version
 * @param optional - Whether the extension is optional (default: true)
 * @returns SigMFExtension object
 */
export function createExtensionDeclaration(
  name: string,
  version: string,
  optional = true
): SigMFExtension {
  return { name, version, optional };
}

// ============================================================================
// Pre-defined Extension Definitions (Common SigMF Extensions)
// ============================================================================

/**
 * Antenna extension definition.
 * Based on https://github.com/sigmf/SigMF/blob/main/extensions/antenna.sigmf-ext.md
 */
export const ANTENNA_EXTENSION: ExtensionDefinition = {
  name: 'antenna',
  version: '1.0.0',
  description: 'Describes antenna properties',
  globalFields: [
    { name: 'model', required: false, type: 'string', description: 'Antenna model name/number' },
    { name: 'type', required: false, type: 'string', description: 'Antenna type (dipole, yagi, etc.)' },
    { name: 'low_frequency', required: false, type: 'number', description: 'Low frequency of operating range in Hz' },
    { name: 'high_frequency', required: false, type: 'number', description: 'High frequency of operating range in Hz' },
    { name: 'gain', required: false, type: 'number', description: 'Antenna gain in dBi' },
    { name: 'horizontal_gain_pattern', required: false, type: 'array', description: 'Horizontal gain pattern' },
    { name: 'vertical_gain_pattern', required: false, type: 'array', description: 'Vertical gain pattern' },
    { name: 'horizontal_beam_width', required: false, type: 'number', description: 'Horizontal 3dB beam width in degrees' },
    { name: 'vertical_beam_width', required: false, type: 'number', description: 'Vertical 3dB beam width in degrees' },
    { name: 'cross_polar_discrimination', required: false, type: 'number', description: 'Cross-polar discrimination in dB' },
    { name: 'voltage_standing_wave_ratio', required: false, type: 'number', description: 'VSWR' },
    { name: 'cable_loss', required: false, type: 'number', description: 'Cable loss in dB' },
    { name: 'steerable', required: false, type: 'boolean', description: 'Whether the antenna is steerable' },
    { name: 'mobile', required: false, type: 'boolean', description: 'Whether the antenna is mobile' },
    { name: 'hagl', required: false, type: 'number', description: 'Height above ground level in meters' },
  ],
  captureFields: [
    { name: 'azimuth_angle', required: false, type: 'number', description: 'Azimuth angle in degrees' },
    { name: 'elevation_angle', required: false, type: 'number', description: 'Elevation angle in degrees' },
    { name: 'polarization', required: false, type: 'string', description: 'Polarization (horizontal, vertical, etc.)' },
  ],
  collectionFields: [
    { name: 'hagl', required: false, type: 'number', description: 'Height above ground level in meters' },
    { name: 'azimuth_angle', required: false, type: 'number', description: 'Azimuth angle in degrees' },
    { name: 'elevation_angle', required: false, type: 'number', description: 'Elevation angle in degrees' },
  ],
};

/**
 * Capture details extension definition.
 */
export const CAPTURE_DETAILS_EXTENSION: ExtensionDefinition = {
  name: 'capture_details',
  version: '1.0.0',
  description: 'Additional capture metadata',
  captureFields: [
    { name: 'acq_scale_factor', required: false, type: 'number', description: 'Acquisition scale factor' },
    { name: 'attenuation', required: false, type: 'number', description: 'Attenuation in dB' },
    { name: 'acquisition_bandwidth', required: false, type: 'number', description: 'Acquisition bandwidth in Hz' },
    { name: 'start_capture', required: false, type: 'string', description: 'Start capture timestamp' },
    { name: 'stop_capture', required: false, type: 'string', description: 'Stop capture timestamp' },
    { name: 'source_file', required: false, type: 'string', description: 'Original source file' },
    { name: 'gain', required: false, type: 'number', description: 'Receiver gain in dB' },
  ],
};

/**
 * Register common SigMF extensions.
 *
 * Call this to register the standard SigMF extension definitions.
 */
export function registerCommonExtensions(): void {
  registerExtension(ANTENNA_EXTENSION);
  registerExtension(CAPTURE_DETAILS_EXTENSION);
}
