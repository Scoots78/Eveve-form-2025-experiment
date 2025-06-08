// --- UI Manager ---

import { getConfig, getLanguageStrings } from './config_manager.js';
import {
    getCurrentShiftUsagePolicy,
    getSelectedAddons,
    getShowUnavailableSlots,
    getCurrentSelectedAreaUID,
    setCurrentSelectedDecimalTime,
    setCurrentShiftUsagePolicy,
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

let resetCurrentSelectedAddonsUICallback = () => {
    const addonsDisplayArea = getAddonsDisplayArea();
    if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';
    const selectedAddonsValueSpan = getSelectedAddonsValueSpan();
    if (selectedAddonsValueSpan) selectedAddonsValueSpan.textContent = '-';
    const coversSelectorEl = getCoversSelector();
    const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) || 0 : 0;
    updateAllUsage2ButtonStatesUI(guestCount); // Ensure this is called
};

export function _setResetAddonsUICallback(callback) {
    resetCurrentSelectedAddonsUICallback = callback;
}

// Internal helper function
function getTotalUsage2AddonQuantity() {
    let total = 0;
    const currentAddons = getSelectedAddons();
    if (currentAddons && currentAddons.usage2) {
        currentAddons.usage2.forEach(addon => {
            total += addon.quantity;
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
            // Enable plus if total quantity is less than guest count.
            // Or if total quantity is equal, but this specific item can still be incremented (e.g. if it was previously decremented).
            // This logic is tricky because we don't know if the button click is for *this* item or another.
            // A simpler rule: disable plus if total quantity is already at or above guest count.
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
            itemCost = basePrice * addon.quantity;
            itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${itemCost.toFixed(2)})`;
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
    element.dataset.addonDesc = addon.desc;
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
        setAllAddonDataAttributes(qtyInput, addon); // Set all data attributes on the input

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
    button.dataset.shiftUid = shiftObject.uid; // For delegated event handler
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
            // Event listener is now delegated in event_handlers.js
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
            if (shift.message && shift.message.trim() !== '') { /* ... */ }
            const shiftButtonContainer = document.createElement('div');
            shiftButtonContainer.className = 'shift-times-wrapper';
            const currentShiftSessionTimes = shift.times;
            if (!currentShiftSessionTimes || !Array.isArray(currentShiftSessionTimes)) { /* ... */ }
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
            if (shift.message && shift.message.trim() !== '') { /* ... */ }
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

    resetCurrentSelectedAddonsUICallback();
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

// Helper function to ensure all necessary data attributes are set on addon elements
// This was not explicitly in the plan but is crucial for delegated event handling.
// Not exporting this as it's an internal convention for renderUsage* functions.
// Actually, this is better placed directly in each renderUsage* function for clarity.
// Removed: function setAllAddonDataAttributes(element, addon)

[end of ui_manager.js]

[start of event_handlers.js]
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
    updateSelectedAddonsDisplay as updateAddonsDisplayUI, // Corrected import with alias
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

[end of event_handlers.js]
