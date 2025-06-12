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
    getSelectedAddons, setSelectedAddons, resetSelectedAddons as resetStateAddons
} from './state_manager.js';
import {
    updateSelectedAddonsDisplay as updateAddonsDisplayUI,
    updateNextButtonState as updateNextBtnUI,
    updateSelectedAreaDisplay, // Changed: Direct import
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    _setResetAddonsUICallback,
    updateAllUsage2ButtonStatesUI,
    initializeOriginalLabelText
} from './ui_manager.js';
import { initializeEventHandlers, handleDateOrCoversChange, toggleTimeSelectionVisibility } from './event_handlers.js';

window.handleCoversChangeGlobal = handleDateOrCoversChange;

document.addEventListener('DOMContentLoaded', async () => {
    const restaurantNameSpan = document.getElementById('restaurantName');
    const coversDisplay = document.getElementById('covers-display');
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const areaSelectorContainer = document.getElementById('areaSelectorContainer');
    const timeSelectionLabel = document.getElementById('timeSelectionLabel');

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    try {
        await ensureConfigLoaded;

        if (!isConfigLoaded()) {
            const error = getConfigLoadError();
            console.error('Critical error: Configuration could not be loaded.', error ? error.message : "Unknown error");
            const criticalErrorMsg = getConfigLoadError()?.message.includes("Restaurant ID (est) missing")
                ? "Error: Restaurant ID (est) missing from URL."
                : "Could not initialize booking form. Please try refreshing or check the URL.";

            const timeSelCont = document.getElementById('timeSelectorContainer');
            if (timeSelCont) timeSelCont.innerHTML = `<p class="error-message">${criticalErrorMsg}</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Configuration Error';

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

        // Initial area display update:
        // If area selection is not active, or no default is set by displayTimeSlots later, this ensures it's '-'
        // If displayTimeSlots *does* set a default and calls updateSelectedAreaDisplay, this will be overridden.
        // The most reliable way is to let displayTimeSlots (if called) handle the initial text based on populated radios.
        // For now, setting to null/'-' ensures it's cleared if not otherwise set.
        updateSelectedAreaDisplay(null);


        const partyMin = parseInt(localConfig.partyMin) || 1;
        const partyMax = parseInt(localConfig.partyMax) || 10;
        if (coversDisplay) {
            coversDisplay.dataset.min = partyMin;
            coversDisplay.dataset.max = partyMax;
            if (selectedCoversValueSpan) {
                selectedCoversValueSpan.textContent = coversDisplay.value === "0" ? "-" : coversDisplay.value;
            }
        } else {
            console.error("Covers display element (#covers-display) not found!");
        }

        if (timeSelectionLabel) {
            initializeOriginalLabelText();
        }

        _setResetAddonsUICallback(() => {
            resetStateAddons();
            updateAddonsDisplayUI();
            const currentCoversDisplay = document.getElementById('covers-display');
            const guestCount = currentCoversDisplay ? parseInt(currentCoversDisplay.value) || 0 : 0;
            updateAllUsage2ButtonStatesUI(guestCount);
        });

        initializeEventHandlers();

        const calendarTopBar = document.getElementById('calendar-top-bar');
        const initialSelectedDate = calendarTopBar ? calendarTopBar.dataset.selectedDate : null;
        const initialCovers = coversDisplay ? coversDisplay.value : '0';

        toggleTimeSelectionVisibility(initialCovers);

        if (localCurrentEstName && initialSelectedDate && coversDisplay && parseInt(initialCovers) > 0) {
            if (initialSelectedDate >= getTodayDateString()) {
                showLoadingTimes();
                await window.handleCoversChangeGlobal(); // This will call displayTimeSlots, which now also updates area display based on its logic
            } else {
                displayErrorMessageInTimesContainer('errorDateInPastInitial', 'Initial date is in the past. Please select a valid date.');
                if (selectedDateValueSpan && initialSelectedDate) selectedDateValueSpan.textContent = initialSelectedDate;
                if (selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value;
                setCurrentShiftUsagePolicy(null); updateNextBtnUI();
            }
        } else {
            let promptMessage = localLanguageStrings.promptSelection || 'Please select date and guests for times.';
            if (!localCurrentEstName) {
                promptMessage = localLanguageStrings.errorConfigMissing || 'Restaurant config missing.';
            } else if (!initialSelectedDate) {
                promptMessage = localLanguageStrings.errorDateMissing || 'Please select a date.';
            } else if (!coversDisplay || parseInt(initialCovers) === 0) {
                promptMessage = localLanguageStrings.errorCoversMissing || 'Please select number of guests.';
            }

            if(selectedDateValueSpan) selectedDateValueSpan.textContent = initialSelectedDate || '-';
            if(selectedCoversValueSpan) selectedCoversValueSpan.textContent = (initialCovers === "0" || initialCovers === "") ? "-" : initialCovers;

            // If not fetching times (e.g. covers is 0), ensure time selection section doesn't show loading.
            // displayTimeSlots is not called, so no "no times" message will be in timeSelectorContainer yet
            // unless toggleTimeSelectionVisibility -> resetTimeRelatedUI -> displayTimeSlots (with no data) puts one there.
            // For covers = 0, time-selection-section is hidden.
            // If covers > 0 but date is missing, handleCoversChangeGlobal won't be called.
            if (parseInt(initialCovers) > 0 && !initialSelectedDate) { // e.g. covers set, but no date from flatpickr yet
                 displayErrorMessageInTimesContainer('errorDateMissing', promptMessage);
            } else if (parseInt(initialCovers) === 0) {
                // Time section is hidden, no message needed there.
                // The main prompt for user is to select date/covers.
            }
        }
        updateNextBtnUI();

    } catch (error) {
        console.error('Critical error during form initialization (outer try-catch):', error);
        let langStringsForError = getLanguageStrings();
        if (!langStringsForError || Object.keys(langStringsForError).length === 0 || !langStringsForError.errorCriticalInit) {
             langStringsForError = { errorCriticalInit: 'Could not initialize booking form. Please try refreshing the page or contact support.'};
        }
        const formContainer = document.querySelector('.form-container');
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
