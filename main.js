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
    updateAddonsDisplayUI,
    updateNextBtnUI, // Still needed for initial setup
    updateAreaDisplayUI,
    // Loading/Error states in UI
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    // Callback setter
    _setResetAddonsUICallback,
    updateAllUsage2ButtonStatesUI
} from './ui_manager.js';
import { initializeEventHandlers, handleDateOrCoversChange } from './event_handlers.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements needed for initial setup ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    const dateSelector = document.getElementById('dateSelector');
    const coversSelector = document.getElementById('coversSelector');
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
        await ensureConfigLoaded();

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

        if (dateSelector) {
            const todayStrForMin = getTodayDateString();
            dateSelector.min = todayStrForMin;
            dateSelector.value = todayStrForMin;
            if (selectedDateValueSpan) selectedDateValueSpan.textContent = todayStrForMin;
        } else { console.error("Date selector element not found!"); }

        const partyMin = parseInt(localConfig.partyMin) || 1;
        const partyMax = parseInt(localConfig.partyMax) || 10;
        if (coversSelector) {
            coversSelector.min = partyMin;
            coversSelector.max = partyMax;
            coversSelector.value = partyMin;
            if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
        } else { console.error("Covers selector element not found!"); }

        // Setup the callback for UI Manager to reset addon UI
        _setResetAddonsUICallback(() => {
            resetStateAddons();
            updateAddonsDisplayUI();
            const coversSel = document.getElementById('coversSelector'); // Direct query
            const guestCount = coversSel ? parseInt(coversSel.value) || 0 : 0;
            updateAllUsage2ButtonStatesUI(guestCount);
        });

        initializeEventHandlers(); // Attach all event listeners

        // Initial data load and UI render
        if (localCurrentEstName && dateSelector.value && parseInt(coversSelector.value) > 0) {
            if (dateSelector.value >= getTodayDateString()) {
                showLoadingTimes();
                // Directly call the event handler to perform initial load.
                // This ensures consistent behavior with user-initiated changes.
                await handleDateOrCoversChange();
            } else {
                displayErrorMessageInTimesContainer('errorDateInPastInitial', 'Initial date is in the past. Please select a valid date.');
                if(selectedDateValueSpan) selectedDateValueSpan.textContent = dateSelector.value;
                if(selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
                setCurrentShiftUsagePolicy(null); updateNextBtnUI();
            }
        } else {
            let promptMessage = localLanguageStrings.promptSelection || 'Please select date and guests for times.';
            if (!localCurrentEstName) {
                promptMessage = localLanguageStrings.errorConfigMissing || 'Restaurant config missing.';
            }
            displayErrorMessageInTimesContainer('promptSelectionInitial', promptMessage);
        }
        updateNextBtnUI(); // Final check for button state

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
