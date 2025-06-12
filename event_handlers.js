// --- Event Handlers ---

import { getConfig, getLanguageStrings, getCurrentEstName } from './config_manager.js';
import { fetchAvailableTimes, holdBooking } from './api_service.js';
import {
    setCurrentShiftUsagePolicy,
    setCurrentSelectedAreaUID,
    setCurrentAvailabilityData,
    setIsInitialRenderCycle,
    setCurrentSelectedDecimalTime,
    getSelectedAddons, setSelectedAddons,
    resetSelectedAddons as resetStateAddons,
    getCurrentAvailabilityData,
    getCurrentSelectedAreaUID,
    getCurrentSelectedDecimalTime,
    getCurrentSelectedShiftName,
    getIsInitialRenderCycle
} from './state_manager.js';
import {
    displayTimeSlots,
    renderAddons,
    updateSelectedAddonsDisplay as updateAddonsDisplayUI,
    updateNextButtonState as updateNextBtnUI,
    updateSelectedAreaDisplay as updateAreaDisplayUI,
    updateDailyRotaMessage,
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    resetTimeRelatedUI,
    showTimeSelectionSummary,
    showTimeSelectionAccordion
} from './ui_manager.js';
import { formatSelectedAddonsForApi, formatTime } from './dom_utils.js';

// --- Helper Functions ---
export function toggleTimeSelectionVisibility(coversValueStr) {
    const coversValue = parseInt(coversValueStr, 10);
    const timeSelectionSection = document.getElementById('time-selection-section');
    if (timeSelectionSection) {
        const isCurrentlyVisible = timeSelectionSection.style.display !== 'none';
        if (coversValue > 0 && !isCurrentlyVisible) {
            timeSelectionSection.style.display = '';
        } else if (coversValue === 0 && isCurrentlyVisible) {
            timeSelectionSection.style.display = 'none';
            resetTimeRelatedUI();
            const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
        }
    }
}

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Addon Selection Handlers ---
function handleAddonUsage1Selection(eventTarget, addonData, isSingleCheckboxMode) {
    let currentAddons = getSelectedAddons();
    if (isSingleCheckboxMode) {
        if (eventTarget.checked) {
            currentAddons.usage1 = { ...addonData };
        } else {
            currentAddons.usage1 = null;
        }
    } else {
        currentAddons.usage1 = { ...addonData };
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
}

function handleAddonUsage2Selection(addonData, quantity) {
    const addonUid = parseInt(addonData.uid, 10);
    let currentAddons = getSelectedAddons();
    currentAddons.usage2 = currentAddons.usage2.filter(a => a.uid !== addonUid);
    if (quantity > 0) {
        currentAddons.usage2.push({ ...addonData, uid: addonUid, quantity });
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
    const coversDisplayEl = document.getElementById('covers-display');
    const guestCount = coversDisplayEl ? parseInt(coversDisplayEl.value) : 0;
    updateAllUsage2ButtonStatesUI(guestCount);
}

function handleAddonUsage3Selection(eventTarget, addonData) {
    let currentAddons = getSelectedAddons();
    const addonUid = parseInt(addonData.uid, 10);
    if (eventTarget.checked) {
        if (!currentAddons.usage3.some(a => a.uid === addonUid)) {
            currentAddons.usage3.push({ ...addonData, uid: addonUid });
        }
    } else {
        currentAddons.usage3 = currentAddons.usage3.filter(addon => addon.uid !== addonUid);
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
}

function handleUsage2ButtonClick(clickedButton, addonDataset, change) {
    const targetButton = clickedButton;
    const qtyContainer = targetButton.closest('.addon-quantity-selector');
    if (!qtyContainer) return;
    const qtyInput = qtyContainer.querySelector('.qty-input');
    if (!qtyInput) return;
    let currentValue = parseInt(qtyInput.value);
    const coversDisplayEl = document.getElementById('covers-display');
    const guestCount = coversDisplayEl ? parseInt(coversDisplayEl.value) : 0;

    let totalUsage2QuantityBeforeChange = 0;
    const currentSelected = getSelectedAddons();
    currentSelected.usage2.forEach(addon => {
        if (addon.uid.toString() !== addonDataset.addonUid) {
            totalUsage2QuantityBeforeChange += addon.quantity;
        } else {
            totalUsage2QuantityBeforeChange += currentValue;
        }
    });

    if (change === -1 && currentValue > 0) { /* Allow decrement */ }
    else if (change === 1) {
        let otherItemsTotal = 0;
         currentSelected.usage2.forEach(addon => {
            if (addon.uid.toString() !== addonDataset.addonUid) otherItemsTotal += addon.quantity;
        });
        if (guestCount === 0 || (otherItemsTotal + (currentValue + 1) > guestCount) ) return;
    } else if(change === -1 && currentValue === 0) return;
    else return;

    if (change === -1) currentValue--;
    else if (change === 1) currentValue++;
    qtyInput.value = currentValue;

    const fullAddonData = {
        uid: parseInt(addonDataset.addonUid, 10), name: addonDataset.addonName,
        price: parseFloat(addonDataset.addonPrice), per: addonDataset.addonPer,
        type: addonDataset.addonType, desc: addonDataset.addonDesc,
    };
    handleAddonUsage2Selection(fullAddonData, currentValue);
}

export async function handleDateOrCoversChange() {
    const calendarTopBar = document.getElementById('calendar-top-bar');
    const selectedDateStr = calendarTopBar ? calendarTopBar.dataset.selectedDate : null;
    const coversDisplay = document.getElementById('covers-display');
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const coversValue = coversDisplay ? parseInt(coversDisplay.value, 10) : 0;

    toggleTimeSelectionVisibility(coversDisplay ? coversDisplay.value : '0');

    if (coversValue === 0) {
        if (selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
        if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = '-';
        setCurrentShiftUsagePolicy(null);
        setCurrentSelectedDecimalTime(null); // Clears time and shift name
        updateDailyRotaMessage('');
        updateNextBtnUI();
        return;
    }

    const localLanguageStrings = getLanguageStrings();
    const localCurrentEstName = getCurrentEstName();

    updateDailyRotaMessage('');
    resetTimeRelatedUI();
    setCurrentShiftUsagePolicy(null);

    if (!selectedDateStr || selectedDateStr < getTodayDateString()) {
        const messageKey = !selectedDateStr ? 'errorInvalidInput' : 'errorDateInPast';
        const defaultMessage = !selectedDateStr ? 'Please select a valid date.' : 'Selected date is in the past. Please choose a current or future date.';
        if (document.getElementById('time-selection-section').style.display !== 'none') {
            displayErrorMessageInTimesContainer(messageKey, defaultMessage);
        }
        if(selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
        if(selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value;
        const selectedAreaValSpan = document.getElementById('selectedAreaValue');
        if (selectedAreaValSpan) selectedAreaValSpan.textContent = '-';
        updateNextBtnUI();
        return;
    }

    if(selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
    if(selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value;

    setCurrentSelectedDecimalTime(null);
    setCurrentSelectedAreaUID(null);
    updateAreaDisplayUI();
    updateNextBtnUI();

    if (!localCurrentEstName) {
        console.error('Restaurant Name (est) is not set. Cannot fetch times.');
        if (document.getElementById('time-selection-section').style.display !== 'none') {
            displayErrorMessageInTimesContainer('errorConfigMissing', 'Configuration error: Restaurant name not found.');
        }
        return;
    }
    if (!selectedDateStr || isNaN(coversValue) || coversValue <= 0) {
        if (document.getElementById('time-selection-section').style.display !== 'none') {
            displayErrorMessageInTimesContainer('errorInvalidInput', 'Please select a valid date and number of guests.');
        }
        updateNextBtnUI();
        return;
    }

    if (document.getElementById('time-selection-section').style.display !== 'none') {
        showLoadingTimes();
    }

    try {
        const availabilityData = await fetchAvailableTimes(localCurrentEstName, selectedDateStr, coversValue);
        setCurrentAvailabilityData(availabilityData);
        setIsInitialRenderCycle(true);

        const currentAvailData = getCurrentAvailabilityData();
        updateDailyRotaMessage(currentAvailData ? currentAvailData.message : '');

        if (currentAvailData) {
            displayTimeSlots(currentAvailData);
        } else {
            displayErrorMessageInTimesContainer('errorLoadingTimes', 'Could not load times. Please try again.');
            setCurrentShiftUsagePolicy(null);
            updateNextBtnUI();
        }
    } catch (error) {
        console.error('Error during availability fetch/processing in handleDateOrCoversChange:', error);
        displayErrorMessageInTimesContainer('errorLoadingTimes', 'Could not load times. Please try again.');
        setCurrentShiftUsagePolicy(null);
        updateNextBtnUI();
    }
}

export async function handleAreaChange() {
    // 1. Initial setup
    const timeSelectionLabel = document.getElementById('timeSelectionLabel');
    const wasInSummaryMode = timeSelectionLabel?.classList.contains('summary-mode-active');
    const previouslySelectedTime = getCurrentSelectedDecimalTime();
    const previouslySelectedShiftName = getCurrentSelectedShiftName();
    const localLanguageStrings = getLanguageStrings();

    setIsInitialRenderCycle(false);
    updateSelectedAreaDisplay();

    // DOM elements needed for validation and API call
    const estName = getCurrentEstName();
    const calendarTopBar = document.getElementById('calendar-top-bar');
    const selectedDateStr = calendarTopBar ? calendarTopBar.dataset.selectedDate : null;
    const coversDisplay = document.getElementById('covers-display');
    const coversValue = coversDisplay ? parseInt(coversDisplay.value, 10) : 0;
    // const newAreaId = getCurrentSelectedAreaUID(); // Already set in state by the event listener calling this

    // 2. Basic validation
    if (!selectedDateStr || coversValue <= 0) {
        displayErrorMessageInTimesContainer('errorInvalidInput', localLanguageStrings.errorInvalidInput || 'Please select a date and number of guests first.');
        setCurrentSelectedDecimalTime(null);
        resetTimeRelatedUI();
        // Addons are cleared within resetTimeRelatedUI via showTimeSelectionAccordion -> resetCurrentAddonsUICallback
        updateNextBtnUI();
        return;
    }

    showLoadingTimes();

    let newAvailabilityData;
    try {
        // 3. Fetch new availability data
        newAvailabilityData = await fetchAvailableTimes(estName, selectedDateStr, coversValue);
        setCurrentAvailabilityData(newAvailabilityData);
        updateDailyRotaMessage(newAvailabilityData.message || '');

        let selectionStillValid = false;
        let selectedShiftObject = null; // Store the shift object if found

        // 4. Conditional logic
        if (wasInSummaryMode && previouslySelectedTime !== null && previouslySelectedShiftName) {
            selectedShiftObject = newAvailabilityData.shifts.find(s => s.name === previouslySelectedShiftName);
            if (selectedShiftObject && selectedShiftObject.times && selectedShiftObject.times.includes(previouslySelectedTime)) {
                const currentAreaUIDFromState = getCurrentSelectedAreaUID();
                if (getConfig().arSelect === "true" && currentAreaUIDFromState && currentAreaUIDFromState !== "any") {
                    const areaData = newAvailabilityData.areas.find(a => a.uid.toString() === currentAreaUIDFromState);
                    if (areaData && areaData.times && areaData.times.includes(previouslySelectedTime)) {
                        selectionStillValid = true;
                    }
                } else {
                    selectionStillValid = true;
                }
            }
        }

        // 5. Update UI
        if (selectionStillValid && selectedShiftObject) {
            setCurrentShiftUsagePolicy(selectedShiftObject.usage);

            const addonsDisplayArea = document.getElementById('addonsDisplayArea');
            if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';

            if (selectedShiftObject.addons && Array.isArray(selectedShiftObject.addons) && selectedShiftObject.addons.length > 0) {
                renderAddons(selectedShiftObject.addons, selectedShiftObject.usage, coversValue, selectedShiftObject.name);
            } else {
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = `<p>${localLanguageStrings.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
            }
            updateAddonsDisplayUI();

            displayTimeSlots(newAvailabilityData);
            showTimeSelectionSummary(previouslySelectedShiftName, formatTime(previouslySelectedTime));
            updateNextBtnUI();
        } else {
            setCurrentSelectedDecimalTime(null);
            resetTimeRelatedUI();
            displayTimeSlots(newAvailabilityData);
            // updateNextBtnUI(); // Called by resetTimeRelatedUI
        }

    } catch (error) {
        console.error("Error during availability fetch/processing in handleAreaChange:", error);
        setCurrentSelectedDecimalTime(null);
        resetTimeRelatedUI();
        displayErrorMessageInTimesContainer('errorLoadingTimes', error.message || localLanguageStrings.errorLoadingTimes || "Error fetching times for the selected area.");
        updateNextBtnUI();
    }
}


export async function handleNextButtonClick() {
    const localConfig = getConfig();
    const localCurrentEstName = getCurrentEstName();
    const coversDisplay = document.getElementById('covers-display');
    const calendarTopBar = document.getElementById('calendar-top-bar');
    const selectedDate = calendarTopBar ? calendarTopBar.dataset.selectedDate : null;

    const est = localCurrentEstName;
    const language = (localConfig && localConfig.usrLang) ? localConfig.usrLang.replace(/['"]/g, '') : 'en';
    const numCovers = coversDisplay ? coversDisplay.value : null;
    const timeToSubmit = getCurrentSelectedDecimalTime();
    let areaToSubmit = null;
    if (localConfig.arSelect === "true" && getCurrentSelectedAreaUID() && getCurrentSelectedAreaUID() !== "any") {
        areaToSubmit = getCurrentSelectedAreaUID();
    }
    const addonsString = formatSelectedAddonsForApi(getSelectedAddons());

    if (!selectedDate || timeToSubmit === null || !numCovers || !est) {
        console.error("Missing required data for hold call:", { selectedDate, timeToSubmit, numCovers, est, areaToSubmit, addonsString });
        return;
    }
    const holdApiData = { est, lng: language, covers: parseInt(numCovers, 10), date: selectedDate, time: timeToSubmit, area: areaToSubmit, addons: addonsString };
    console.log("Event Handlers - Hold API Call Data to be sent:", holdApiData);
    try {
        const holdResponse = await holdBooking(holdApiData);
        console.log("Event Handlers - Hold API Response:", holdResponse);
        if (holdResponse && holdResponse.url) {
            alert(`Booking successful (simulated). URL for next step: ${holdResponse.url}`);
        } else if (holdResponse && holdResponse.error) {
            alert(`Booking failed: ${holdResponse.error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error("Event Handlers - Error during holdBooking call:", error);
        const localLanguageStrings = getLanguageStrings();
        alert(localLanguageStrings.errorGeneric || "An error occurred while trying to complete your booking. Please try again.");
    }
}

function timeSlotDelegatedListener(event) {
    const button = event.target.closest('.time-slot-button.time-slot-available');
    if (button && !button.disabled) {
        const timeSelectorContainer = document.getElementById('timeSelectorContainer');
        if (timeSelectorContainer) {
            timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
        }
        button.classList.add('time-slot-button-selected');

        const timeValue = parseFloat(button.dataset.time);
        const shiftUidFromDataset = button.dataset.shiftUid;
        const shiftNameFromDataset = button.dataset.shiftName;
        const availabilityData = getCurrentAvailabilityData();
        let shiftObject = null;

        if (shiftUidFromDataset && shiftUidFromDataset !== 'undefined') {
            shiftObject = availabilityData?.shifts?.find(s => s && s.uid != null && s.uid.toString() === shiftUidFromDataset);
        }

        if (!shiftObject && shiftNameFromDataset) {
            shiftObject = availabilityData?.shifts?.find(s => s && s.name != null && String(s.name).trim() !== '' && s.name === shiftNameFromDataset);
        }

        if (shiftObject) {
            const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = formatTime(timeValue);

            setCurrentSelectedDecimalTime(timeValue, shiftObject.name);
            setCurrentShiftUsagePolicy((shiftObject && typeof shiftObject.usage !== 'undefined') ? shiftObject.usage : null);

            resetStateAddons();
            updateAddonsDisplayUI();
            const coversDisplay = document.getElementById('covers-display');
            const guestCount = parseInt(coversDisplay.value);
            updateAllUsage2ButtonStatesUI(guestCount);

            const addonsDisplayArea = document.getElementById('addonsDisplayArea');
            if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';

            if (shiftObject.addons && Array.isArray(shiftObject.addons) && shiftObject.addons.length > 0) {
                renderAddons(shiftObject.addons, shiftObject.usage, guestCount, shiftObject.name);
            } else {
                const lang = getLanguageStrings();
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = `<p>${lang.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
            }
            updateNextBtnUI();

            const formattedTime = formatTime(timeValue);
            showTimeSelectionSummary(shiftObject.name, formattedTime);

        } else {
            console.warn(`Shift object not found for time slot button. Attempted UID: ${shiftUidFromDataset}, Attempted Name: ${shiftNameFromDataset}`, button);
        }
    }
}

function addonsDelegatedListener(event) {
    const target = event.target;
    const addonDataset = target.dataset;

    if (target.matches('.addon-checkbox.usage1-checkbox, .addon-radio.usage1-radio-btn')) {
        const addonData = {
            uid: addonDataset.addonUid, name: addonDataset.addonName,
            price: addonDataset.addonPrice, desc: addonDataset.addonDesc,
            per: addonDataset.addonPer, type: addonDataset.addonType
        };
        const addonsDisplayArea = target.closest('#addonsDisplayArea');
        const isSingleCheckboxMode = addonsDisplayArea.querySelectorAll('.addon-checkbox.usage1-checkbox').length === 1 &&
                                   addonsDisplayArea.querySelectorAll('.addon-radio.usage1-radio-btn').length === 0;
        handleAddonUsage1Selection(target, addonData, isSingleCheckboxMode);
        return;
    }

    if (target.matches('.qty-btn.minus-btn') || target.matches('.qty-btn.plus-btn')) {
        const qtyInput = target.closest('.addon-quantity-selector').querySelector('.qty-input');
        const itemDataset = qtyInput.dataset;
        const change = target.matches('.minus-btn') ? -1 : 1;
        handleUsage2ButtonClick(target, itemDataset, change);
        return;
    }

    if (target.matches('.addon-checkbox.usage3-checkbox, .addon-checkbox.generic-addon-checkbox')) {
        const addonData = {
            uid: addonDataset.addonUid, name: addonDataset.addonName,
            price: addonDataset.addonPrice, desc: addonDataset.addonDesc,
            per: addonDataset.addonPer, type: addonDataset.addonType
        };
        handleAddonUsage3Selection(target, addonData);
        return;
    }
}

export function initializeEventHandlers() {
    const areaRadioGroupContainer = document.getElementById('areaRadioGroupContainer');
    const nextButton = document.getElementById('nextButton');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const addonsDisplayArea = document.getElementById('addonsDisplayArea');

    if (areaRadioGroupContainer) {
        areaRadioGroupContainer.addEventListener('change', (event) => {
            if (event.target.name === 'areaSelection') {
                setCurrentSelectedAreaUID(event.target.value);
                handleAreaChange();
            }
        });
    }

    if (nextButton) nextButton.addEventListener('click', handleNextButtonClick);

    if (timeSelectorContainer) {
        timeSelectorContainer.addEventListener('click', timeSlotDelegatedListener);
    }
    if (addonsDisplayArea) {
        addonsDisplayArea.addEventListener('change', addonsDelegatedListener);
        addonsDisplayArea.addEventListener('click', addonsDelegatedListener);
    }
}
