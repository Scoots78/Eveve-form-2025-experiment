// --- Event Handlers ---

import { getConfig, getLanguageStrings } from './config_manager.js';
import { fetchAvailableTimes, holdBooking } from './api_service.js';
import {
    setCurrentShiftUsagePolicy,
    setCurrentSelectedAreaUID,
    setCurrentAvailabilityData,
    setIsInitialRenderCycle,
    setCurrentSelectedDecimalTime,
    getSelectedAddons, setSelectedAddons,
    resetSelectedAddons as resetStateAddons, // Renamed to avoid conflict
    getCurrentAvailabilityData,
    getCurrentSelectedAreaUID,
    getCurrentSelectedDecimalTime,
    getIsInitialRenderCycle
} from './state_manager.js';
import {
    displayTimeSlots,
    renderAddons,
    updateAddonsDisplayUI,
    updateNextBtnUI,
    updateAreaDisplayUI,
    updateDailyRotaMessage,
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    resetTimeRelatedUI,
    _setResetAddonsUICallback, // To link addon UI reset
    updateAllUsage2ButtonStatesUI
} from './ui_manager.js';
import { formatSelectedAddonsForApi } from './dom_utils.js'; // formatTime is used by ui_manager

// --- Helper Functions (some might remain, some might be specific to handlers) ---
function getTodayDateString() { // This is used by handleDateOrCoversChange
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTotalUsage2AddonQuantity() { // Used by updateNextBtnUI, which is called by handlers
    let total = 0;
    const currentAddons = getSelectedAddons();
    if (currentAddons && currentAddons.usage2) {
        currentAddons.usage2.forEach(addon => {
            total += addon.quantity;
        });
    }
    return total;
}


// --- Addon Selection Handlers ---
// These are called by the delegated event listener for addons
function handleAddonUsage1Selection(eventTarget, addonData, isSingleCheckboxMode) {
    let currentAddons = getSelectedAddons();
    if (isSingleCheckboxMode) {
        if (eventTarget.checked) {
            currentAddons.usage1 = { ...addonData };
        } else {
            currentAddons.usage1 = null;
        }
    } else { // Radio button logic
        currentAddons.usage1 = { ...addonData };
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
}

function handleAddonUsage2Selection(addonData, quantity) {
    // This function is called by handleUsage2ButtonClick, not directly by an event on an input
    const addonUid = addonData.uid;
    let currentAddons = getSelectedAddons();
    currentAddons.usage2 = currentAddons.usage2.filter(a => a.uid !== addonUid);
    if (quantity > 0) {
        currentAddons.usage2.push({ ...addonData, quantity });
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
    // updateAllUsage2ButtonStatesUI needs guestCount, which might need to be fetched or passed
    const coversSelectorEl = document.getElementById('coversSelector');
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) : 0;
    updateAllUsage2ButtonStatesUI(guestCount);
}

function handleAddonUsage3Selection(eventTarget, addonData) {
    let currentAddons = getSelectedAddons();
    const addonUid = addonData.uid;
    if (eventTarget.checked) {
        if (!currentAddons.usage3.some(a => a.uid === addonUid)) {
            currentAddons.usage3.push({ ...addonData });
        }
    } else {
        currentAddons.usage3 = currentAddons.usage3.filter(addon => addon.uid !== addonUid);
    }
    setSelectedAddons(currentAddons);
    updateAddonsDisplayUI();
    updateNextBtnUI();
}

// Helper for Usage 2 button clicks, now calls the main handler
function handleUsage2ButtonClick(event, addonDataset, change) {
    const targetButton = event.currentTarget;
    const qtyInput = targetButton.closest('.addon-quantity-selector').querySelector('.qty-input');
    let currentValue = parseInt(qtyInput.value);
    const coversSelectorEl = document.getElementById('coversSelector');
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) : 0;

    // Calculate total quantity of usage2 addons BEFORE making a change to the current item
    let totalUsage2QuantityBeforeChange = 0;
    getSelectedAddons().usage2.forEach(addon => {
        if (addon.uid !== addonDataset.uid) { // Exclude current item if it's already in the list
            totalUsage2QuantityBeforeChange += addon.quantity;
        } else { // If it is the current item, use its value before change
            totalUsage2QuantityBeforeChange += currentValue;
        }
    });
     // If we are decrementing, the total quantity effectively decreases by 1 for the check
    if (change === -1 && currentValue > 0) {
         totalUsage2QuantityBeforeChange -=1;
    }


    if (change === -1 && currentValue > 0) {
        currentValue--;
    } else if (change === 1) {
        // Allow increment if current total + 1 (for this item) <= guestCount
        if (guestCount === 0 || (totalUsage2QuantityBeforeChange + (currentValue + 1 - currentValue) <= guestCount)) {
             currentValue++;
        } else {
            return; // Cannot add more than guestCount
        }
    } else {
        return; // No change or invalid change
    }

    qtyInput.value = currentValue;
    const fullAddonData = { // Reconstruct, ensuring all necessary fields are present
        uid: addonDataset.uid,
        name: addonDataset.name,
        price: parseFloat(addonDataset.price),
        per: addonDataset.per,
        type: addonDataset.type,
        desc: addonDataset.desc,
    };
    handleAddonUsage2Selection(fullAddonData, currentValue); // This will update state and main UI
    // updateAllUsage2ButtonStatesUI is called within handleAddonUsage2Selection now
}


// --- Main Event Handlers ---
export async function handleDateOrCoversChange() {
    const dateSelector = document.getElementById('dateSelector'); // Query directly
    const coversSelector = document.getElementById('coversSelector'); // Query directly
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');

    const previouslySelectedTimeOnEntry = getCurrentSelectedDecimalTime();
    const selectedDateStr = dateSelector.value;
    const coversValue = parseInt(coversSelector.value, 10);
    const localLanguageStrings = getLanguageStrings();
    const localCurrentEstName = getCurrentEstName();

    resetTimeRelatedUI();
    setCurrentShiftUsagePolicy(null);
    updateDailyRotaMessage('');

    if (selectedDateStr < getTodayDateString()) {
        displayErrorMessageInTimesContainer('errorDateInPast', 'Selected date is in the past. Please choose a current or future date.');
        if(selectedDateValueSpan) selectedDateValueSpan.textContent = '-';
        if(selectedCoversValueSpan) selectedCoversValueSpan.textContent = '-';
        const selectedAreaValSpan = document.getElementById('selectedAreaValue');
        if (selectedAreaValSpan) selectedAreaValSpan.textContent = '-';
        setCurrentShiftUsagePolicy(null); updateNextBtnUI();
        return;
    }

    if(selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
    if(selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversValue || '-';

    setCurrentSelectedDecimalTime(null);
    setCurrentSelectedAreaUID(null);
    updateAreaDisplayUI();
    setCurrentShiftUsagePolicy(null); updateNextBtnUI();

    if (!localCurrentEstName) {
        console.error('Restaurant Name (est) is not set. Cannot fetch times.');
        displayErrorMessageInTimesContainer('errorConfigMissing', 'Configuration error: Restaurant name not found.');
        return;
    }
    if (!selectedDateStr || isNaN(coversValue) || coversValue <= 0) {
        displayErrorMessageInTimesContainer('errorInvalidInput', 'Please select a valid date and number of guests.');
        setCurrentShiftUsagePolicy(null); updateNextBtnUI();
        return;
    }

    showLoadingTimes();

    try {
        const availabilityData = await fetchAvailableTimes(localCurrentEstName, selectedDateStr, coversValue);
        setCurrentAvailabilityData(availabilityData);
        setIsInitialRenderCycle(true);

        const currentAvailData = getCurrentAvailabilityData();
        updateDailyRotaMessage(currentAvailData ? currentAvailData.message : '');

        if (currentAvailData) {
            displayTimeSlots(currentAvailData, previouslySelectedTimeOnEntry);
            // Addon listeners are handled by delegation now or re-attached after render in main init
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
    setIsInitialRenderCycle(false);
    // setCurrentSelectedAreaUID is done by the delegated listener for area radios
    updateAreaDisplayUI();

    showLoadingTimes();
    resetTimeRelatedUI();

    const currentAvailData = getCurrentAvailabilityData();
    if (currentAvailData) {
        displayTimeSlots(currentAvailData);
        // Addon listeners handled by delegation or re-attached after render
    } else {
        console.warn("handleAreaChange called but currentAvailabilityData from state is null.");
        displayErrorMessageInTimesContainer('errorLoadingTimes', 'Data not loaded. Please select date/covers again.');
    }
}

export async function handleNextButtonClick() {
    const localConfig = getConfig();
    const localCurrentEstName = getCurrentEstName();
    const coversSelector = document.getElementById('coversSelector'); // Query
    const dateSelector = document.getElementById('dateSelector'); // Query

    const est = localCurrentEstName;
    const language = (localConfig && localConfig.usrLang) ? localConfig.usrLang.replace(/['"]/g, '') : 'en';
    const numCovers = coversSelector ? coversSelector.value : null;
    const selectedDate = dateSelector ? dateSelector.value : null;
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
            // window.location.href = holdResponse.url; // Actual navigation
        } else if (holdResponse && holdResponse.error) {
            alert(`Booking failed: ${holdResponse.error.message || 'Unknown error'}`);
        } else { /* alert('Booking processed, but no specific next step provided by API.'); */ }
    } catch (error) {
        console.error("Event Handlers - Error during holdBooking call:", error);
        const localLanguageStrings = getLanguageStrings();
        alert(localLanguageStrings.errorGeneric || "An error occurred while trying to complete your booking. Please try again.");
    }
}

// Delegated event listener for time slots
function timeSlotDelegatedListener(event) {
    const button = event.target.closest('.time-slot-button.time-slot-available');
    if (button && !button.disabled) {
        const timeSelectorContainer = document.getElementById('timeSelectorContainer');
        if (timeSelectorContainer) {
            timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
        }
        button.classList.add('time-slot-button-selected');

        const timeValue = parseFloat(button.dataset.time);
        // Shift object might not be easily available here without more complex data storage on element or lookup.
        // For now, ui_manager's handleTimeSlotButtonClick expects shiftObject.
        // This needs ui_manager.createTimeSlotButton to store necessary shift info (like addons, usage policy) on the button's dataset.
        // Let's assume shift UID is stored, and we can find it in currentAvailabilityData.shifts
        const shiftUid = button.dataset.shiftUid; // Assuming this is set by createTimeSlotButton
        const availabilityData = getCurrentAvailabilityData();
        const shiftObject = availabilityData?.shifts?.find(s => s.uid.toString() === shiftUid);

        if (shiftObject) {
            // Logic from ui_manager.handleTimeSlotButtonClick
            const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = formatTime(timeValue); // formatTime from dom_utils

            setCurrentSelectedDecimalTime(timeValue);
            setCurrentShiftUsagePolicy((shiftObject && typeof shiftObject.usage !== 'undefined') ? shiftObject.usage : null);

            resetStateAddons(); // Data part
            _setResetAddonsUICallback(() => { // UI part via callback to form_logic's version
                const addonsDisplayArea = document.getElementById('addonsDisplayArea');
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';
                const selectedAddonsValueSpan = document.getElementById('selectedAddonsValue');
                if (selectedAddonsValueSpan) selectedAddonsValueSpan.textContent = '-';
                const coversSelectorEl = document.getElementById('coversSelector');
                const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) : 0;
                updateAllUsage2ButtonStatesUI(guestCount);
            })(); // Immediately invoke for now, or ensure it's called right

            const coversSelector = document.getElementById('coversSelector');
            const guestCount = parseInt(coversSelector.value);
            const addonsDisplayArea = document.getElementById('addonsDisplayArea');

            if (shiftObject.addons && Array.isArray(shiftObject.addons) && shiftObject.addons.length > 0) {
                renderAddons(shiftObject.addons, shiftObject.usage, guestCount, shiftObject.name);
            } else {
                const lang = getLanguageStrings();
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = `<p>${lang.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
            }
            updateNextBtnUI();

        } else {
            console.warn("Shift object not found for time slot button.");
        }
    }
}

// Delegated event listener for addons
function addonsDelegatedListener(event) {
    const target = event.target;

    // Usage 1: Single checkbox or radio buttons
    if (target.matches('.addon-checkbox.usage1-checkbox, .addon-radio.usage1-radio-btn')) {
        const addonData = {
            uid: target.dataset.addonUid, name: target.dataset.addonName,
            price: target.dataset.addonPrice, desc: target.dataset.addonDesc,
            per: target.dataset.addonPer, type: target.dataset.addonType
        };
        const isSingleCheckboxMode = target.closest('.addonsDisplayArea').querySelectorAll('.addon-checkbox.usage1-checkbox').length === 1 &&
                                   target.closest('.addonsDisplayArea').querySelectorAll('.addon-radio.usage1-radio-btn').length === 0;
        handleAddonUsage1Selection(target, addonData, isSingleCheckboxMode);
        return;
    }

    // Usage 2: Plus/Minus buttons
    if (target.matches('.qty-btn.minus-btn') || target.matches('.qty-btn.plus-btn')) {
        const qtyInput = target.closest('.addon-quantity-selector').querySelector('.qty-input');
        const addonDataset = qtyInput.dataset; // All data-* attributes
        const change = target.matches('.minus-btn') ? -1 : 1;

        // Reconstruct addonData needed by handleUsage2ButtonClick
        const parentItem = target.closest('.addon-item.usage2-item');
        const nameEl = parentItem?.querySelector('.addon-name');
        const priceEl = parentItem?.querySelector('.addon-price'); // This might be complex
        const descEl = parentItem?.querySelector('.addon-desc');

        const addonDataForHandler = {
            uid: addonDataset.addonUid,
            name: nameEl?.textContent || 'Unknown Addon', // Fallback
            price: priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) * 100 : parseFloat(addonDataset.addonPrice || 0), // Example extraction
            per: addonDataset.addonPer || 'Guest', // Fallback
            type: addonDataset.addonType || 'Type2', // Fallback
            desc: descEl?.textContent || '' // Fallback
        };
        handleUsage2ButtonClick(event, addonDataForHandler, change);
        return;
    }

    // Usage 3: Checkboxes (multiple)
    if (target.matches('.addon-checkbox.usage3-checkbox')) {
        const addonData = {
            uid: target.dataset.addonUid, name: target.dataset.addonName,
            price: target.dataset.addonPrice, desc: target.dataset.addonDesc,
            per: target.dataset.addonPer, type: target.dataset.addonType
        };
        handleAddonUsage3Selection(target, addonData);
        return;
    }
}


export function initializeEventHandlers() {
    const dateSelector = document.getElementById('dateSelector');
    const coversSelector = document.getElementById('coversSelector');
    const areaRadioGroupContainer = document.getElementById('areaRadioGroupContainer');
    const nextButton = document.getElementById('nextButton');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const addonsDisplayArea = document.getElementById('addonsDisplayArea');

    if (dateSelector) dateSelector.addEventListener('change', handleDateOrCoversChange);
    if (coversSelector) coversSelector.addEventListener('change', handleDateOrCoversChange);

    // Delegated listener for area changes
    if (areaRadioGroupContainer) {
        areaRadioGroupContainer.addEventListener('change', (event) => {
            if (event.target.name === 'areaSelection') {
                setCurrentSelectedAreaUID(event.target.value); // Update state first
                handleAreaChange(); // Then call handler
            }
        });
    }

    if (nextButton) nextButton.addEventListener('click', handleNextButtonClick);

    // Delegated listeners
    if (timeSelectorContainer) {
        timeSelectorContainer.addEventListener('click', timeSlotDelegatedListener);
    }
    if (addonsDisplayArea) {
        addonsDisplayArea.addEventListener('click', addonsDelegatedListener); // General click for buttons
        addonsDisplayArea.addEventListener('change', addonsDelegatedListener); // For checkboxes/radios
    }
}
