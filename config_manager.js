// --- Configuration Manager ---

// --- Private module-scoped variables ---
let config = {};
let languageStrings = {};
let initialShiftsConfig = [];
let eventsBConfig = []; // For 'eventsB'
let eventMessagesConfig = {}; // For 'eventMessages'
let showEventsFeatureFlag = false; // For 'showEvents'
let processedUsrLang = 'en'; // Default language, will be updated
let currentEstName = '';
let configLoaded = false;
let configLoadError = null;

// --- Utility Functions (moved from form_logic.js or made local) ---
function getQueryParam(paramName) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(paramName);
}

function parseJsObjectString(jsString) {
    if (!jsString || typeof jsString !== 'string') {
        // console.warn('Invalid input for parseJsObjectString:', jsString); // Kept for debugging if needed
        return null;
    }
    try {
        return new Function('return ' + jsString)();
    } catch (e) {
        console.error('Error parsing JavaScript object string in config_manager:', e, 'String was:', jsString);
        return null;
    }
}

// --- Core Configuration Loading Logic (moved from form_logic.js) ---
async function loadConfig() {
    currentEstName = getQueryParam('est');
    if (!currentEstName) {
        const errorMsg = 'Restaurant ID (est) missing from URL.';
        console.error(errorMsg);
        configLoadError = new Error(errorMsg);
        configLoaded = false; // Ensure this is set
        throw configLoadError;
    }

    const localApiUrl = `/api/get-config?est=${currentEstName}`;
    try {
        const response = await fetch(localApiUrl);
        if (!response.ok) {
            let errorDetails = await response.text();
            try { errorDetails = JSON.parse(errorDetails); } catch (e) { /* Keep as text */ }
            const errorMsg = `Failed to load config: ${response.statusText}. Details: ${JSON.stringify(errorDetails)}`;
            console.error('Failed to load config from server in config_manager:', response.status, errorDetails);
            configLoadError = new Error(errorMsg);
            configLoaded = false; // Ensure this is set
            throw configLoadError;
        }
        const fetchedConfig = await response.json();
        config = fetchedConfig;

        // Parse language strings and initial shifts config immediately after fetching
        languageStrings = parseJsObjectString(config.lng) || {};
        // Provide default fallbacks for language strings directly here
        if (!languageStrings.availableAddonsTitle) languageStrings.availableAddonsTitle = 'Available Addons:';
        if (!languageStrings.noAddonsAvailable) languageStrings.noAddonsAvailable = 'No addons available for this selection.';
        if (!languageStrings.noAddonsForGuestCount) languageStrings.noAddonsForGuestCount = 'No addons currently available for the selected number of guests.';
        if (!languageStrings.noAddonsAvailableTime) languageStrings.noAddonsAvailableTime = 'No addons available for this time.';
        if (!languageStrings.anyAreaText) languageStrings.anyAreaText = "Any Area";
        if (!languageStrings.noAreasAvailable) languageStrings.noAreasAvailable = "No specific areas available for this date/time.";
        if (!languageStrings.selectAreaPrompt) languageStrings.selectAreaPrompt = "Please select an area first.";
        if (!languageStrings.loadingTimes) languageStrings.loadingTimes = "Loading times...";
        if (!languageStrings.noTimesForArea) languageStrings.noTimesForArea = "This area is not available at this time. Please choose another area.";
        if (!languageStrings.notAvailableText) languageStrings.notAvailableText = "Not Available";
        if (!languageStrings.errorGeneric) languageStrings.errorGeneric = "An error occurred. Please try again.";
        if (!languageStrings.noAreasDefined) languageStrings.noAreasDefined = "No areas are defined for selection.";
        if (!languageStrings.promptSelection) languageStrings.promptSelection = 'Please select date and guests for times.';
        if (!languageStrings.errorConfigMissing) languageStrings.errorConfigMissing = 'Restaurant config missing.';
        if (!languageStrings.errorCriticalInit) languageStrings.errorCriticalInit = 'Could not initialize booking form. Please try refreshing the page or contact support.';
        if (!languageStrings.errorLoadingTimes) languageStrings.errorLoadingTimes = 'Could not load times. Please try again.';
        if (!languageStrings.anyAreaSelectedText) languageStrings.anyAreaSelectedText = "Any"; // Added from form_logic's updateSelectedAreaDisplay
        if (!languageStrings.noTimesAvailable) languageStrings.noTimesAvailable = 'No time slots available.'; // Added from form_logic's displayTimeSlots

        initialShiftsConfig = parseJsObjectString(config.allShifts) || [];

        // Parse event-related configurations
        // Assuming config.showEvents is a string like "true" or "false" from the extracted JS
        const showEventsStr = typeof config.showEvents === 'string' ? config.showEvents.toLowerCase() : '';
        showEventsFeatureFlag = showEventsStr === 'true' || showEventsStr === '1';

        eventsBConfig = parseJsObjectString(config.eventsB) || [];
        eventMessagesConfig = parseJsObjectString(config.eventMessages) || {};

        // Process usrLang
        let rawUsrLang = config.usrLang;
        if (typeof rawUsrLang === 'string') {
            try {
                // Attempt to parse it as a JS string literal (e.g., "'en'" -> "en")
                let parsed = parseJsObjectString(rawUsrLang);
                if (typeof parsed === 'string' && /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(parsed)) {
                    processedUsrLang = parsed;
                } else if (rawUsrLang.length <= 5 && /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(rawUsrLang.replace(/['"]/g, ''))) {
                    // If it was a simple string like "en" (without extra quotes from JS)
                    // or "'en'" and parseJsObjectString failed but simple replace works
                    processedUsrLang = rawUsrLang.replace(/['"]/g, '');
                } else {
                    console.warn(`Parsed usrLang ('${parsed}' from raw '${rawUsrLang}') is not a typical lang code, defaulting to 'en'.`);
                    processedUsrLang = 'en';
                }
            } catch (e) {
                console.warn(`Error parsing usrLang ('${rawUsrLang}'), defaulting to 'en'.`, e);
                processedUsrLang = 'en';
            }
        } else {
            // If config.usrLang is not present or not a string, default to 'en'
            processedUsrLang = 'en';
        }

        configLoaded = true;
        configLoadError = null; // Clear any previous error
        // console.log('Configuration loaded and parsed successfully in config_manager.'); // For debugging
        return config;
    } catch (error) {
        console.error('Error in loadConfig (config_manager):', error);
        configLoadError = error; // Store the error object
        configLoaded = false;
        // Ensure internal state reflects the failure
        config = {};
        languageStrings = {}; // Reset to default empty or provide minimal fallbacks if necessary
        initialShiftsConfig = [];
        eventsBConfig = [];
        eventMessagesConfig = {};
        showEventsFeatureFlag = false;
        throw error; // Re-throw to allow calling code to handle it
    }
}

// --- Public API for the Config Manager ---

// Exported function to initiate loading and get the config.
// This also makes sure that config loading is attempted when the module is initialized.
const configPromise = loadConfig().catch(err => {
    // The error is already logged by loadConfig.
    // This catch is to prevent unhandled promise rejection at the module level.
    // The error state is managed by configLoaded and configLoadError.
    // console.warn("Initial config load failed. Subsequent calls to getConfig will use stored error state."); // For debugging
    return null; // Or return a specific error object / status
});


export function getConfig() {
    if (configLoadError) {
        // console.warn("getConfig called but config failed to load. Returning empty object or error info."); // For debugging
        // Optionally, could return a more specific error indicator or the error object itself
        return { error: configLoadError.message, details: configLoadError };
    }
    if (!configLoaded) {
        // console.warn("getConfig called before config has finished loading. Returning potentially empty object."); // For debugging
        // This case should ideally be handled by awaiting configPromise if called very early.
    }
    return config;
}

export function getLanguageStrings() {
    if (configLoadError) return { errorGeneric: "Configuration error. Please try again." }; // Minimal fallback
    return languageStrings;
}

export function getInitialShiftsConfig() {
    if (configLoadError) return [];
    return initialShiftsConfig;
}

export function getEventsB() {
    if (configLoadError) return []; // Return empty array on error
    return eventsBConfig;
}

export function getEventMessages() {
    if (configLoadError) return {}; // Return empty object on error
    return eventMessagesConfig;
}

export function getShowEventsFlag() {
    if (configLoadError) return false; // Default to false on error
    return showEventsFeatureFlag;
}

export function getProcessedUsrLang() {
    if (configLoadError) return 'en'; // Default to 'en' on error
    return processedUsrLang;
}

export function getCurrentEstName() {
    // currentEstName is determined before the fetch attempt, so it might be available even if loading fails.
    return currentEstName;
}

export function isConfigLoaded() {
    return configLoaded;
}

export function getConfigLoadError() {
    return configLoadError;
}

// Expose the promise itself if parts of the application need to wait for config load explicitly
export { configPromise as ensureConfigLoaded };

// Note: The original `loadConfigFromServer` was renamed to `loadConfig` and is called
// immediately when the module is loaded to populate the internal variables.
// The exported functions then access these populated variables.
