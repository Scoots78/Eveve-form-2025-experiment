// --- API Service ---

/**
 * Fetches available times for a given establishment, date, and number of covers.
 * @param {string} estNameForApi - The establishment identifier.
 * @param {string} date - The selected date (YYYY-MM-DD).
 * @param {number} covers - The number of covers.
 * @returns {Promise<object|null>} A promise that resolves to the availability data object, or null if an error occurs.
 */
export async function fetchAvailableTimes(estNameForApi, date, covers) {
    const apiUrl = `https://nz.eveve.com/web/day-avail?est=${estNameForApi}&covers=${covers}&date=${date}`;
    // console.log(`Fetching available times from (api_service): ${apiUrl}`); // For debugging if needed

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = await response.text();
            }
            console.error('API Service - Day Avail API Error Response Data:', errorData);
            // Throw an error that includes status and parsed/text data
            const err = new Error(`HTTP error! status: ${response.status}. Body: ${JSON.stringify(errorData)}`);
            err.status = response.status;
            err.data = errorData;
            throw err;
        }
        const data = await response.json();
        // console.log('API Service - Available times data received:', data); // For debugging if needed
        return data;
    } catch (error) {
        console.error('API Service - Error fetching available times:', error.message);
        // Optionally, re-throw the error if the caller should handle it,
        // or return a specific error structure / null.
        // For now, re-throwing to let the caller decide on UI impact.
        throw error;
    }
}

/**
 * Attempts to place a hold for a booking.
 * @param {object} holdApiData - An object containing the data for the hold API call.
 * @param {string} holdApiData.est - Establishment ID.
 * @param {string} holdApiData.lng - Language code.
 * @param {number} holdApiData.covers - Number of covers.
 * @param {string} holdApiData.date - Date of booking (YYYY-MM-DD).
 * @param {number} holdApiData.time - Time of booking (decimal format).
 * @param {string|null} holdApiData.area - Area UID, or null if not applicable.
 * @param {string} holdApiData.addons - Comma-separated string of selected addons.
 * @returns {Promise<object|null>} A promise that resolves to the hold API response, or null/throws error.
 */
export async function holdBooking(holdApiData) {
    const holdUrl = `https://nz.eveve.com/restaurants/${holdApiData.est}/books`;

    const bodyData = {
        lng: holdApiData.lng,
        covers: holdApiData.covers,
        date: holdApiData.date,
        time: holdApiData.time,
        area: holdApiData.area, // Will be null if not provided, which is fine for JSON
        addons: holdApiData.addons
    };

    console.log("API Service - Hold API URL being called (POST):", holdUrl);
    console.log("API Service - Hold API Body being sent:", bodyData);

    try {
        const response = await fetch(holdUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = await response.text(); // Fallback to text if JSON parsing fails
            }
            console.error('API Service - Hold API Error Response Data:', { status: response.status, data: errorData });
            const err = new Error(`Hold API HTTP error! status: ${response.status}. Body: ${JSON.stringify(errorData)}`);
            err.status = response.status;
            err.data = errorData;
            throw err;
        }
        const responseData = await response.json(); // Assuming the hold API returns JSON
        console.log('API Service - Hold API Response Data:', responseData);

        // TODO: Based on typical API behavior, check if responseData indicates success or a business logic error
        // For example, if responseData.status === 'error' or responseData.booked === false
        // if (responseData.status && responseData.status !== 'success') { // Example check
        //     console.warn('API Service - Hold API returned a non-success status:', responseData);
        //     const appError = new Error(responseData.message || 'Hold unsuccessful due to business logic.');
        //     appError.data = responseData; // Attach full response
        //     throw appError;
        // }

        return responseData; // Return the data from the hold API
    } catch (error) {
        console.error('API Service - Error in holdBooking:', error.message);
        // Re-throw the error for the caller to handle, potentially showing UI messages.
        // This ensures that both network errors and API-specific errors are propagated.
        throw error;
    }
}
