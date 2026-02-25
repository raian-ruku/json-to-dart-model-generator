/**
 * Parse a URL query string into a JSON object with inferred types.
 *
 * Example input:  "transaction_id=1&is_active=true&amount=10.5&device=web"
 * Example output: { transaction_id: 1, is_active: true, amount: 10.5, device: "web" }
 *
 * @param {string} queryString - URL query string (without leading ?)
 * @returns {object} A JSON object suitable for the Post Model from JSON generator
 */
function parseQueryParams(queryString) {
  const result = {};
  const cleaned = queryString.trim().replace(/^\?/, "");

  if (!cleaned) return result;

  const pairs = cleaned.split("&");
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (!key) continue;

    const decodedKey = decodeURIComponent(key.trim());
    const decodedValue =
      value !== undefined ? decodeURIComponent(value.trim()) : "";

    // Infer type
    if (decodedValue.toLowerCase() === "true") {
      result[decodedKey] = true;
    } else if (decodedValue.toLowerCase() === "false") {
      result[decodedKey] = false;
    } else if (!isNaN(decodedValue) && decodedValue !== "") {
      if (decodedValue.includes(".")) {
        result[decodedKey] = parseFloat(decodedValue);
      } else {
        result[decodedKey] = parseInt(decodedValue, 10);
      }
    } else {
      result[decodedKey] = decodedValue;
    }
  }

  return result;
}

module.exports = { parseQueryParams };
