/**
 * Formats a date string into YYYY.MM.DD format.
 * Automatically adds dots as the user types numbers.
 * @param {string} value - The input value to format.
 * @returns {string} - The formatted date string.
 */
export const formatBirthDate = (value) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');

    // 최대 8자리까지만 허용 (YYYYMMDD)
    const limited = numbers.slice(0, 8);

    if (limited.length <= 4) {
        return limited;
    } else if (limited.length <= 6) {
        return `${limited.slice(0, 4)}.${limited.slice(4)}`;
    } else {
        return `${limited.slice(0, 4)}.${limited.slice(4, 6)}.${limited.slice(6)}`;
    }
};

/**
 * Normalizes various date string formats (YYYY-MM-DD, MM/DD/YYYY, etc.) into YYYY.MM.DD.
 * @param {string} dateStr - The date string to normalize.
 * @returns {string} - The normalized date string in YYYY.MM.DD format.
 */
export const normalizeDate = (dateStr) => {
    if (!dateStr) return '';

    // YYYY-MM-DD or MM/DD/YYYY or YYYY/MM/DD -> YYYY.MM.DD
    const cleanStr = dateStr.split('T')[0]; // Remove time if present
    const parts = cleanStr.replace(/-/g, '.').replace(/\//g, '.').split('.');

    if (parts.length === 3) {
        // Check if first part is year (4 digits)
        if (parts[0].length === 4) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');
            return `${y}.${m}.${d}`;
        }
        // Check if last part is year (4 digits), assume MM.DD.YYYY
        if (parts[2].length === 4) {
            const y = parts[2];
            const m = parts[0].padStart(2, '0');
            const d = parts[1].padStart(2, '0');
            return `${y}.${m}.${d}`;
        }
    }
    return cleanStr;
};
