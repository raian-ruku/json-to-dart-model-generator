/**
 * Core utilities for JSON-to-Dart model generation.
 */

/**
 * Converts a snake_case string to camelCase.
 * @param {string} str
 * @returns {string}
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Converts a snake_case or camelCase string to PascalCase.
 * @param {string} str
 * @returns {string}
 */
function snakeToPascal(str) {
  const camel = snakeToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Converts a PascalCase or camelCase string to snake_case.
 * @param {string} str
 * @returns {string}
 */
function camelToSnake(str) {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Infer the Dart type from a JSON value.
 * Returns an object describing the type.
 *
 * @param {*} value  - The JSON value
 * @param {string} key - The JSON key (used for naming nested classes)
 * @param {string} parentClassName - Parent class name for context
 * @returns {{ dartType: string, isObject: boolean, isList: boolean, listItemType: string|null, nestedSchema: object|null }}
 */
function inferDartType(value, key, parentClassName) {
  if (value === null || value === undefined) {
    return {
      dartType: "String?",
      isObject: false,
      isList: false,
      listItemType: null,
      nestedSchema: null,
    };
  }

  if (typeof value === "boolean") {
    return {
      dartType: "bool",
      isObject: false,
      isList: false,
      listItemType: null,
      nestedSchema: null,
    };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return {
        dartType: "int",
        isObject: false,
        isList: false,
        listItemType: null,
        nestedSchema: null,
      };
    }
    return {
      dartType: "double",
      isObject: false,
      isList: false,
      listItemType: null,
      nestedSchema: null,
    };
  }

  if (typeof value === "string") {
    return {
      dartType: "String",
      isObject: false,
      isList: false,
      listItemType: null,
      nestedSchema: null,
    };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        dartType: "List<dynamic>",
        isObject: false,
        isList: true,
        listItemType: "dynamic",
        nestedSchema: null,
      };
    }
    const firstItem = value[0];
    if (
      typeof firstItem === "object" &&
      firstItem !== null &&
      !Array.isArray(firstItem)
    ) {
      // Merge all array items to get the full schema
      const merged = mergeObjectSchemas(value);
      const nestedClassName = snakeToPascal(key);
      return {
        dartType: `List<${nestedClassName}>`,
        isObject: false,
        isList: true,
        listItemType: nestedClassName,
        nestedSchema: merged,
      };
    }
    const itemType = inferDartType(firstItem, key, parentClassName);
    return {
      dartType: `List<${itemType.dartType}>`,
      isObject: false,
      isList: true,
      listItemType: itemType.dartType,
      nestedSchema: null,
    };
  }

  if (typeof value === "object") {
    // Empty object → Map<String, dynamic>
    if (Object.keys(value).length === 0) {
      return {
        dartType: "Map<String, dynamic>",
        isObject: false,
        isList: false,
        listItemType: null,
        nestedSchema: null,
      };
    }
    const nestedClassName = snakeToPascal(key);
    return {
      dartType: nestedClassName,
      isObject: true,
      isList: false,
      listItemType: null,
      nestedSchema: value,
    };
  }

  return {
    dartType: "dynamic",
    isObject: false,
    isList: false,
    listItemType: null,
    nestedSchema: null,
  };
}

/**
 * Merge multiple JSON objects (from an array) into one schema that has every key.
 * @param {object[]} items
 * @returns {object}
 */
function mergeObjectSchemas(items) {
  const merged = {};
  for (const item of items) {
    if (typeof item === "object" && item !== null) {
      for (const [k, v] of Object.entries(item)) {
        if (!(k in merged) || merged[k] === null || merged[k] === undefined) {
          merged[k] = v;
        }
      }
    }
  }
  return merged;
}

/**
 * Recursively parse a JSON object and return a structured field list.
 *
 * @param {object} jsonObj
 * @param {string} parentClassName
 * @returns {{ fields: Array<{key: string, camelName: string, typeInfo: object}>, nestedClasses: Array }}
 */
function parseJsonStructure(jsonObj, parentClassName) {
  const fields = [];
  const nestedClasses = [];

  for (const [key, value] of Object.entries(jsonObj)) {
    const camelName = snakeToCamel(key);
    const typeInfo = inferDartType(value, key, parentClassName);

    fields.push({ key, camelName, typeInfo });

    // Collect nested object classes
    if (typeInfo.isObject && typeInfo.nestedSchema) {
      const nested = parseJsonStructure(
        typeInfo.nestedSchema,
        typeInfo.dartType,
      );
      nestedClasses.push({
        className: typeInfo.dartType,
        parsed: nested,
      });
      // Also collect deeply nested classes
      nestedClasses.push(...nested.nestedClasses);
    }

    // Collect nested list-of-object classes
    if (typeInfo.isList && typeInfo.nestedSchema) {
      const nested = parseJsonStructure(
        typeInfo.nestedSchema,
        typeInfo.listItemType,
      );
      nestedClasses.push({
        className: typeInfo.listItemType,
        parsed: nested,
      });
      nestedClasses.push(...nested.nestedClasses);
    }
  }

  return { fields, nestedClasses };
}

module.exports = {
  snakeToCamel,
  snakeToPascal,
  camelToSnake,
  inferDartType,
  parseJsonStructure,
  mergeObjectSchemas,
};
