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
