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
    getCurrentAvailabilityData
    // setCurrentSelectedAreaUID // Removed import
} from './state_manager.js';
import { getSelectedRadioValue, formatTime } from './dom_utils.js';

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

    if (containerEl) containerEl.style.display = 'none';
    if (labelEl) {
        labelEl.innerText = `${shiftName} at ${timeValueFormatted}`;
        labelEl.classList.add('summary-mode-active');
        labelEl.addEventListener('click', handleSummaryLabelClick, { once: true });
    }
}

function handleSummaryLabelClick() {
    showTimeSelectionAccordion();

    const currentAvailData = getCurrentAvailabilityData();
    if (currentAvailData) {
        displayTimeSlots(currentAvailData);
    } else {
        console.warn("No current availability data to re-display slots on summary click. Forcing full refresh.");
        if (window.handleCoversChangeGlobal) {
            window.handleCoversChangeGlobal();
        }
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
    const currentAddons = getSelectedAddons();
    let displayItems = [];
    let grandTotal = 0;
    if (currentAddons.usage1) {
        const addon = currentAddons.usage1;
        const basePrice = (addon.price || 0) / 100;
        const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
        grandTotal += itemCost;
        displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
    }
    currentAddons.usage2.forEach(addon => {
        const basePrice = (addon.price || 0) / 100;
        let itemCost = 0;
        let itemDisplayString = "";
        if (addon.per === "Party") {
            itemCost = basePrice;
            itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${basePrice.toFixed(2)} - Per Party)`;
        } else {
            itemCost = basePrice * (addon.quantity || 0);
            itemDisplayString = `${addon.name} x${addon.quantity || 0} (${currencySymbol}${itemCost.toFixed(2)})`;
        }
        grandTotal += itemCost;
        displayItems.push(itemDisplayString);
    });
    currentAddons.usage3.forEach(addon => {
        const basePrice = (addon.price || 0) / 100;
        const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
        grandTotal += itemCost;
        displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
    });
    if (displayItems.length > 0) {
        let displayText = displayItems.join(', ');
        displayText += ` --- Total Addons: ${currencySymbol}${grandTotal.toFixed(2)}`;
        selectedAddonsValueSpan.textContent = displayText;
    } else {
        selectedAddonsValueSpan.textContent = '-';
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

export function renderAddons(originalAddonsArray, usagePolicy, guestCount, shiftName) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localLanguageStrings = getLanguageStrings();
    if (!addonsDisplayArea) { console.error('Addons display area not found.'); return; }
    addonsDisplayArea.innerHTML = '';

    if (!originalAddonsArray || originalAddonsArray.length === 0) {
        addonsDisplayArea.innerHTML = `<p>${localLanguageStrings.noAddonsAvailable || 'No addons available for this selection.'}</p>`;
        return;
    }
    const numericGuestCount = parseInt(guestCount);
    if (isNaN(numericGuestCount)) {
        console.error("Invalid guestCount provided to renderAddons:", guestCount);
        addonsDisplayArea.innerHTML = `<p class="error-message">Error: Invalid guest count for addons.</p>`;
        return;
    }
    const filteredAddons = originalAddonsArray.filter(addon => {
        const minCovers = (typeof addon.min === 'number' && !isNaN(addon.min)) ? addon.min : 1;
        const maxCovers = (typeof addon.max === 'number' && !isNaN(addon.max)) ? addon.max : Infinity;
        return numericGuestCount >= minCovers && numericGuestCount <= maxCovers;
    });

    if (filteredAddons.length === 0) {
        addonsDisplayArea.innerHTML = `<p>${localLanguageStrings.noAddonsForGuestCount || 'No addons currently available for the selected number of guests.'}</p>`;
        return;
    }
    const title = document.createElement('h4');
    title.textContent = localLanguageStrings.availableAddonsTitle || 'Available Addons:';
    addonsDisplayArea.appendChild(title);

    switch (parseInt(usagePolicy)) {
        case 1: renderUsage1Addons(filteredAddons, numericGuestCount, shiftName); break;
        case 2: renderUsage2Addons(filteredAddons, numericGuestCount, shiftName); break;
        case 3: renderUsage3Addons(filteredAddons, numericGuestCount, shiftName); break;
        default:
            console.warn(`Unknown usagePolicy: ${usagePolicy} for shift "${shiftName}". Rendering all filtered addons generically.`);
            renderGenericAddons(filteredAddons, numericGuestCount, shiftName, usagePolicy);
    }
}

export function createTimeSlotButton(timeValue, shiftObject, isActive = true) {
    const button = document.createElement('button');
    button.className = 'time-slot-button';
    const localLanguageStrings = getLanguageStrings();
    let hasValidIdentifier = false;

    if (shiftObject && shiftObject.uid != null && String(shiftObject.uid).trim() !== '') {
        button.dataset.shiftUid = String(shiftObject.uid);
        hasValidIdentifier = true;
    } else if (shiftObject && shiftObject.name != null && String(shiftObject.name).trim() !== '') {
        button.dataset.shiftName = String(shiftObject.name);
        hasValidIdentifier = true;
    }

    if (!hasValidIdentifier) {
        console.warn("Time slot button created without a valid shift identifier (UID or Name):", shiftObject);
        button.classList.add('time-slot-no-identifier');
        isActive = false;
    }

    if (timeValue < 0) {
        if (!getShowUnavailableSlots()) return null;
        button.textContent = localLanguageStrings.notAvailableText || 'Not Available';
        button.classList.add('time-slot-unavailable');
        button.disabled = true;
    } else {
        button.textContent = formatTime(timeValue);
        button.dataset.time = timeValue;

        if (isActive) {
            button.classList.add('time-slot-available');
            button.disabled = false;
        } else {
            button.classList.add('time-slot-inactive');
            button.disabled = true;
        }
    }
    return button;
}

export function displayTimeSlots(availabilityData) {
    const timeSelectorContainer = getTimeSelectorContainer();
    const areaSelectorContainer = getAreaSelectorContainer();
    const areaRadioGroupContainer = getAreaRadioGroupContainer();
    const areaAvailabilityMessage = getAreaAvailabilityMessage();
    const addonsDisplay = getAddonsDisplayArea();

    if (!timeSelectorContainer) {
        console.error("timeSelectorContainer not found in displayTimeSlots");
        return;
    }
    if (!getSelectedTimeValueSpan()) {
         console.error("selectedTimeValueSpan (from getSelectedTimeValueSpan) not found; this might affect updateNextButtonState.");
    }

    const localConfig = getConfig();
    const localLanguageStrings = getLanguageStrings();

    if (areaSelectorContainer) {
        if (localConfig.arSelect === "true") {
            areaSelectorContainer.style.display = 'block';
        } else {
            areaSelectorContainer.style.display = 'none';
            if (areaRadioGroupContainer) areaRadioGroupContainer.innerHTML = '';
            if (areaAvailabilityMessage) {
                areaAvailabilityMessage.textContent = '';
                areaAvailabilityMessage.style.display = 'none';
            }
        }
    }

    timeSelectorContainer.innerHTML = '';

    if (addonsDisplay) addonsDisplay.innerHTML = '';
    resetCurrentAddonsUICallback();

    if (areaAvailabilityMessage) {
        areaAvailabilityMessage.textContent = '';
        areaAvailabilityMessage.style.display = 'none';
    }

    let currentSelectedAreaTextInSummary = '-'; // Default for summary

    if (localConfig.arSelect === "true" && areaRadioGroupContainer) {
        const currentSelectedAreaFromState = getCurrentSelectedAreaUID();
        areaRadioGroupContainer.innerHTML = '';
        const areas = availabilityData.areas;
        let radiosPopulated = false;
        let uidToSelect = currentSelectedAreaFromState;

        let SPUIDIsValidInNewData = false;
        if (uidToSelect) {
            if (uidToSelect === "any" && localConfig.areaAny === "true") {
                SPUIDIsValidInNewData = true;
            } else if (uidToSelect !== "any" && areas && Array.isArray(areas)) {
                SPUIDIsValidInNewData = areas.some(area => area.uid.toString() === uidToSelect);
            }
        }

        if (!SPUIDIsValidInNewData) {
            if (localConfig.areaAny === "true") {
                uidToSelect = "any";
            } else if (areas && Array.isArray(areas) && areas.length > 0) {
                uidToSelect = areas[0].uid.toString();
            } else {
                uidToSelect = null;
            }
            // setCurrentSelectedAreaUID(uidToSelect); // Removed: displayTimeSlots should not set this state.
        }

        if (localConfig.areaAny === "true") {
            const radioId = "area-any";
            const radioItemContainer = document.createElement('div');
            radioItemContainer.className = 'area-radio-item';
            const radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'areaSelection'; radio.id = radioId; radio.value = 'any';
            radio.checked = (uidToSelect === 'any');
            const label = document.createElement('label');
            label.htmlFor = radioId; label.textContent = localLanguageStrings.anyAreaText || "Any Area";
            radioItemContainer.appendChild(radio); radioItemContainer.appendChild(label);
            areaRadioGroupContainer.appendChild(radioItemContainer);
            radiosPopulated = true;
            if (radio.checked) currentSelectedAreaTextInSummary = label.textContent;
        }

        if (areas && Array.isArray(areas) && areas.length > 0) {
            areas.forEach((area) => {
                const radioId = `area-${area.uid}`;
                const radioItemContainer = document.createElement('div');
                radioItemContainer.className = 'area-radio-item';
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'areaSelection'; radio.id = radioId; radio.value = area.uid.toString();
                radio.checked = (uidToSelect === area.uid.toString());
                const label = document.createElement('label');
                label.htmlFor = radioId; label.textContent = area.name;
                radioItemContainer.appendChild(radio); radioItemContainer.appendChild(label);
                areaRadioGroupContainer.appendChild(radioItemContainer);
                radiosPopulated = true;
                if (radio.checked) currentSelectedAreaTextInSummary = label.textContent;
            });
        }

        if (!radiosPopulated && localConfig.arSelect === "true") {
             updateSelectedAreaDisplay(null);
        } else if (radiosPopulated) {
             updateSelectedAreaDisplay(currentSelectedAreaTextInSummary);
        }
    } else if (areaRadioGroupContainer) {
         updateSelectedAreaDisplay(null);
    }


    const allShifts = availabilityData.shifts;
    let foundAnySlotsToShowOverall = false;

    if (!allShifts || !Array.isArray(allShifts) || allShifts.length === 0) {
        timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
        if (localConfig.arSelect === "true" && getCurrentSelectedAreaUID() && getCurrentSelectedAreaUID() !== "any" && areaAvailabilityMessage) {
             areaAvailabilityMessage.textContent = localLanguageStrings.noTimesForArea || "This area is not available at this time. Please choose another area.";
             areaAvailabilityMessage.style.display = 'block';
        }
        updateNextButtonState();
        return;
    }

    const currentAreaUID = getCurrentSelectedAreaUID();

    if (localConfig.arSelect === "true" && currentAreaUID && currentAreaUID !== "any") {
        const selectedAreaObject = availabilityData.areas?.find(a => a.uid.toString() === currentAreaUID);
        if (!selectedAreaObject) {
            console.error(`Selected area UID ${currentAreaUID} not found in availabilityData.areas.`);
            timeSelectorContainer.innerHTML = `<p class="error-message">${localLanguageStrings.errorGeneric || "An error occurred displaying area times."}</p>`;
            updateNextButtonState();
            return;
        }
        const selectedAreaGeneralTimes = selectedAreaObject.times;
        if (!selectedAreaGeneralTimes || selectedAreaGeneralTimes.length === 0) {
            if (areaAvailabilityMessage) {
                 areaAvailabilityMessage.textContent = (localLanguageStrings.noTimesForArea || "This area has no available times on this date.").replace('{areaName}', selectedAreaObject.name);
                 areaAvailabilityMessage.style.display = 'block';
            }
            timeSelectorContainer.innerHTML = '';
            updateNextButtonState();
            return;
        }
        allShifts.forEach(shift => {
            if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }

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
                    shiftMessageDiv.className = 'api-message shift-message';
                    shiftMessageDiv.textContent = shift.message;
                    panelDiv.appendChild(shiftMessageDiv);
                }

                const shiftButtonContainer = document.createElement('div');
                shiftButtonContainer.className = 'shift-times-wrapper';

                currentShiftSessionTimes.forEach(timeValueFromShift => {
                    if (timeValueFromShift < 0 && !getShowUnavailableSlots()) return;

                    let buttonIsActive = actualBookableTimesForShiftInArea.includes(timeValueFromShift);
                    if (timeValueFromShift < 0) buttonIsActive = false;

                    const button = createTimeSlotButton(timeValueFromShift, shift, buttonIsActive);
                    if (button) {
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShowOverall = true;
                    }
                });
                panelDiv.appendChild(shiftButtonContainer);
                timeSelectorContainer.appendChild(panelDiv);
            }
        });
    } else {
        allShifts.forEach(shift => {
            if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }

            const displayableTimes = shift.times ? shift.times.filter(timeValue => timeValue >= 0 || getShowUnavailableSlots()) : [];

            if (displayableTimes.length > 0) {
                const panelDiv = document.createElement('div');
                panelDiv.className = 'shift-accordion-panel';

                const shiftTitle = document.createElement('h3');
                shiftTitle.textContent = shift.name;
                panelDiv.appendChild(shiftTitle);

                if (shift.message && shift.message.trim() !== '') {
                    const shiftMessageDiv = document.createElement('div');
                    shiftMessageDiv.className = 'api-message shift-message';
                    shiftMessageDiv.textContent = shift.message;
                    panelDiv.appendChild(shiftMessageDiv);
                }

                const shiftButtonContainer = document.createElement('div');
                shiftButtonContainer.className = 'shift-times-wrapper';

                displayableTimes.forEach(timeValue => {
                    const button = createTimeSlotButton(timeValue, shift, timeValue >= 0);
                    if (button) {
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShowOverall = true;
                    }
                });
                panelDiv.appendChild(shiftButtonContainer);
                timeSelectorContainer.appendChild(panelDiv);
            }
        });
    }

    if (!foundAnySlotsToShowOverall) {
         timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
    }

    const allAccordionPanels = timeSelectorContainer.querySelectorAll('.shift-accordion-panel');
    if (allAccordionPanels.length > 0) {
        allAccordionPanels.forEach(panel => {
            const h3El = panel.querySelector('h3');
            const msgEl = panel.querySelector('.shift-message');
            const wrapEl = panel.querySelector('.shift-times-wrapper');

            if (h3El) h3El.classList.remove('active-shift-title');
            if (msgEl) msgEl.classList.add('shift-content-hidden');
            if (wrapEl) wrapEl.classList.add('shift-content-hidden');

            if (h3El) {
                h3El.addEventListener('click', () => {
                    const clickedPanel = h3El.closest('.shift-accordion-panel');
                    if (!clickedPanel) return;

                    const clickedMsg = clickedPanel.querySelector('.shift-message');
                    const clickedWrap = clickedPanel.querySelector('.shift-times-wrapper');

                    allAccordionPanels.forEach(otherPanel => {
                        const otherH3 = otherPanel.querySelector('h3');
                        const otherMsg = otherPanel.querySelector('.shift-message');
                        const otherWrap = otherPanel.querySelector('.shift-times-wrapper');

                        if (otherH3) otherH3.classList.remove('active-shift-title');
                        if (otherMsg) otherMsg.classList.add('shift-content-hidden');
                        if (otherWrap) otherWrap.classList.add('shift-content-hidden');
                    });

                    if (clickedMsg) clickedMsg.classList.remove('shift-content-hidden');
                    if (clickedWrap) clickedWrap.classList.remove('shift-content-hidden');
                    h3El.classList.add('active-shift-title');
                });
            }
        });
    }

    const currentSelectedTime = getCurrentSelectedDecimalTime();
    const currentSelectedShiftName = getCurrentSelectedShiftName();

    let stateBasedSelectionMade = false;
    if (currentSelectedTime !== null && currentSelectedShiftName && allAccordionPanels.length > 0) {
        let targetButtonElement = null;
        let targetH3ForSelection = null;
        let targetPanelForSelection = null;

        allAccordionPanels.forEach(panel => {
            const h3 = panel.querySelector('h3');
            if (h3 && h3.textContent && h3.textContent === currentSelectedShiftName) {
                targetH3ForSelection = h3;
                targetPanelForSelection = panel;
                const timesWrapper = panel.querySelector('.shift-times-wrapper');
                if (timesWrapper) {
                    const button = Array.from(timesWrapper.querySelectorAll('.time-slot-button.time-slot-available'))
                        .find(btn => btn.dataset.time && parseFloat(btn.dataset.time) === currentSelectedTime);
                    if (button) {
                        targetButtonElement = button;
                    }
                }
            }
        });

        if (targetButtonElement && targetH3ForSelection && targetPanelForSelection) {
            allAccordionPanels.forEach(otherPanel => {
                if (otherPanel !== targetPanelForSelection) {
                    const otherH3 = otherPanel.querySelector('h3');
                    const otherMsg = otherPanel.querySelector('.shift-message');
                    const otherWrap = otherPanel.querySelector('.shift-times-wrapper');
                    if (otherH3) otherH3.classList.remove('active-shift-title');
                    if (otherMsg) otherMsg.classList.add('shift-content-hidden');
                    if (otherWrap) otherWrap.classList.add('shift-content-hidden');
                }
            });

            const msgEl = targetPanelForSelection.querySelector('.shift-message');
            const wrapEl = targetPanelForSelection.querySelector('.shift-times-wrapper');
            if (msgEl) msgEl.classList.remove('shift-content-hidden');
            if (wrapEl) wrapEl.classList.remove('shift-content-hidden');
            targetH3ForSelection.classList.add('active-shift-title');
            stateBasedSelectionMade = true;

            timeSelectorContainer.querySelectorAll('.time-slot-button-selected').forEach(btn => btn.classList.remove('time-slot-button-selected'));
            targetButtonElement.classList.add('time-slot-button-selected');
        }
    }

    if (!stateBasedSelectionMade && allAccordionPanels.length === 1) {
        const singlePanelH3 = allAccordionPanels[0].querySelector('h3');
        if (singlePanelH3) {
            singlePanelH3.click();
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
    showTimeSelectionAccordion();
    updateSelectedAreaDisplay(null); // Clear area display
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
