// --- UI Manager ---

import { getConfig, getLanguageStrings } from './config_manager.js';
import {
    getCurrentShiftUsagePolicy,
    getSelectedAddons,
    getShowUnavailableSlots,
    getCurrentSelectedAreaUID,
    setCurrentSelectedDecimalTime,
    setCurrentShiftUsagePolicy,
    getIsInitialRenderCycle,
    getCurrentSelectedDecimalTime,
    getCurrentSelectedShiftName,
    getCurrentAvailabilityData,
    getRestaurantFullNameFromHold,
    getSelectedDateForSummary,
    getSelectedCoversForSummary,
    getSelectedAreaNameForSummary,
    getSelectedAddonsForContext,  // Added
    // setCurrentSelectedAreaUID // Removed import
    getActiveEvents, // Added for events
    getSelectedEventDetails // Added for events
} from './state_manager.js';
import { getSelectedRadioValue, formatTime } from './dom_utils.js';
import { handleShiftChangeClearSelection } from './event_handlers.js'; // Added import
// import { eventsB } from './event_data.js'; // Not strictly needed if getActiveEvents returns full objects

// DOM Element Getters
const getCoversSelector = () => document.getElementById('covers-display');
const getTimeSelectorContainer = () => document.getElementById('timeSelectorContainer');
const getSelectedTimeValueSpan = () => document.getElementById('selectedTimeValue');
const getTimeSelectionLabel = () => document.getElementById('timeSelectionLabel');

// Module-level cache
let originalTimeSelectionLabelText = '';

// --- Time Selection UI Mode Toggle ---

export function initializeOriginalLabelText() {
    const labelEl = getTimeSelectionLabel();
    if (labelEl) {
        originalTimeSelectionLabelText = labelEl.innerText;
    } else {
        console.warn("Time selection label (#timeSelectionLabel) not found during init.");
    }
}

export function showTimeSelectionSummary(shiftName, timeValueFormatted) {
    const labelEl = getTimeSelectionLabel();
    const containerEl = getTimeSelectorContainer();
    const selectedEvent = getSelectedEventDetails();
    const currentShiftName = getCurrentSelectedShiftName(); // Keep for shift context

    if (containerEl) containerEl.style.display = 'none';
    if (labelEl) {
        let summaryText = '';
        if (selectedEvent && selectedEvent.name && timeValueFormatted) {
            // If an event is selected, prioritize its name for the summary label
            summaryText = `${selectedEvent.name} at ${timeValueFormatted}`;
        } else if (shiftName && timeValueFormatted) { // Use original shiftName passed to function
            summaryText = `${shiftName} at ${timeValueFormatted}`;
        } else {
            // Fallback or error state - should not happen if time is selected
            summaryText = originalTimeSelectionLabelText;
            labelEl.classList.remove('summary-mode-active');
            console.warn("showTimeSelectionSummary called without enough details.", {selectedEvent, shiftName, timeValueFormatted});
            labelEl.innerText = summaryText;
            return; // Don't add click listener if not in summary mode
        }
        labelEl.innerText = summaryText;
        labelEl.classList.add('summary-mode-active');
        labelEl.addEventListener('click', handleSummaryLabelClick, { once: true });
    }
}

function handleSummaryLabelClick() {
    showTimeSelectionAccordion();
    const selectedEvent = getSelectedEventDetails();
    const currentAvailData = getCurrentAvailabilityData(); // For shifts
    const activeEvents = getActiveEvents(); // For events

    // Determine if we need to re-render based on either shifts or events being present
    // and a time previously selected (either shift or event)
    const timeIsSelected = getCurrentSelectedDecimalTime() !== null || (selectedEvent && selectedEvent.time !== null);

    if (currentAvailData || (activeEvents && activeEvents.length > 0)) {
        // displayTimeSlots now handles both shifts (via currentAvailData)
        // and events (by fetching from getActiveEvents() internally)
        displayTimeSlots(currentAvailData, timeIsSelected);
    } else {
        console.warn("No current availability/event data to re-display slots on summary click. Forcing full refresh.");
        if (window.handleCoversChangeGlobal) {
            window.handleCoversChangeGlobal(); // This should re-fetch and then call displayTimeSlots
        }
    }
}

// --- View Switching Functions ---

export function showBookingSelectionView() {
    const bookingSelectors = document.querySelector('.form-selectors');
    const selectionDisplay = document.querySelector('.selection-display');
    const nextButtonElem = document.getElementById('nextButton'); // Get the button itself
    const nextButtonRow = nextButtonElem ? nextButtonElem.closest('.form-row') : null; // Then find its parent row
    const customerDetailsSection = document.getElementById('customerDetailsSection');
    const confirmationMessageArea = document.getElementById('confirmationMessageArea');

    if (bookingSelectors) bookingSelectors.style.display = ''; // Revert to default (likely flex)
    if (selectionDisplay) selectionDisplay.style.display = ''; // Revert to default
    if (nextButtonRow) nextButtonRow.style.display = ''; // Revert to default (likely block or flex based on CSS)

    if (customerDetailsSection) customerDetailsSection.style.display = 'none';

    if (confirmationMessageArea) {
        confirmationMessageArea.style.display = 'none';
        confirmationMessageArea.textContent = '';
    }
}

export function showCustomerDetailsView() {
    const bookingSelectors = document.querySelector('.form-selectors');
    const selectionDisplay = document.querySelector('.selection-display');
    const nextButtonElem = document.getElementById('nextButton'); // Get the button itself
    const nextButtonRow = nextButtonElem ? nextButtonElem.closest('.form-row') : null; // Then find its parent row
    const customerDetailsSection = document.getElementById('customerDetailsSection');

    if (bookingSelectors) bookingSelectors.style.display = 'none';
    if (selectionDisplay) selectionDisplay.style.display = 'none';
    if (nextButtonRow) nextButtonRow.style.display = 'none';

    if (customerDetailsSection) customerDetailsSection.style.display = 'block'; // Or '' to revert to stylesheet default

    // Populate the booking summary
    const restaurantName = getRestaurantFullNameFromHold();
    const selectedDate = getSelectedDateForSummary();
    const decimalTime = getCurrentSelectedDecimalTime(); // This is the selected time value
    const shiftName = getCurrentSelectedShiftName(); // This is for selected shift
    const selectedEvent = getSelectedEventDetails(); // This is for selected event
    const covers = getSelectedCoversForSummary();
    const areaName = getSelectedAreaNameForSummary();

    let displayItemName = shiftName; // Default to shift name
    let formattedTime = '-';

    if (selectedEvent && selectedEvent.time !== null) {
        // Event is selected, use its details
        displayItemName = selectedEvent.name;
        formattedTime = formatTime(selectedEvent.time);
    } else if (decimalTime !== null) {
        // Shift is selected
        // displayItemName is already shiftName
        formattedTime = formatTime(decimalTime);
    } else if (displayItemName) { // Fallback if only shiftName is somehow set without a decimalTime
        formattedTime = displayItemName; // Display shift name as time if no specific time
    }

    // The summaryTimeEl will now display "Event Name at Time" or "Shift Name at Time"
    const summaryTimeText = displayItemName ? `${displayItemName} at ${formattedTime}` : formattedTime;

    const summaryRestaurantNameEl = document.getElementById('summaryRestaurantName');
    const summaryDateEl = document.getElementById('summaryDate');
    const summaryTimeEl = document.getElementById('summaryTime'); // This will show "Event/Shift Name at Time"
    const summaryCoversEl = document.getElementById('summaryCovers');
    const summaryAreaEl = document.getElementById('summaryArea');
    const summaryAddonsEl = document.getElementById('summaryAddons'); // Added

    if (summaryRestaurantNameEl) summaryRestaurantNameEl.textContent = restaurantName || '-';
    if (summaryDateEl) summaryDateEl.textContent = selectedDate || '-';
    if (summaryTimeEl) summaryTimeEl.textContent = summaryTimeText; // Corrected variable
    if (summaryCoversEl) summaryCoversEl.textContent = covers !== null ? covers.toString() : '-';
    if (summaryAreaEl) summaryAreaEl.textContent = areaName || '-';

    // Update to use generateDetailedAddonsString for the summary
    const selectedAddonsCtx = getSelectedAddonsForContext();
    const coversForSummary = getSelectedCoversForSummary(); // Already retrieved above as 'covers'
    const config = getConfig();
    const currencySymbol = config && config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';

    const detailedAddonsString = generateDetailedAddonsString(selectedAddonsCtx, covers, currencySymbol);
    if (summaryAddonsEl) summaryAddonsEl.textContent = detailedAddonsString;
}

// New utility function to generate a detailed string with prices for addons
export function generateDetailedAddonsString(addonsObject, guestCount, currencySymbol) {
    if (!addonsObject) return '-';

    let displayItems = [];
    let grandTotal = 0;

    // Process usage1 addons
    if (addonsObject.usage1 && addonsObject.usage1.uid) {
        const addon = addonsObject.usage1;
        const basePrice = (addon.price || 0) / 100;
        const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
        grandTotal += itemCost;
        displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
    }

    // Process usage2 addons
    if (addonsObject.usage2 && addonsObject.usage2.length > 0) {
        addonsObject.usage2.forEach(addon => {
            if (addon.uid && (addon.quantity || 0) > 0) {
                const basePrice = (addon.price || 0) / 100;
                // Clarified logic: itemCost is total for this line item (basePrice * quantity)
                const itemCost = basePrice * (addon.quantity || 0);
                grandTotal += itemCost;
                displayItems.push(`${addon.name} x${addon.quantity || 0} (${currencySymbol}${itemCost.toFixed(2)})`);
            }
        });
    }

    // Process usage3 addons
    if (addonsObject.usage3 && addonsObject.usage3.length > 0) {
        addonsObject.usage3.forEach(addon => {
            if (addon.uid) {
                const addonData = addon; // Assuming addon is the full object
                const basePrice = (addonData.price || 0) / 100;
                const itemCost = (addonData.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
                grandTotal += itemCost;
                displayItems.push(`${addonData.name} (${currencySymbol}${itemCost.toFixed(2)})`);
            }
        });
    }

    if (displayItems.length > 0) {
        let displayText = displayItems.join(', ');
        displayText += ` --- Total Addons: ${currencySymbol}${grandTotal.toFixed(2)}`;
        return displayText;
    } else {
        return '-';
    }
}

// Helper function formatAddonsForDisplay is now removed as it's superseded by generateDetailedAddonsString for all detailed displays.
// If a simpler, non-priced version is ever needed again, it can be recreated or generateDetailedAddonsString could take a flag.

// --- Loading Overlay ---
const LOADING_OVERLAY_ID = 'loading-overlay';

export function showLoadingOverlay(message) {
    let overlay = document.getElementById(LOADING_OVERLAY_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = LOADING_OVERLAY_ID;
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.color = 'white';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '10000'; // Ensure it's on top
        overlay.style.textAlign = 'center';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<p style="padding: 20px; font-size: 1.2em;">${message}</p>`;
    overlay.style.display = 'flex'; // Show it if it was hidden
}

export function hideLoadingOverlay() {
    const overlay = document.getElementById(LOADING_OVERLAY_ID);
    if (overlay) {
        overlay.style.display = 'none'; // Hide it instead of removing, for faster re-show
    }
}

export function showTimeSelectionAccordion(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    const labelEl = getTimeSelectionLabel();
    const containerEl = getTimeSelectorContainer();

    if (containerEl) containerEl.style.display = '';
    if (labelEl) {
        labelEl.innerText = originalTimeSelectionLabelText;
        labelEl.classList.remove('summary-mode-active');
    }
    // When returning to accordion view, hide area selector until a new time is chosen
    const localConfig = getConfig();
    if (localConfig.arSelect === "true") {
        hideAreaSelector();
    }
}

// --- Existing DOM Element Getters ---
const getAreaSelectorContainer = () => document.getElementById('areaSelectorContainer');
const getAreaRadioGroupContainer = () => document.getElementById('areaRadioGroupContainer');
const getAreaAvailabilityMessage = () => document.getElementById('areaAvailabilityMessage');
const getSelectedAreaValueSpan = () => document.getElementById('selectedAreaValue');
const getAddonsDisplayArea = () => document.getElementById('addonsDisplayArea');
const getNextButton = () => document.getElementById('nextButton');
const getSelectedAddonsValueSpan = () => document.getElementById('selectedAddonsValue');
const getDailyRotaMessageDiv = () => document.getElementById('dailyRotaMessage');

// --- Area Selector Visibility ---

export function showAreaSelector() {
    const areaSelector = getAreaSelectorContainer();
    if (areaSelector) {
        areaSelector.style.display = 'block'; // Or 'flex' if it's a flex container
    }
}

export function hideAreaSelector() {
    const areaSelector = getAreaSelectorContainer();
    if (areaSelector) {
        areaSelector.style.display = 'none';
    }
}

// --- Addon UI Callbacks & Updates ---

let resetCurrentAddonsUICallback = () => {
    const addonsDisplayArea = getAddonsDisplayArea();
    if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';
    const selectedAddonsValueSpan = getSelectedAddonsValueSpan();
    if (selectedAddonsValueSpan) selectedAddonsValueSpan.textContent = '-';
    const coversSelectorEl = getCoversSelector();
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) || 0 : 0;
    updateAllUsage2ButtonStatesUI(guestCount);
};

export function _setResetAddonsUICallback(callback) {
    resetCurrentAddonsUICallback = callback;
}

function getTotalUsage2AddonQuantity() {
    let total = 0;
    const currentAddons = getSelectedAddons();
    if (currentAddons && currentAddons.usage2) {
        currentAddons.usage2.forEach(addon => {
            total += (addon.quantity || 0);
        });
    }
    return total;
}

export function updateAllUsage2ButtonStatesUI(currentGuestCount) {
    const totalCurrentUsage2Quantity = getTotalUsage2AddonQuantity();
    document.querySelectorAll('.usage2-item .addon-quantity-selector').forEach(qtySelector => {
        const qtyInput = qtySelector.querySelector('.qty-input');
        const minusButton = qtySelector.querySelector('.minus-btn');
        const plusButton = qtySelector.querySelector('.plus-btn');
        if (!qtyInput || !minusButton || !plusButton) return;
        const itemSpecificCurrentValue = parseInt(qtyInput.value);
        minusButton.disabled = (itemSpecificCurrentValue === 0);
        if (currentGuestCount === 0) {
            plusButton.disabled = true;
        } else {
            plusButton.disabled = (totalCurrentUsage2Quantity >= currentGuestCount);
        }
    });
}

export function updateSelectedAddonsDisplay() {
    const selectedAddonsValueSpan = getSelectedAddonsValueSpan();
    if (!selectedAddonsValueSpan) return;
    const coversSelectorEl = getCoversSelector();
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) || 0 : 0;

    const localConfig = getConfig();
    const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';

    const currentAddons = getSelectedAddons(); // From UI interactions state

    const detailedString = generateDetailedAddonsString(currentAddons, guestCount, currencySymbol);

    if (selectedAddonsValueSpan) {
        selectedAddonsValueSpan.textContent = detailedString;
    }
}

export function updateNextButtonState() {
    const nextButton = getNextButton();
    if (!nextButton) return;
    nextButton.disabled = true;
    const selectedTimeValueEl = getSelectedTimeValueSpan();
    const selectedTimeText = selectedTimeValueEl ? selectedTimeValueEl.textContent : '-';
    if (!selectedTimeText || selectedTimeText === '-' || selectedTimeText.includes('N/A')) return;
    const coversSelectorEl = getCoversSelector();
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) : 0;
    const policy = getCurrentShiftUsagePolicy();
    const currentAddons = getSelectedAddons();
    if (policy === null || typeof policy === 'undefined') {
        nextButton.disabled = false;
        return;
    }
    switch (parseInt(policy)) {
        case 0: nextButton.disabled = false; break;
        case 1: nextButton.disabled = !(currentAddons.usage1 && currentAddons.usage1.uid); break;
        case 2: nextButton.disabled = !(guestCount > 0 && getTotalUsage2AddonQuantity() === guestCount); break;
        case 3: nextButton.disabled = false; break;
        default: nextButton.disabled = false; break;
    }
}

export function updateSelectedAreaDisplay(textToDisplay) {
    const selectedAreaValueSpan = getSelectedAreaValueSpan();
    if (selectedAreaValueSpan) {
        selectedAreaValueSpan.textContent = textToDisplay || '-';
    }
}

function setAllAddonDataAttributes(element, addon) {
    element.dataset.addonUid = addon.uid;
    element.dataset.addonName = addon.name;
    element.dataset.addonPrice = addon.price;
    element.dataset.addonDesc = addon.desc || '';
    element.dataset.addonPer = addon.per;
    element.dataset.addonType = addon.type;
}

function renderUsage1Addons(filteredAddons, guestCount, shiftName) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localConfig = getConfig();
    if (!filteredAddons || filteredAddons.length === 0) return;
    if (filteredAddons.length === 1) {
        const addon = filteredAddons[0];
        if (!addon.uid || !addon.name) {
            console.warn('Skipping addon due to missing uid or name:', addon);
            return;
        }
        const addonItemDiv = document.createElement('div');
        addonItemDiv.className = 'addon-item usage1-single';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'addon-checkbox usage1-checkbox';
        checkbox.value = addon.uid;
        checkbox.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
        setAllAddonDataAttributes(checkbox, addon);
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        let labelHTML = `<span class="addon-name">${addon.name}</span>`;
        if (typeof addon.price !== 'undefined' && addon.price !== null) {
            const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';
            const priceDisplay = (addon.price / 100).toFixed(2);
            labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
        }
        if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
        label.innerHTML = labelHTML;
        addonItemDiv.appendChild(checkbox);
        addonItemDiv.appendChild(label);
        addonsDisplayArea.appendChild(addonItemDiv);
    } else {
        const radioGroupContainer = document.createElement('div');
        radioGroupContainer.className = 'addon-radio-group';
        const radioGroupName = `shift_${shiftName.replace(/\s+/g, '_')}_usage1_addons`;
        filteredAddons.forEach(addon => {
            if (!addon.uid || !addon.name) {
                console.warn('Skipping addon due to missing uid or name:', addon);
                return;
            }
            const addonItemDiv = document.createElement('div');
            addonItemDiv.className = 'addon-item usage1-radio';
            const radioButton = document.createElement('input');
            radioButton.type = 'radio';
            radioButton.className = 'addon-radio usage1-radio-btn';
            radioButton.name = radioGroupName;
            radioButton.value = addon.uid;
            radioButton.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
            setAllAddonDataAttributes(radioButton, addon);
            const label = document.createElement('label');
            label.htmlFor = radioButton.id;
            let labelHTML = `<span class="addon-name">${addon.name}</span>`;
            if (typeof addon.price !== 'undefined' && addon.price !== null) {
                const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';
                const priceDisplay = (addon.price / 100).toFixed(2);
                labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
            }
            if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
            label.innerHTML = labelHTML;
            addonItemDiv.appendChild(radioButton);
            addonItemDiv.appendChild(label);
            radioGroupContainer.appendChild(addonItemDiv);
        });
        addonsDisplayArea.appendChild(radioGroupContainer);
    }
}

function renderUsage2Addons(filteredAddons, guestCount, shiftName) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localConfig = getConfig();
    if (!filteredAddons || filteredAddons.length === 0) return;
    const currentAddons = getSelectedAddons();
    filteredAddons.forEach(addon => {
        if (!addon.uid || !addon.name) {
            console.warn('Skipping addon due to missing uid or name:', addon);
            return;
        }
        const addonItemDiv = document.createElement('div');
        addonItemDiv.className = 'addon-item usage2-item';
        const infoDiv = document.createElement('div');
        infoDiv.className = 'addon-info';
        let infoHTML = `<span class="addon-name">${addon.name}</span>`;
        if (typeof addon.price !== 'undefined' && addon.price !== null) {
            const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';
            const priceDisplay = (addon.price / 100).toFixed(2);
            infoHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
        }
        if (addon.desc) infoHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
        infoDiv.innerHTML = infoHTML;
        addonItemDiv.appendChild(infoDiv);
        const qtyContainer = document.createElement('div');
        qtyContainer.className = 'addon-quantity-selector';
        const minusButton = document.createElement('button');
        minusButton.type = 'button'; minusButton.textContent = '-';
        minusButton.className = 'qty-btn minus-btn';
        const qtyInput = document.createElement('input');
        qtyInput.type = 'text'; qtyInput.className = 'qty-input';
        const existingAddon = currentAddons.usage2.find(a => a.uid === addon.uid);
        qtyInput.value = existingAddon ? existingAddon.quantity.toString() : '0';
        qtyInput.readOnly = true;
        setAllAddonDataAttributes(qtyInput, addon);
        const plusButton = document.createElement('button');
        plusButton.type = 'button'; plusButton.textContent = '+';
        plusButton.className = 'qty-btn plus-btn';
        minusButton.disabled = (!existingAddon || existingAddon.quantity === 0);
        const totalUsage2Quantity = getTotalUsage2AddonQuantity();
        plusButton.disabled = (guestCount > 0 && totalUsage2Quantity >= guestCount && (!existingAddon || existingAddon.quantity === 0));
        if (guestCount === 0) plusButton.disabled = true;
        qtyContainer.appendChild(minusButton); qtyContainer.appendChild(qtyInput); qtyContainer.appendChild(plusButton);
        addonItemDiv.appendChild(qtyContainer);
        addonsDisplayArea.appendChild(addonItemDiv);
    });
}

function renderUsage3Addons(filteredAddons, guestCount, shiftName) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localConfig = getConfig();
    if (!filteredAddons || filteredAddons.length === 0) return;
    filteredAddons.forEach(addon => {
        if (!addon.uid || !addon.name) {
            console.warn('Skipping addon due to missing uid or name:', addon);
            return;
        }
        const addonItemDiv = document.createElement('div');
        addonItemDiv.className = 'addon-item usage3-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'addon-checkbox usage3-checkbox';
        checkbox.value = addon.uid;
        checkbox.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
        setAllAddonDataAttributes(checkbox, addon);
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        let labelHTML = `<span class="addon-name">${addon.name}</span>`;
        if (typeof addon.price !== 'undefined' && addon.price !== null) {
            const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';
            const priceDisplay = (addon.price / 100).toFixed(2);
            labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
        }
        if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
        label.innerHTML = labelHTML;
        addonItemDiv.appendChild(checkbox);
        addonItemDiv.appendChild(label);
        addonsDisplayArea.appendChild(addonItemDiv);
    });
}

function renderGenericAddons(addonsArray, guestCount, shiftName, usagePolicy) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localConfig = getConfig();
    addonsArray.forEach(addon => {
        if (!addon.uid || !addon.name) {
            console.warn('Skipping addon due to missing uid or name:', addon);
            return;
        }
        const addonItemDiv = document.createElement('div');
        addonItemDiv.className = 'addon-item generic-addon-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'addon-checkbox generic-addon-checkbox';
        checkbox.value = addon.uid;
        checkbox.id = `addon-generic-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
        setAllAddonDataAttributes(checkbox, addon);
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        let labelHTML = `<span class="addon-name">${addon.name}</span>`;
        if (typeof addon.price !== 'undefined' && addon.price !== null) {
            const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';
            const priceDisplay = (addon.price / 100).toFixed(2);
            labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
        }
        if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
        label.innerHTML = labelHTML;
        addonItemDiv.appendChild(checkbox);
        addonItemDiv.appendChild(label);
        addonsDisplayArea.appendChild(addonItemDiv);
    });
    if (addonsArray.length === 0 && usagePolicy) {
        addonsDisplayArea.innerHTML += `<p>No addons for generic rendering (usage ${usagePolicy}) after filtering for shift ${shiftName}.</p>`;
    }
}

export function renderAddons(originalAddonsArray, usagePolicy, guestCount, shiftName, areaId = null) { // Added areaId
    const addonsDisplayArea = getAddonsDisplayArea();
    const localLanguageStrings = getLanguageStrings();
    if (!addonsDisplayArea) { console.error('Addons display area not found.'); return; }

    addonsDisplayArea.innerHTML = ''; // Clear previous content in all scenarios at the start

    // Area ID is passed, but current assumption is addons are pre-filtered by API.
    // If not, filtering logic based on areaId and addon.area_uids (or similar) would go here.
    // console.log(`Rendering addons for Area ID: ${areaId}, Shift: ${shiftName}, Guests: ${guestCount}`);

    if (!originalAddonsArray || originalAddonsArray.length === 0) {
        addonsDisplayArea.style.display = 'none'; // Hide if no addons from API
        return;
    }
    const numericGuestCount = parseInt(guestCount);
    if (isNaN(numericGuestCount)) {
        console.error("Invalid guestCount provided to renderAddons:", guestCount);
        // addonsDisplayArea.innerHTML is already cleared
        addonsDisplayArea.style.display = 'none'; // Hide on error too
        return;
    }

    // Existing filtering by min/max covers
    let addonsToRender = originalAddonsArray.filter(addon => {
        const minCovers = (typeof addon.min === 'number' && !isNaN(addon.min)) ? addon.min : 1;
        const maxCovers = (typeof addon.max === 'number' && !isNaN(addon.max)) ? addon.max : Infinity;
        return numericGuestCount >= minCovers && numericGuestCount <= maxCovers;
    });

    // Placeholder for additional area-specific filtering if addons are not pre-filtered by API
    // This would require addons to have properties like `addon.area_uids` or `addon.is_area_specific`
    if (areaId && areaId !== "any") { // Example: only filter if a specific area is chosen
        // addonsToRender = addonsToRender.filter(addon => {
        //    // return !addon.area_uids || addon.area_uids.includes(areaId); // Example logic
        //    return true; // Assuming API pre-filters for now
        // });
    }


    if (addonsToRender.length === 0) { // Check after all filtering
        // addonsDisplayArea.innerHTML is already cleared
        addonsDisplayArea.style.display = 'none'; // Hide if no addons after filtering
        return;
    }

    // If we reach here, means addonsToRender.length > 0
    addonsDisplayArea.style.display = 'block'; // Or 'flex', or default visible style for the container

    const title = document.createElement('h4');
    title.textContent = localLanguageStrings.availableAddonsTitle || 'Available Addons:';
    addonsDisplayArea.appendChild(title);

    switch (parseInt(usagePolicy)) {
        case 1: renderUsage1Addons(addonsToRender, numericGuestCount, shiftName); break;
        case 2: renderUsage2Addons(addonsToRender, numericGuestCount, shiftName); break;
        case 3: renderUsage3Addons(addonsToRender, numericGuestCount, shiftName); break;
        default:
            console.warn(`Unknown usagePolicy: ${usagePolicy} for shift "${shiftName}". Rendering all filtered addons generically.`);
            renderGenericAddons(addonsToRender, numericGuestCount, shiftName, usagePolicy);
    }
}

export function createTimeSlotButton(timeValue, shiftObject, status = 'full') { // Changed isActive to status
    const button = document.createElement('button');
    button.className = 'time-slot-button'; // Base class
    const localLanguageStrings = getLanguageStrings();
    let hasValidIdentifier = false;

    // Set shift identifiers first
    if (shiftObject && shiftObject.uid != null && String(shiftObject.uid).trim() !== '') {
        button.dataset.shiftUid = String(shiftObject.uid);
        hasValidIdentifier = true;
    } else if (shiftObject && shiftObject.name != null && String(shiftObject.name).trim() !== '') {
        button.dataset.shiftName = String(shiftObject.name);
        hasValidIdentifier = true;
    }

    if (!hasValidIdentifier) {
        console.warn("Time slot button created without a valid shift identifier (UID or Name):", shiftObject);
        // Even without identifier, it might be an "unavailable" slot, so continue processing status
    }

    // Determine button state based on status and timeValue
    // timeValue < 0 always means 'unavailable' from the perspective of booking, overriding passed status.
    const effectiveStatus = timeValue < 0 ? 'unavailable' : status;

    if (effectiveStatus === 'unavailable') {
        if (!getShowUnavailableSlots()) return null; // Do not render if unavailable slots are hidden
        button.textContent = localLanguageStrings.notAvailableText || 'Not Available';
        button.classList.add('time-slot-unavailable');
        button.disabled = true;
    } else {
        // For 'full' or 'partial' status
        button.textContent = formatTime(timeValue);
        button.dataset.time = timeValue; // Ensure dataset.time is set for active buttons

        button.classList.add('time-slot-available'); // Base class for active/bookable buttons
        if (effectiveStatus === 'partial') {
            button.classList.add('time-slot-partial-area');
        }
        // If status is 'full', it correctly just has 'time-slot-available'.
        button.disabled = false;
    }
    return button;
}

// --- Event Specific UI Functions ---

// Function to create a time button for an event
export function createEventTimeButton(event, timeValue) {
    const button = document.createElement('button');
    button.className = 'time-slot-button event-time-button time-slot-available'; // Re-use styling for now
    button.textContent = formatTime(timeValue);
    button.dataset.eventUid = event.uid;
    button.dataset.time = timeValue;
    // Add any other event-specific data attributes if needed
    return button;
}

// Function to toggle event description visibility
export function toggleEventDescription(eventUid) {
    const descriptionDiv = document.getElementById(`event-desc-${eventUid}`);
    const showMoreLink = document.getElementById(`event-show-more-${eventUid}`);
    const allEvents = getActiveEvents(); // Assumes getActiveEvents returns full event objects including 'desc'
    const eventObject = allEvents.find(e => e.uid.toString() === eventUid.toString());

    if (descriptionDiv && eventObject) {
        if (descriptionDiv.style.display === 'none' || descriptionDiv.innerHTML === '') {
            descriptionDiv.innerHTML = eventObject.desc; // Set HTML description
            descriptionDiv.style.display = 'block';
            if (showMoreLink) showMoreLink.textContent = getLanguageStrings().showLessLink || 'Show Less';
        } else {
            descriptionDiv.style.display = 'none';
            // descriptionDiv.innerHTML = ''; // Optional: clear content when hiding
            if (showMoreLink) showMoreLink.textContent = getLanguageStrings().showMoreLink || 'Show More...';
        }
    }
}


export function displayTimeSlots(availabilityData, preserveAddons = false) {
    const timeSelectorContainer = getTimeSelectorContainer();
    const areaSelectorContainer = getAreaSelectorContainer();
    const areaRadioGroupContainer = getAreaRadioGroupContainer();
    const areaAvailabilityMessage = getAreaAvailabilityMessage();
    const addonsDisplay = getAddonsDisplayArea(); // Keep reference for potential conditional clearing

    if (!timeSelectorContainer) {
        console.error("timeSelectorContainer not found in displayTimeSlots");
        return;
    }
    if (!getSelectedTimeValueSpan()) {
         console.error("selectedTimeValueSpan (from getSelectedTimeValueSpan) not found; this might affect updateNextButtonState.");
    }

    const localConfig = getConfig();
    const localLanguageStrings = getLanguageStrings();

    // Visibility of areaSelectorContainer is now handled by:
    // 1. main.js initial hideAreaSelector()
    // 2. event_handlers.js timeSlotDelegatedListener -> showAreaSelector() if arSelect is true
    // 3. resetTimeRelatedUI() / showTimeSelectionAccordion() -> hideAreaSelector()
    // This function (displayTimeSlots) should only populate it if arSelect is true, not manage its visibility.
    if (localConfig.arSelect !== "true") {
        // If area selection is globally disabled, ensure container is definitively hidden
        // and clear any related elements just in case.
        if (areaSelectorContainer) areaSelectorContainer.style.display = 'none';
        if (areaRadioGroupContainer) areaRadioGroupContainer.innerHTML = '';
        if (areaAvailabilityMessage) {
            areaAvailabilityMessage.textContent = '';
            areaAvailabilityMessage.style.display = 'none';
        }
    }
    // If arSelect IS true, we don't touch areaSelectorContainer.style.display here.
    // We still proceed to populate its contents (radio buttons) further down if areas exist.

    timeSelectorContainer.innerHTML = '';

    if (!preserveAddons) {
        if (addonsDisplay) addonsDisplay.innerHTML = '';
        resetCurrentAddonsUICallback();
    }

    if (areaAvailabilityMessage) {
        areaAvailabilityMessage.textContent = '';
        areaAvailabilityMessage.style.display = 'none';
    }

    let currentSelectedAreaTextInSummary = '-'; // Default for summary
    const allShiftsForAvailabilityCheck = availabilityData.shifts; // Used for area availability

    if (localConfig.arSelect === "true" && areaRadioGroupContainer) {
        const currentSelectedAreaFromState = getCurrentSelectedAreaUID();
        areaRadioGroupContainer.innerHTML = '';
        const areas = availabilityData.areas;
        let radiosPopulated = false;
        let initialUidToSelect = currentSelectedAreaFromState; // Rename to avoid confusion later

        // Validate initialUidToSelect against available areas and "any" option
        let SPUIDIsValidInNewData = false;
        if (initialUidToSelect) {
            if (initialUidToSelect === "any" && localConfig.areaAny === "true") {
                SPUIDIsValidInNewData = true;
            } else if (initialUidToSelect !== "any" && areas && Array.isArray(areas)) {
                SPUIDIsValidInNewData = areas.some(area => area.uid.toString() === initialUidToSelect);
            }
        }

        if (!SPUIDIsValidInNewData) {
            if (localConfig.areaAny === "true" && localConfig.areaAnySelected === "true") { // Prefer "any" if configured to be default
                initialUidToSelect = "any";
            } else if (areas && Array.isArray(areas) && areas.length > 0) {
                initialUidToSelect = areas[0].uid.toString(); // Fallback to first specific area
            } else if (localConfig.areaAny === "true") { // If no specific areas, but "any" is an option
                initialUidToSelect = "any";
            } else {
                initialUidToSelect = null; // No valid initial selection
            }
        }

        // console.log("Populating area radio buttons..."); // Optional: Basic log

        if (localConfig.areaAny === "true") {
            const radioId = "area-any";
            const radioItemContainer = document.createElement('div');
            radioItemContainer.className = 'area-radio-item';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'areaSelection';
            radio.id = radioId;
            radio.value = 'any';
            radio.disabled = false; // Ensure enabled
            radio.checked = (initialUidToSelect === 'any');

            const label = document.createElement('label');
            label.htmlFor = radioId;
            label.textContent = localLanguageStrings.anyAreaText || "Any Area";

            const messageSpan = document.createElement('span');
            messageSpan.className = 'area-availability-message-span';
            messageSpan.style.display = 'none'; // Initially hidden
            messageSpan.style.marginLeft = '5px';

            radioItemContainer.appendChild(radio);
            radioItemContainer.appendChild(label);
            radioItemContainer.appendChild(messageSpan); // Append new message span
            areaRadioGroupContainer.appendChild(radioItemContainer);
            radiosPopulated = true;
            if (radio.checked) {
                currentSelectedAreaTextInSummary = label.textContent;
            }
        }

        if (areas && Array.isArray(areas) && areas.length > 0) {
            areas.forEach((area) => {
                const radioId = `area-${area.uid}`;
                const radioItemContainer = document.createElement('div');
                radioItemContainer.className = 'area-radio-item';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'areaSelection';
                radio.id = radioId;
                radio.value = area.uid.toString();
                radio.disabled = false; // Ensure enabled
                radio.checked = (initialUidToSelect === area.uid.toString());

                const label = document.createElement('label');
                label.htmlFor = radioId;
                label.textContent = area.name;

                const messageSpan = document.createElement('span');
                messageSpan.className = 'area-availability-message-span';
                messageSpan.style.display = 'none'; // Initially hidden
                messageSpan.style.marginLeft = '5px';

                radioItemContainer.appendChild(radio);
                radioItemContainer.appendChild(label);
                radioItemContainer.appendChild(messageSpan); // Append new message span
                areaRadioGroupContainer.appendChild(radioItemContainer);
                radiosPopulated = true;
                if (radio.checked) {
                    currentSelectedAreaTextInSummary = label.textContent;
                }
            });
        }

        // Update display based on the initial simple selection
        if (!radiosPopulated && localConfig.arSelect === "true") {
             updateSelectedAreaDisplay(localLanguageStrings.noAreasDefined || "No areas defined.");
        } else if (radiosPopulated) { // if radios were populated, currentSelectedAreaTextInSummary would have been set if one was checked
             updateSelectedAreaDisplay(currentSelectedAreaTextInSummary);
        } else { // No radios populated, and arSelect might be false
            updateSelectedAreaDisplay(null);
        }

    } else if (areaRadioGroupContainer) { // arSelect is false, clear display
         updateSelectedAreaDisplay(null);
         areaRadioGroupContainer.innerHTML = '';
    }

    const allShifts = availabilityData ? availabilityData.shifts : []; // Handle null availabilityData
    const activeEvents = getActiveEvents();
    let foundAnySlotsToShowOverall = false;

    // --- Render Shifts ---
    if (allShifts && Array.isArray(allShifts) && allShifts.length > 0) {
        const currentAreaUID = getCurrentSelectedAreaUID();
        if (localConfig.arSelect === "true" && currentAreaUID && currentAreaUID !== "any") {
            // ... (existing shift rendering logic for specific area)
            const selectedAreaObject = availabilityData.areas?.find(a => a.uid.toString() === currentAreaUID);
            if (!selectedAreaObject) {
                console.error(`Selected area UID ${currentAreaUID} not found in availabilityData.areas.`);
                // timeSelectorContainer.innerHTML already cleared, maybe add a specific message for this error
            } else {
                const selectedAreaGeneralTimes = selectedAreaObject.times;
                if (!selectedAreaGeneralTimes || selectedAreaGeneralTimes.length === 0) {
                    if (areaAvailabilityMessage) {
                         areaAvailabilityMessage.textContent = (localLanguageStrings.noTimesForArea || "This area has no available times on this date.").replace('{areaName}', selectedAreaObject.name);
                         areaAvailabilityMessage.style.display = 'block';
                    }
                    // timeSelectorContainer.innerHTML = ''; // Already cleared
                } else {
                    allShifts.forEach(shift => {
                        if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }

                        // Check if this shift is actually an event that will be rendered by the activeEvents loop
                        const isShiftAlsoAnActiveEvent = activeEvents.some(activeEvent =>
                            shift.uid && activeEvent.uid && shift.uid.toString() === activeEvent.uid.toString()
                        );
                        if (isShiftAlsoAnActiveEvent) {
                            return; // Skip rendering this as a shift, it will be rendered as an event
                        }

                        const currentShiftSessionTimes = shift.times;
                        const actualBookableTimesForShiftInArea = selectedAreaGeneralTimes.filter(
                            areaTime => currentShiftSessionTimes && currentShiftSessionTimes.includes(areaTime) && areaTime >= 0
                        );
                        if (actualBookableTimesForShiftInArea.length > 0) {
                            const panelDiv = document.createElement('div');
                            panelDiv.className = 'shift-accordion-panel';
                            const shiftTitle = document.createElement('h3');
                            shiftTitle.textContent = shift.name;
                            panelDiv.appendChild(shiftTitle);
                            if (shift.message && shift.message.trim() !== '') {
                                const shiftMessageDiv = document.createElement('div');
                                shiftMessageDiv.className = 'api-message shift-message shift-content-hidden'; // Start hidden
                                shiftMessageDiv.textContent = shift.message;
                                panelDiv.appendChild(shiftMessageDiv);
                            }
                            const shiftButtonContainer = document.createElement('div');
                            shiftButtonContainer.className = 'shift-times-wrapper shift-content-hidden'; // Start hidden
                            currentShiftSessionTimes.forEach(timeValueFromShift => {
                                if (timeValueFromShift < 0 && !getShowUnavailableSlots()) return;
                                let status = 'full';
                                if (timeValueFromShift < 0) {
                                    status = 'unavailable';
                                } else if (!actualBookableTimesForShiftInArea.includes(timeValueFromShift)) {
                                    status = 'partial';
                                }
                                const button = createTimeSlotButton(timeValueFromShift, shift, status);
                                if (button) {
                                    shiftButtonContainer.appendChild(button);
                                    foundAnySlotsToShowOverall = true;
                                }
                            });
                            panelDiv.appendChild(shiftButtonContainer);
                            // Per-Shift Legend Logic (for specific area selected context)
                            // ... (rest of the legend logic as it was)
                            const shiftLegendDiv = document.createElement('div');
                            shiftLegendDiv.className = 'shift-availability-legend';
                            shiftLegendDiv.style.display = 'none';
                            panelDiv.appendChild(shiftLegendDiv);
                            let partialSlotsInThisShiftCount = 0;
                            shiftButtonContainer.querySelectorAll('.time-slot-button.time-slot-partial-area').forEach(() => partialSlotsInThisShiftCount++);
                            if (partialSlotsInThisShiftCount > 0) {
                                // ... (legend items as before)
                                shiftLegendDiv.style.display = 'block';
                            }
                            timeSelectorContainer.appendChild(panelDiv);
                        }
                    });
                }
            }
        } else { // "Any Area" selected or no area selection mode for SHIFTS
            allShifts.forEach(shift => {
                if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }

                // Check if this shift is actually an event that will be rendered by the activeEvents loop
                const isShiftAlsoAnActiveEvent = activeEvents.some(activeEvent =>
                    shift.uid && activeEvent.uid && shift.uid.toString() === activeEvent.uid.toString()
                );
                if (isShiftAlsoAnActiveEvent) {
                    return; // Skip rendering this as a shift, it will be rendered as an event
                }

                const displayableTimes = shift.times ? shift.times.filter(timeValue => timeValue >= 0 || getShowUnavailableSlots()) : [];
                if (displayableTimes.length > 0) {
                    const panelDiv = document.createElement('div');
                    panelDiv.className = 'shift-accordion-panel';
                    const shiftTitle = document.createElement('h3');
                    shiftTitle.textContent = shift.name;
                    panelDiv.appendChild(shiftTitle);
                    if (shift.message && shift.message.trim() !== '') {
                        const shiftMessageDiv = document.createElement('div');
                        shiftMessageDiv.className = 'api-message shift-message shift-content-hidden'; // Start hidden
                        shiftMessageDiv.textContent = shift.message;
                        panelDiv.appendChild(shiftMessageDiv);
                    }
                    const shiftButtonContainer = document.createElement('div');
                    shiftButtonContainer.className = 'shift-times-wrapper shift-content-hidden'; // Start hidden
                    displayableTimes.forEach(timeValue => {
                        let status = (timeValue < 0) ? 'unavailable' : 'full';
                        const button = createTimeSlotButton(timeValue, shift, status);
                        if (button) {
                            shiftButtonContainer.appendChild(button);
                            foundAnySlotsToShowOverall = true;
                        }
                    });
                    panelDiv.appendChild(shiftButtonContainer);
                    // Per-Shift Legend Logic (for "Any Area" or no area selection context)
                    // ... (rest of the legend logic as it was)
                    const shiftLegendDiv = document.createElement('div');
                    shiftLegendDiv.className = 'shift-availability-legend';
                    shiftLegendDiv.style.display = 'none';
                    panelDiv.appendChild(shiftLegendDiv);
                    let partialSlotsInThisShiftCount = 0;
                    shiftButtonContainer.querySelectorAll('.time-slot-button.time-slot-partial-area').forEach(() => partialSlotsInThisShiftCount++);
                    if (partialSlotsInThisShiftCount > 0) {
                        // ... (legend items as before)
                        shiftLegendDiv.style.display = 'block';
                    }
                    timeSelectorContainer.appendChild(panelDiv);
                }
            });
        }
    }
    // --- End of Render Shifts ---

    // --- Render Events ---
    if (activeEvents && activeEvents.length > 0) {
        activeEvents.forEach(event => {
            const panelDiv = document.createElement('div');
            // Use a distinct class or add to existing if styling is shared
            panelDiv.className = 'shift-accordion-panel event-accordion-panel';
            const eventTitle = document.createElement('h3');
            eventTitle.textContent = event.name;
            eventTitle.dataset.panelType = 'event'; // Differentiate for accordion logic
            panelDiv.appendChild(eventTitle);

            const eventButtonContainer = document.createElement('div');
            eventButtonContainer.className = 'shift-times-wrapper event-times-wrapper shift-content-hidden'; // Start hidden

            // Create time buttons for the event
            // Assuming event.early and event.late are decimal times
            if (typeof event.early === 'number') {
                const earlyButton = createEventTimeButton(event, event.early);
                eventButtonContainer.appendChild(earlyButton);
                foundAnySlotsToShowOverall = true;
            }
            if (typeof event.late === 'number' && event.late !== event.early) {
                const lateButton = createEventTimeButton(event, event.late);
                eventButtonContainer.appendChild(lateButton);
                foundAnySlotsToShowOverall = true; // Should already be true if early was added
            }
            // If no times, maybe show a message or don't render the event.
            // For now, assuming valid events have at least 'early' time.
            panelDiv.appendChild(eventButtonContainer);

            // "Show More" link for description
            if (event.desc) {
                const showMoreLink = document.createElement('a');
                showMoreLink.href = '#';
                showMoreLink.id = `event-show-more-${event.uid}`;
                showMoreLink.className = 'event-show-more-link shift-content-hidden'; // Start hidden
                showMoreLink.textContent = localLanguageStrings.showMoreLink || 'Show More...';
                showMoreLink.dataset.eventUid = event.uid;
                showMoreLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleEventDescription(event.uid);
                });
                panelDiv.appendChild(showMoreLink);

                const descriptionDiv = document.createElement('div');
                descriptionDiv.id = `event-desc-${event.uid}`;
                descriptionDiv.className = 'event-description shift-content-hidden'; // Start hidden & for styling
                descriptionDiv.style.display = 'none'; // Explicitly hide
                panelDiv.appendChild(descriptionDiv);
            }
            // Placeholder for event-specific addons (if any)
            // const eventAddonsDiv = document.createElement('div');
            // eventAddonsDiv.id = `event-addons-${event.uid}`;
            // eventAddonsDiv.className = 'event-addons-wrapper shift-content-hidden';
            // panelDiv.appendChild(eventAddonsDiv);

            timeSelectorContainer.appendChild(panelDiv);
        });
    }
    // --- End of Render Events ---


    if (!foundAnySlotsToShowOverall && (!allShifts || allShifts.length === 0) && (!activeEvents || activeEvents.length === 0) ) {
        timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No time slots or events available.'}</p>`;
        if (localConfig.arSelect === "true" && getCurrentSelectedAreaUID() && getCurrentSelectedAreaUID() !== "any" && areaAvailabilityMessage) {
             areaAvailabilityMessage.textContent = localLanguageStrings.noTimesForArea || "This area is not available at this time. Please choose another area.";
             areaAvailabilityMessage.style.display = 'block';
        }
    }
    // Note: updateNextButtonState() is called at the end of this function, which is correct.
    // It should be updated after rendering everything.

    // THE FOLLOWING BLOCK WAS IDENTIFIED AS THE DUPLICATE SHIFT RENDERING LOGIC AND IS REMOVED.
    // const currentAreaUID = getCurrentSelectedAreaUID();
    // if (localConfig.arSelect === "true" && currentAreaUID && currentAreaUID !== "any" && availabilityData && availabilityData.areas) {
    //     // ... duplicated shift rendering for specific area ...
    // } else {
    //     // ... duplicated shift rendering for "any area" ...
    // }
    // END OF REMOVED DUPLICATE BLOCK

    const allAccordionPanels = timeSelectorContainer.querySelectorAll('.shift-accordion-panel'); // This class is on both shift and event panels

    if (allAccordionPanels.length > 0) {
        allAccordionPanels.forEach(panel => {
            const h3El = panel.querySelector('h3');
            if (!h3El) return;

            // Initially hide all content sections for all panels
            panel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link, .event-description').forEach(contentEl => {
                contentEl.classList.add('shift-content-hidden');
            });
            h3El.classList.remove('active-shift-title'); // Ensure all titles are initially inactive

            h3El.addEventListener('click', () => {
                const clickedPanel = h3El.closest('.shift-accordion-panel');
                if (!clickedPanel) return;

                // Clear previous time/event selection if switching panels
                const anySelectedButton = timeSelectorContainer.querySelector('.time-slot-button-selected, .event-time-button-selected');
                if (anySelectedButton) {
                    const selectedButtonPanel = anySelectedButton.closest('.shift-accordion-panel');
                    if (selectedButtonPanel && clickedPanel !== selectedButtonPanel) {
                        anySelectedButton.classList.remove('time-slot-button-selected', 'event-time-button-selected');
                        handleShiftChangeClearSelection(); // Clears both shift and event state
                    }
                }

                const isAlreadyActive = h3El.classList.contains('active-shift-title');

                // First, reset all other panels (close them and deactivate titles)
                allAccordionPanels.forEach(otherPanel => {
                    if (otherPanel !== clickedPanel) {
                        otherPanel.querySelector('h3')?.classList.remove('active-shift-title');
                        otherPanel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link, .event-description').forEach(contentEl => {
                            contentEl.classList.add('shift-content-hidden');
                        });
                        // If an event description was open in another panel, reset its link text
                        if (otherPanel.classList.contains('event-accordion-panel')) {
                            const descDiv = otherPanel.querySelector('.event-description');
                            if (descDiv && descDiv.style.display === 'block') { // If it was visible
                                // No need to call toggleEventDescription, just reset UI for hiding
                                const otherShowMoreLink = otherPanel.querySelector('.event-show-more-link');
                                if (otherShowMoreLink) otherShowMoreLink.textContent = getLanguageStrings().showMoreLink || 'Show More...';
                                descDiv.style.display = 'none'; // Ensure it's hidden
                            }
                        }
                    }
                });

                // Then, toggle the clicked panel's content
                if (!isAlreadyActive) {
                    h3El.classList.add('active-shift-title');
                    clickedPanel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link').forEach(contentEl => {
                        // Note: .event-description is handled by its own toggle, so it's not included here directly for showing
                        if (!contentEl.classList.contains('event-description')) {
                             contentEl.classList.remove('shift-content-hidden');
                        }
                    });
                    // If it's an event panel and the description was previously hidden, it remains hidden until "Show More" is clicked.
                    // If the description was already visible (e.g. user clicked show more, then h3 to close, then h3 to open again),
                    // it should re-appear if its 'shift-content-hidden' was correctly managed or if toggleEventDescription handles this.
                    // For simplicity, the .event-description div's visibility is primarily managed by toggleEventDescription.
                    // Here, we only ensure other elements like the link itself become visible.
                    const eventDescDiv = clickedPanel.querySelector('.event-description');
                    if (eventDescDiv && eventDescDiv.style.display === 'block') { // If it was already expanded by user
                        // No action needed, it's already block and will not have shift-content-hidden by default from toggle logic
                    }

                } else { // Panel was active, so now it's being closed
                    h3El.classList.remove('active-shift-title');
                    clickedPanel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link, .event-description').forEach(contentEl => {
                        contentEl.classList.add('shift-content-hidden');
                    });
                    // If it's an event panel and description was open, reset link text and hide div
                    if (clickedPanel.classList.contains('event-accordion-panel')) {
                        const descDiv = clickedPanel.querySelector('.event-description');
                        if (descDiv) { // No need to check if it was visible, just ensure it's hidden and link is reset
                            const showMoreLink = clickedPanel.querySelector('.event-show-more-link');
                            if (showMoreLink) showMoreLink.textContent = getLanguageStrings().showMoreLink || 'Show More...';
                            descDiv.style.display = 'none';
                            // descDiv.innerHTML = ''; // Optional: clear content
                        }
                    }
                }
            });
        });
    }

    // Restore selected shift/time state or open first panel if only one
    const currentSelectedTime = getCurrentSelectedDecimalTime();
    const currentSelectedShiftName = getCurrentSelectedShiftName();
    const currentSelectedEvent = getSelectedEventDetails(); // Get selected event

    let stateBasedSelectionMade = false;

    if (currentSelectedEvent && currentSelectedEvent.uid && currentSelectedEvent.time !== null) {
        // An event is selected in state, try to highlight it and open its panel
        allAccordionPanels.forEach(panel => {
            const h3 = panel.querySelector('h3');
            const eventTimeWrapper = panel.querySelector('.event-times-wrapper');
            if (h3 && h3.textContent === currentSelectedEvent.name && eventTimeWrapper) {
                const eventButton = Array.from(eventTimeWrapper.querySelectorAll('.event-time-button'))
                    .find(btn => btn.dataset.eventUid === currentSelectedEvent.uid.toString() && parseFloat(btn.dataset.time) === currentSelectedEvent.time);

                if (eventButton) {
                    // Open this panel
                    panel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link').forEach(contentEl => {
                       if (!contentEl.classList.contains('event-description')) contentEl.classList.remove('shift-content-hidden');
                    });
                    h3.classList.add('active-shift-title');
                    // Highlight the button
                    timeSelectorContainer.querySelectorAll('.time-slot-button-selected, .event-time-button-selected').forEach(btn => btn.classList.remove('time-slot-button-selected', 'event-time-button-selected'));
                    eventButton.classList.add('event-time-button-selected'); // Use a specific class if needed
                    stateBasedSelectionMade = true;

                    // Close other panels
                    allAccordionPanels.forEach(otherPanel => {
                        if (otherPanel !== panel) {
                            otherPanel.querySelector('h3')?.classList.remove('active-shift-title');
                            otherPanel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link, .event-description').forEach(contentEl => {
                                contentEl.classList.add('shift-content-hidden');
                            });
                        }
                    });
                }
            }
        });
    } else if (currentSelectedTime !== null && currentSelectedShiftName) {
        // A shift is selected in state, try to highlight it (existing logic)
        allAccordionPanels.forEach(panel => {
            const h3 = panel.querySelector('h3');
            // Ensure it's not an event panel by checking for shift-specific content or lack of event-specific data
            const isShiftPanel = !panel.classList.contains('event-accordion-panel');
            if (h3 && h3.textContent === currentSelectedShiftName && isShiftPanel) {
                const timesWrapper = panel.querySelector('.shift-times-wrapper');
                if (timesWrapper) {
                    const button = Array.from(timesWrapper.querySelectorAll('.time-slot-button.time-slot-available'))
                        .find(btn => btn.dataset.time && parseFloat(btn.dataset.time) === currentSelectedTime);
                    if (button) {
                        // Open this panel
                        panel.querySelectorAll('.shift-message, .shift-times-wrapper').forEach(contentEl => {
                           contentEl.classList.remove('shift-content-hidden');
                        });
                        h3.classList.add('active-shift-title');
                        // Highlight the button
                        timeSelectorContainer.querySelectorAll('.time-slot-button-selected, .event-time-button-selected').forEach(btn => btn.classList.remove('time-slot-button-selected', 'event-time-button-selected'));
                        button.classList.add('time-slot-button-selected');
                        stateBasedSelectionMade = true;

                        // Close other panels
                        allAccordionPanels.forEach(otherPanel => {
                            if (otherPanel !== panel) {
                                otherPanel.querySelector('h3')?.classList.remove('active-shift-title');
                                otherPanel.querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link, .event-description').forEach(contentEl => {
                                    contentEl.classList.add('shift-content-hidden');
                                });
                            }
                        });
                    }
                }
            }
        });
    }

    // If no specific shift/event was selected from state, but there's only one panel, open it.
    if (!stateBasedSelectionMade && allAccordionPanels.length === 1) {
        const singlePanelH3 = allAccordionPanels[0].querySelector('h3');
        if (singlePanelH3) {
            // Manually trigger the display logic for a single panel, rather than simulating a click,
            // to avoid issues with event listener setup timing or repeated logic.
            singlePanelH3.classList.add('active-shift-title');
            allAccordionPanels[0].querySelectorAll('.shift-message, .shift-times-wrapper, .event-times-wrapper, .event-show-more-link').forEach(contentEl => {
                if (!contentEl.classList.contains('event-description')) {
                    contentEl.classList.remove('shift-content-hidden');
                }
            });
        }
    }

    updateNextButtonState();
}

export function resetTimeRelatedUI() {
    const timeSelectorContainer = getTimeSelectorContainer();
    const selectedTimeValueSpan = getSelectedTimeValueSpan();
    const addonsDisplay = getAddonsDisplayArea();

    if (timeSelectorContainer) timeSelectorContainer.innerHTML = '';
    if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
    if (addonsDisplay) addonsDisplay.innerHTML = '';

    resetCurrentAddonsUICallback();
    updateNextButtonState();
    showTimeSelectionAccordion(); // This will also hide the area selector if arSelect is true
    updateSelectedAreaDisplay(null); // Clear area display

    // Explicitly hide area selector during full reset, regardless of arSelect state in showTimeSelectionAccordion
    // This ensures it's hidden if resetTimeRelatedUI is called directly for other reasons.
    hideAreaSelector();
}

export function showLoadingTimes() {
    const timeSelectorContainer = getTimeSelectorContainer();
    const lang = getLanguageStrings();
    if (timeSelectorContainer) {
        timeSelectorContainer.innerHTML = `<p class="loading-message">${lang.loadingTimes || 'Loading times...'}</p>`;
    }
}

export function displayErrorMessageInTimesContainer(messageKey, defaultMessage) {
    const timeSelectorContainer = getTimeSelectorContainer();
    const lang = getLanguageStrings();
    if (timeSelectorContainer) {
        timeSelectorContainer.innerHTML = `<p class="error-message">${lang[messageKey] || defaultMessage}</p>`;
    }
}

export function updateDailyRotaMessage(message) {
    const dailyRotaMessageDiv = getDailyRotaMessageDiv();
    if (dailyRotaMessageDiv) {
        if (message && message.trim() !== '') {
            dailyRotaMessageDiv.textContent = message;
            dailyRotaMessageDiv.style.display = 'block';
        } else {
            dailyRotaMessageDiv.textContent = '';
            dailyRotaMessageDiv.style.display = 'none';
        }
    }
}
