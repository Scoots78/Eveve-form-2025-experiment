// --- UI Manager ---

import { getConfig, getLanguageStrings } from './config_manager.js';
import {
    getCurrentShiftUsagePolicy,
    getSelectedAddons,
    getShowUnavailableSlots,
    getCurrentSelectedAreaUID,
    setCurrentSelectedDecimalTime,
    setCurrentShiftUsagePolicy,
    // No direct state setters for addons here, event handlers will manage state via state_manager
} from './state_manager.js';
import { getSelectedRadioValue, formatTime } from './dom_utils.js';

// DOM Element Getters
const getCoversSelector = () => document.getElementById('coversSelector');
const getTimeSelectorContainer = () => document.getElementById('timeSelectorContainer');
const getSelectedTimeValueSpan = () => document.getElementById('selectedTimeValue');
const getAreaSelectorContainer = () => document.getElementById('areaSelectorContainer');
const getAreaRadioGroupContainer = () => document.getElementById('areaRadioGroupContainer');
const getAreaAvailabilityMessage = () => document.getElementById('areaAvailabilityMessage');
const getSelectedAreaValueSpan = () => document.getElementById('selectedAreaValue');
const getAddonsDisplayArea = () => document.getElementById('addonsDisplayArea');
const getNextButton = () => document.getElementById('nextButton');
const getSelectedAddonsValueSpan = () => document.getElementById('selectedAddonsValue');
const getDailyRotaMessageDiv = () => document.getElementById('dailyRotaMessage');

let resetCurrentAddonsUICallback = () => {
    // Default implementation, can be overridden by main.js
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

// Internal helper function
function getTotalUsage2AddonQuantity() {
    let total = 0;
    const currentAddons = getSelectedAddons();
    if (currentAddons && currentAddons.usage2) {
        currentAddons.usage2.forEach(addon => {
            total += (addon.quantity || 0); // Ensure quantity is a number
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

export function updateSelectedAreaDisplay() {
    const selectedAreaValueSpan = getSelectedAreaValueSpan();
    const localConfig = getConfig();
    const localLanguageStrings = getLanguageStrings();
    const areaRadioGroupContainer = getAreaRadioGroupContainer();

    if (selectedAreaValueSpan) {
        if (localConfig.arSelect === "true" && areaRadioGroupContainer && areaRadioGroupContainer.style.display !== 'none') {
            const checkedRadio = areaRadioGroupContainer.querySelector('input[name="areaSelection"]:checked');
            if (checkedRadio) {
                if (checkedRadio.value === "any") {
                    selectedAreaValueSpan.textContent = localLanguageStrings.anyAreaSelectedText || "Any";
                } else {
                    const label = areaRadioGroupContainer.querySelector(`label[for="${checkedRadio.id}"]`);
                    selectedAreaValueSpan.textContent = label ? label.textContent : checkedRadio.value;
                }
            } else { selectedAreaValueSpan.textContent = '-'; }
        } else { selectedAreaValueSpan.textContent = '-'; }
    }
}

function setAllAddonDataAttributes(element, addon) {
    element.dataset.addonUid = addon.uid;
    element.dataset.addonName = addon.name;
    element.dataset.addonPrice = addon.price;
    element.dataset.addonDesc = addon.desc || ''; // Ensure desc is not undefined
    element.dataset.addonPer = addon.per;
    element.dataset.addonType = addon.type;
}

function renderUsage1Addons(filteredAddons, guestCount, shiftName) {
    const addonsDisplayArea = getAddonsDisplayArea();
    const localConfig = getConfig();
    if (!filteredAddons || filteredAddons.length === 0) return;

    if (filteredAddons.length === 1) {
        const addon = filteredAddons[0];
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
        const totalUsage2Quantity = getTotalUsage2AddonQuantity(); // Use helper
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
    button.dataset.shiftUid = shiftObject.uid;
    const localLanguageStrings = getLanguageStrings();

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

export function displayTimeSlots(availabilityData, stickyTimeAttempt = null) {
    const timeSelectorContainer = getTimeSelectorContainer();
    const selectedTimeValueSpan = getSelectedTimeValueSpan();
    const areaSelectorContainer = getAreaSelectorContainer();
    const areaRadioGroupContainer = getAreaRadioGroupContainer();
    const areaAvailabilityMessage = getAreaAvailabilityMessage();
    const addonsDisplay = getAddonsDisplayArea();

    if (!timeSelectorContainer || !selectedTimeValueSpan) return;

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
    selectedTimeValueSpan.textContent = '-';
    setCurrentSelectedDecimalTime(null);
    setCurrentShiftUsagePolicy(null);

    if (addonsDisplay) addonsDisplay.innerHTML = '';
    resetCurrentSelectedAddonsUICallback();

    if (areaAvailabilityMessage) {
        areaAvailabilityMessage.textContent = '';
        areaAvailabilityMessage.style.display = 'none';
    }

    if (localConfig.arSelect === "true" && areaRadioGroupContainer) {
        areaRadioGroupContainer.innerHTML = '';
        const areas = availabilityData.areas;
        let radiosPopulated = false;
        let uidToSelect = getCurrentSelectedAreaUID();

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
            });
        }

        if (radiosPopulated && !getSelectedRadioValue("areaSelection")) {
            let defaultRadioToSelect = null;
            if (localConfig.areaAny === "true") {
                defaultRadioToSelect = areaRadioGroupContainer.querySelector('input[type="radio"][value="any"]');
            }
            if (!defaultRadioToSelect && areas && Array.isArray(areas) && areas.length > 0) {
                const firstSpecificAreaValue = areas[0].uid.toString();
                defaultRadioToSelect = areaRadioGroupContainer.querySelector(`input[type="radio"][value="${firstSpecificAreaValue}"]`);
            }
            if (defaultRadioToSelect) {
                defaultRadioToSelect.checked = true;
            }
        }
        if (!radiosPopulated) {
            setCurrentSelectedAreaUID(null);
        }
    }
    updateSelectedAreaDisplay();

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
    const isInitialLoad = getIsInitialRenderCycle();

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
            const shiftTitle = document.createElement('h3');
            shiftTitle.textContent = shift.name;
            timeSelectorContainer.appendChild(shiftTitle);
            if (shift.message && shift.message.trim() !== '') {
                const shiftMessageDiv = document.createElement('div');
                shiftMessageDiv.className = 'api-message shift-message';
                shiftMessageDiv.textContent = shift.message;
                timeSelectorContainer.appendChild(shiftMessageDiv);
            }
            const shiftButtonContainer = document.createElement('div');
            shiftButtonContainer.className = 'shift-times-wrapper';
            const currentShiftSessionTimes = shift.times;
            if (!currentShiftSessionTimes || !Array.isArray(currentShiftSessionTimes)) {console.warn("Shift has no session times"); }
            const actualBookableTimesForShiftInArea = selectedAreaGeneralTimes.filter(
                areaTime => currentShiftSessionTimes && currentShiftSessionTimes.includes(areaTime) && areaTime >= 0
            );
            if (actualBookableTimesForShiftInArea.length > 0) {
                currentShiftSessionTimes.forEach(timeValueFromShift => {
                    if (timeValueFromShift < 0 && !getShowUnavailableSlots()) return;
                    let buttonIsActive;
                    if (isInitialLoad && localConfig.areaAny === "false") {
                        buttonIsActive = true;
                    } else {
                        buttonIsActive = selectedAreaGeneralTimes.includes(timeValueFromShift);
                    }
                    if (timeValueFromShift < 0) buttonIsActive = false;
                    const button = createTimeSlotButton(timeValueFromShift, shift, buttonIsActive);
                    if (button) {
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShowOverall = true;
                    }
                });
            }
            timeSelectorContainer.appendChild(shiftButtonContainer);
        });
    } else {
        allShifts.forEach(shift => {
            if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }
            const shiftTitle = document.createElement('h3');
            shiftTitle.textContent = shift.name;
            timeSelectorContainer.appendChild(shiftTitle);
            if (shift.message && shift.message.trim() !== '') {
                const shiftMessageDiv = document.createElement('div');
                shiftMessageDiv.className = 'api-message shift-message';
                shiftMessageDiv.textContent = shift.message;
                timeSelectorContainer.appendChild(shiftMessageDiv);
            }
            const shiftButtonContainer = document.createElement('div');
            shiftButtonContainer.className = 'shift-times-wrapper';
            timeSelectorContainer.appendChild(shiftButtonContainer);
            if (Array.isArray(shift.times) && shift.times.length > 0) {
                shift.times.forEach(timeValue => {
                    const button = createTimeSlotButton(timeValue, shift, true);
                    if (button) {
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShowOverall = true;
                    }
                });
            } else {
                const noTimesMsg = document.createElement('p');
                noTimesMsg.className = 'no-times-for-shift-message';
                noTimesMsg.textContent = `No specific times listed for ${shift.name}.`;
                shiftButtonContainer.appendChild(noTimesMsg);
            }
        });
    }

    if (!foundAnySlotsToShowOverall) {
         timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
    }
    updateNextButtonState();

    if (stickyTimeAttempt !== null) {
        const allTimeSlotButtons = timeSelectorContainer.querySelectorAll('.time-slot-button.time-slot-available');
        let foundAndClickedStickyTime = false;
        allTimeSlotButtons.forEach(button => {
            if (parseFloat(button.dataset.time) === stickyTimeAttempt && !foundAndClickedStickyTime) {
                button.click();
                foundAndClickedStickyTime = true;
            }
        });
    }
}

export function resetTimeRelatedUI() {
    const timeSelectorContainer = getTimeSelectorContainer();
    const selectedTimeValueSpan = getSelectedTimeValueSpan();
    const addonsDisplay = getAddonsDisplayArea();

    if (timeSelectorContainer) timeSelectorContainer.innerHTML = '';
    if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
    if (addonsDisplay) addonsDisplay.innerHTML = '';

    resetCurrentAddonsUICallback(); // Corrected: Removed "Selected" from variable name
    updateNextButtonState();
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
