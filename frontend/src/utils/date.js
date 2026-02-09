/**
 * Date and Time Utilities
 * Centralized formatting for the platform
 */

/**
 * Formats an ISO string or time string into IST (AM/PM)
 * @param {string} dateString - The date/time string to format
 * @returns {string} - Formatted time (e.g., "09:00 AM")
 */
export const formatIST = (dateString) => {
    if (!dateString) return '-';

    try {
        // Handle raw time strings like "09:00:00"
        if (typeof dateString === 'string' && dateString.match(/^\d{2}:\d{2}/)) {
            const [hours, minutes] = dateString.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayHours = h % 12 || 12;
            return `${displayHours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        }

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).toUpperCase();
    } catch (e) {
        console.error('Error formatting date:', e);
        return dateString;
    }
};

/**
 * Formats an ISO string into IST Date + Time
 * @param {string} dateString 
 * @returns {string} - e.g., "Feb 7, 09:00 AM"
 */
export const formatFullIST = (dateString) => {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).toUpperCase();
    } catch (e) {
        return dateString;
    }
};
