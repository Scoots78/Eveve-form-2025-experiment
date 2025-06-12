// Version: 20240507-140000
import {
    getConfig,
    getLanguageStrings,
    getInitialShiftsConfig,
    getCurrentEstName,
    isConfigLoaded,
    getConfigLoadError,
    ensureConfigLoaded
} from './config_manager.js';
import { fetchAvailableTimes, holdBooking } from './api_service.js';
import { getSelectedRadioValue, formatTime, formatSelectedAddonsForApi } from './dom_utils.js';
import {
    getCurrentShiftUsagePolicy, setCurrentShiftUsagePolicy,
    getCurrentSelectedAreaUID, setCurrentSelectedAreaUID,
    getCurrentAvailabilityData, setCurrentAvailabilityData,
    getIsInitialRenderCycle, setIsInitialRenderCycle,
    getCurrentSelectedDecimalTime, setCurrentSelectedDecimalTime,
    getSelectedAddons, setSelectedAddons, resetSelectedAddons as resetStateAddons,
    // getShowUnavailableSlots, setShowUnavailableSlots // No longer needed directly in main
} from './state_manager.js';
import {
    // Main UI Orchestration (though displayTimeSlots will be called by event handler)
    // renderAddons, // Likely called by other UI functions or event handlers now
    // UI Updaters
    updateSelectedAddonsDisplay as updateAddonsDisplayUI,
    updateNextButtonState as updateNextBtnUI, // Still needed for initial setup
    updateSelectedAreaDisplay as updateAreaDisplayUI,
    // Loading/Error states in UI
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    // Callback setter
    _setResetAddonsUICallback,
    updateAllUsage2ButtonStatesUI // This one is exported with UI suffix from ui_manager.js
} from './ui_manager.js';
import { initializeEventHandlers, handleDateOrCoversChange, toggleTimeSelectionVisibility } from './event_handlers.js';

// Make it available globally for booking_page.js
window.handleCoversChangeGlobal = handleDateOrCoversChange;
// Make toggleTimeSelectionVisibility available to booking_page.js if it needs it (though it has a local one now)
// window.toggleTimeSelectionVisibilityGlobal = toggleTimeSelectionVisibility;

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements needed for initial setup ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    // const dateSelector = document.getElementById('dateSelector'); // Removed: Old date selector
    const coversDisplay = document.getElementById('covers-display'); // New selector
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const areaSelectorContainer = document.getElementById('areaSelectorContainer');
    // timeSelectorContainer and areaRadioGroupContainer are used by event_handlers

    // Helper function (remains for initial date setup)
    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Core Logic / Application Initialization ---
    try {
        await ensureConfigLoaded; // Corrected: Await the promise directly, don't call it.

        if (!isConfigLoaded()) {
            const error = getConfigLoadError();
            console.error('Critical error: Configuration could not be loaded.', error ? error.message : "Unknown error");
            // Display minimal error if even config (and thus language strings) failed
            const criticalErrorMsg = getConfigLoadError()?.message.includes("Restaurant ID (est) missing")
                ? "Error: Restaurant ID (est) missing from URL."
                : "Could not initialize booking form. Please try refreshing or check the URL.";

            const timeSelCont = document.getElementById('timeSelectorContainer'); // Direct query for error
            if (timeSelCont) timeSelCont.innerHTML = `<p class="error-message">${criticalErrorMsg}</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Configuration Error';

            // Fallback for very early critical error
            const formContainer = document.querySelector('.form-container');
            if (document.body && !formContainer?.querySelector('.critical-error-message')) {
                 const errorDiv = document.createElement('div');
                 errorDiv.className = 'critical-error-message';
                 errorDiv.textContent = criticalErrorMsg;
                 if (formContainer) {
                     formContainer.innerHTML = ''; formContainer.appendChild(errorDiv);
                 } else {
                     document.body.innerHTML = ''; document.body.appendChild(errorDiv);
                 }
            }
            return;
        }

        const localConfig = getConfig();
        const localLanguageStrings = getLanguageStrings();
        const localCurrentEstName = getCurrentEstName();

        // Initialize UI elements that depend on config
        if (restaurantNameSpan) {
            const displayName = localConfig.estName ? localConfig.estName.replace(/^['"](.*)['"]$/, '$1') : localCurrentEstName;
            restaurantNameSpan.textContent = displayName;
        }
        if (areaSelectorContainer) {
            areaSelectorContainer.style.display = localConfig.arSelect === "true" ? 'block' : 'none';
        }
        const areaAvailMsg = document.getElementById('areaAvailabilityMessage');
        if (areaAvailMsg && (localConfig.arSelect !== "true" || !areaSelectorContainer || areaSelectorContainer.style.display === 'none')) {
            areaAvailMsg.style.display = 'none';
        }
        updateAreaDisplayUI();

        // Old dateSelector initialization block removed.
        // Flatpickr in calendar_control.js now handles default date, minDate, and initial display.
        // selectedDateValueSpan will be updated by the initial call to handleDateOrCoversChange.
        // The console.error for "Date selector element not found!" is no longer relevant here for the old element.

        const partyMin = parseInt(localConfig.partyMin) || 1;
        const partyMax = parseInt(localConfig.partyMax) || 10;
        if (coversDisplay) {
            coversDisplay.dataset.min = partyMin;
            coversDisplay.dataset.max = partyMax;
    // The initial value of coversDisplay is now 0, set by booking_page.js
            // booking_page.js runs its DOMContentLoaded, then this main.js DOMContentLoaded runs.
            if (selectedCoversValueSpan) {
        // Reflect the initial 0 covers as '-' in the summary
        selectedCoversValueSpan.textContent = coversDisplay.value === "0" ? "-" : coversDisplay.value;
            }
        } else {
            console.error("Covers display element (#covers-display) not found!");
        }

        // Setup the callback for UI Manager to reset addon UI
        _setResetAddonsUICallback(() => {
            resetStateAddons();
            updateAddonsDisplayUI();
            const currentCoversDisplay = document.getElementById('covers-display'); // Use new ID
            const guestCount = currentCoversDisplay ? parseInt(currentCoversDisplay.value) || 0 : 0;
            updateAllUsage2ButtonStatesUI(guestCount);
        });

        initializeEventHandlers(); // Attach all event listeners

        // Initial data load and UI render
        const calendarTopBar = document.getElementById('calendar-top-bar');
        const initialSelectedDate = calendarTopBar ? calendarTopBar.dataset.selectedDate : null;
const initialCovers = coversDisplay ? coversDisplay.value : '0'; // Should be "0"

// Ensure time selection section is hidden initially if covers is 0
toggleTimeSelectionVisibility(initialCovers);

if (localCurrentEstName && initialSelectedDate && coversDisplay && parseInt(initialCovers) > 0) {
    // This block will not be entered if initialCovers is "0"
    if (initialSelectedDate >= getTodayDateString()) {
                showLoadingTimes();
        await window.handleCoversChangeGlobal();
            } else {
                displayErrorMessageInTimesContainer('errorDateInPastInitial', 'Initial date is in the past. Please select a valid date.');
                if (selectedDateValueSpan && initialSelectedDate) selectedDateValueSpan.textContent = initialSelectedDate;
        if (selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value; // Show actual covers
                setCurrentShiftUsagePolicy(null); updateNextBtnUI();
            }
        } else {
    // This block WILL be entered if initialCovers is "0"
            let promptMessage = localLanguageStrings.promptSelection || 'Please select date and guests for times.';
            if (!localCurrentEstName) {
                promptMessage = localLanguageStrings.errorConfigMissing || 'Restaurant config missing.';
            } else if (!initialSelectedDate) {
        promptMessage = localLanguageStrings.errorDateMissing || 'Please select a date.';
    } else if (!coversDisplay || parseInt(initialCovers) === 0) { // Check for 0 covers
        promptMessage = localLanguageStrings.errorCoversMissing || 'Please select number of guests.';
            }
    // Only display this prompt if the time section would have been visible (i.e., if covers > 0)
    // Or, if covers is 0, the time section is hidden, so this message might not be needed in that container.
    // However, handleDateOrCoversChange (if called with 0) might clear it.
    // For initial load with 0 covers, the time section is hidden by toggleTimeSelectionVisibility.
    // So, no specific message needs to be put into the (now hidden) time container.
    // The main page structure (date, covers input) is the prompt.

    // Update selection display to reflect current state
            if(selectedDateValueSpan) selectedDateValueSpan.textContent = initialSelectedDate || '-';
    if(selectedCoversValueSpan) selectedCoversValueSpan.textContent = (initialCovers === "0" || initialCovers === "") ? "-" : initialCovers;
        }
updateNextBtnUI(); // Final check for button state, should be disabled if covers is 0

    } catch (error) {
        console.error('Critical error during form initialization (outer try-catch):', error);
        let langStringsForError = getLanguageStrings();
        if (!langStringsForError || Object.keys(langStringsForError).length === 0 || langStringsForError.errorGeneric) {
             langStringsForError = { errorCriticalInit: 'Could not initialize booking form. Please try refreshing the page or contact support.'};
        }
    const formContainer = document.querySelector('.form-container'); // Query directly
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'critical-error-message';
            errorDiv.textContent = langStringsForError.errorCriticalInit;
            if (formContainer) {
                formContainer.innerHTML = '';
                formContainer.appendChild(errorDiv);
            } else {
                document.body.innerHTML = '';
                document.body.appendChild(errorDiv);
            }
        }
    }
});
