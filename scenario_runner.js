const { JSDOM } = require('jsdom');

// JSDOM setup
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <div id="areaRadioGroupContainer"></div>
  <div id="timeSelectorContainer"></div>
  <div id="selectedTimeValue"></div>
  <div id="addonsDisplayArea"></div>
  <div id="areaSelectorContainer"></div>
  <div id="areaAvailabilityMessage"></div>
  <div id="selectedAreaValue"></div>
  <span id="selectedTimeValueSpan"></span>
  <button id="nextButton"></button>
</body>
</html>
`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement; // For instanceof checks if any

// Mocks for dependencies of displayTimeSlots
const mockLocalConfig = {
    arSelect: "true",
    areaAny: "true",
    areaAnySelected: "false", // So it doesn't default to "any" if "any" is available
    currSym: "$",
    noTimesAvailable: "No time slots available (mock)"
};

const mockLocalLanguageStrings = {
    anyAreaText: "Any Area (mock)",
    noAvailabilityForAreaInSession: "No availability for {0} for this session (mock)",
    noTimesAvailable: "No time slots available (mock)",
    noAreaAvailableForSelection: "No areas available for selection (mock)",
    noAreasDefined: "No areas defined (mock)",
    notAvailableText: "Not Available (mock)",
    // Add other strings if displayTimeSlots needs them before erroring
};

let currentSelectedAreaUID = "any"; // Initial selection state
let currentSelectedDecimalTime = null;
let currentSelectedShiftName = null;

const getConfig = () => mockLocalConfig;
const getLanguageStrings = () => mockLocalLanguageStrings;
const getCurrentSelectedAreaUID = () => currentSelectedAreaUID;
const setCurrentSelectedAreaUID = (uid) => { currentSelectedAreaUID = uid; }; // Allow it to be set
const getShowUnavailableSlots = () => false;
const getCurrentSelectedDecimalTime = () => currentSelectedDecimalTime;
const getCurrentSelectedShiftName = () => currentSelectedShiftName;

// Mock other functions called by displayTimeSlots to avoid errors if they are not the focus
const getSelectedTimeValueSpan = () => document.getElementById('selectedTimeValueSpan');
const getAreaRadioGroupContainer = () => document.getElementById('areaRadioGroupContainer');
const getTimeSelectorContainer = () => document.getElementById('timeSelectorContainer');
const getAddonsDisplayArea = () => document.getElementById('addonsDisplayArea');
const getAreaSelectorContainer = () => document.getElementById('areaSelectorContainer');
const getAreaAvailabilityMessage = () => document.getElementById('areaAvailabilityMessage');
const updateSelectedAreaDisplay = (text) => {
    const el = document.getElementById('selectedAreaValue');
    if(el) el.textContent = text || '-';
    // console.log(`[MOCK] updateSelectedAreaDisplay called with: "${text}"`);
};
const resetCurrentAddonsUICallback = () => { /* console.log("[MOCK] resetCurrentAddonsUICallback called"); */ };
const updateNextButtonState = () => { /* console.log("[MOCK] updateNextButtonState called"); */ };

// Minimal mock for formatTime if needed by createTimeSlotButton
const formatTime = (decimalTime) => {
    const hours = Math.floor(decimalTime);
    const minutes = Math.round((decimalTime - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};


// Copied displayTimeSlots function from ui_manager.js (with debug logs)
// Ensure all its internal calls are either to global/native functions,
// the mocks above, or other functions also copied here.

function createTimeSlotButton(timeValue, shiftObject, isActive = true) {
    const button = document.createElement('button');
    button.className = 'time-slot-button';
    const localLanguageStrings = getLanguageStrings(); // Mocked
    let hasValidIdentifier = false;

    if (shiftObject && shiftObject.uid != null && String(shiftObject.uid).trim() !== '') {
        button.dataset.shiftUid = String(shiftObject.uid);
        hasValidIdentifier = true;
    } else if (shiftObject && shiftObject.name != null && String(shiftObject.name).trim() !== '') {
        button.dataset.shiftName = String(shiftObject.name);
        hasValidIdentifier = true;
    }

    if (!hasValidIdentifier) {
        // console.warn is noisy in test, use console.log for test visibility
        console.log("Time slot button created without a valid shift identifier (UID or Name):", shiftObject);
        button.classList.add('time-slot-no-identifier');
        isActive = false;
    }

    if (timeValue < 0) {
        if (!getShowUnavailableSlots()) return null; // Mocked
        button.textContent = localLanguageStrings.notAvailableText || 'Not Available';
        button.classList.add('time-slot-unavailable');
        button.disabled = true;
    } else {
        button.textContent = formatTime(timeValue); // formatTime needed
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


function displayTimeSlots(availabilityData, preserveAddons = false) {
    const timeSelectorContainer = getTimeSelectorContainer(); // Mocked DOM
    const areaSelectorContainer = getAreaSelectorContainer(); // Mocked DOM
    const areaRadioGroupContainer = getAreaRadioGroupContainer(); // Mocked DOM
    const areaAvailabilityMessage = getAreaAvailabilityMessage(); // Mocked DOM
    const addonsDisplay = getAddonsDisplayArea(); // Mocked DOM

    if (!timeSelectorContainer) {
        console.error("timeSelectorContainer not found in displayTimeSlots");
        return;
    }
    // getSelectedTimeValueSpan is a DOM getter, ensure it's mocked or the element exists
    if (!getSelectedTimeValueSpan()) {
         console.error("selectedTimeValueSpan (from getSelectedTimeValueSpan) not found; this might affect updateNextButtonState.");
    }

    const localConfig = getConfig(); // Mocked
    const localLanguageStrings = getLanguageStrings(); // Mocked

    if (localConfig.arSelect !== "true") {
        if (areaSelectorContainer) areaSelectorContainer.style.display = 'none';
        if (areaRadioGroupContainer) areaRadioGroupContainer.innerHTML = '';
        if (areaAvailabilityMessage) {
            areaAvailabilityMessage.textContent = '';
            areaAvailabilityMessage.style.display = 'none';
        }
    }

    if(timeSelectorContainer) timeSelectorContainer.innerHTML = '';

    if (!preserveAddons) {
        if (addonsDisplay) addonsDisplay.innerHTML = '';
        resetCurrentAddonsUICallback(); // Mocked
    }

    if (areaAvailabilityMessage) {
        areaAvailabilityMessage.textContent = '';
        areaAvailabilityMessage.style.display = 'none';
    }

    let currentSelectedAreaTextInSummary = '-';
    const allShiftsForAvailabilityCheck = availabilityData.shifts;

    if (localConfig.arSelect === "true" && areaRadioGroupContainer) {
        const currentSelectedAreaFromState = getCurrentSelectedAreaUID(); // Mocked
        areaRadioGroupContainer.innerHTML = '';
        const areas = availabilityData.areas;
        let radiosPopulated = false;
        let initialUidToSelect = currentSelectedAreaFromState;

        let SPUIDIsValidInNewData = false;
        if (initialUidToSelect) {
            if (initialUidToSelect === "any" && localConfig.areaAny === "true") {
                SPUIDIsValidInNewData = true;
            } else if (initialUidToSelect !== "any" && areas && Array.isArray(areas)) {
                SPUIDIsValidInNewData = areas.some(area => area.uid.toString() === initialUidToSelect);
            }
        }

        if (!SPUIDIsValidInNewData) {
            if (localConfig.areaAny === "true" && localConfig.areaAnySelected === "true") {
                initialUidToSelect = "any";
            } else if (areas && Array.isArray(areas) && areas.length > 0) {
                initialUidToSelect = areas[0].uid.toString();
            } else if (localConfig.areaAny === "true") {
                initialUidToSelect = "any";
            } else {
                initialUidToSelect = null;
            }
        }

        let areaAvailabilityInfo = [];

        if (typeof console !== 'undefined' && console.log) {
            console.log('[DEBUG] All shifts for availability check:', allShiftsForAvailabilityCheck ? JSON.parse(JSON.stringify(allShiftsForAvailabilityCheck)) : 'undefined');
            console.log('[DEBUG] All areas for availability check:', areas ? JSON.parse(JSON.stringify(areas)) : 'undefined');
        }

        let anyAreaRadio = null;
        let anyAreaLabel = null;
        if (localConfig.areaAny === "true") {
            const radioId = "area-any";
            const radioItemContainer = document.createElement('div');
            radioItemContainer.className = 'area-radio-item';
            anyAreaRadio = document.createElement('input');
            anyAreaRadio.type = 'radio'; anyAreaRadio.name = 'areaSelection'; anyAreaRadio.id = radioId; anyAreaRadio.value = 'any';
            anyAreaLabel = document.createElement('label');
            anyAreaLabel.htmlFor = radioId; anyAreaLabel.textContent = localLanguageStrings.anyAreaText || "Any Area";
            radioItemContainer.appendChild(anyAreaRadio); radioItemContainer.appendChild(anyAreaLabel);
            areaRadioGroupContainer.appendChild(radioItemContainer);
            radiosPopulated = true;

            areaAvailabilityInfo.push({
                uid: "any",
                name: anyAreaLabel.textContent,
                radioElement: anyAreaRadio,
                labelElement: anyAreaLabel,
                isAvailable: true,  // Placeholder, will be refined
                isOriginallySelected: (initialUidToSelect === 'any')
            });
        }

        let atLeastOneSpecificAreaIsAvailable = false;
        if (areas && Array.isArray(areas) && areas.length > 0) {
            areas.forEach((area) => {
                const radioId = `area-${area.uid}`;
                const radioItemContainer = document.createElement('div');
                radioItemContainer.className = 'area-radio-item';
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'areaSelection'; radio.id = radioId; radio.value = area.uid.toString();
                const label = document.createElement('label');
                label.htmlFor = radioId; label.textContent = area.name;

                if (typeof console !== 'undefined' && console.log) {
                    console.log(`[DEBUG] Processing Area: ${area.name} (UID: ${area.uid})`, area.times ? JSON.parse(JSON.stringify(area.times)) : 'no times');
                }

                let isAreaAvailableForAnyShift = false;
                if (area.times && area.times.length > 0 && allShiftsForAvailabilityCheck && allShiftsForAvailabilityCheck.length > 0) {
                    for (const shift of allShiftsForAvailabilityCheck) {
                        if (typeof console !== 'undefined' && console.log && (area.name === "Outside area" || area.short === "Outside")) {
                            console.log(`[DEBUG] Area "${area.name}" checking against Shift: ${shift.name}`, shift.times ? JSON.parse(JSON.stringify(shift.times)) : 'no shift times');
                        }

                        let commonTimesFoundDebug = [];
                        if (shift.times && shift.times.some(st => {
                            if (st >= 0 && area.times.includes(st)) {
                                commonTimesFoundDebug.push(st);
                                return true;
                            }
                            return false;
                        })) {
                            isAreaAvailableForAnyShift = true;
                            atLeastOneSpecificAreaIsAvailable = true;
                            if (typeof console !== 'undefined' && console.log && (area.name === "Outside area" || area.short === "Outside")) {
                                console.log(`[DEBUG] Area "${area.name}" FOUND overlap with Shift "${shift.name}". Common:`, JSON.parse(JSON.stringify(commonTimesFoundDebug)));
                            }
                            break;
                        } else {
                            if (typeof console !== 'undefined' && console.log && (area.name === "Outside area" || area.short === "Outside")) {
                                 console.log(`[DEBUG] Area "${area.name}" NO overlap with Shift "${shift.name}". Common:`, JSON.parse(JSON.stringify(commonTimesFoundDebug)));
                            }
                        }
                    }
                }

                if (typeof console !== 'undefined' && console.log) {
                    console.log(`[DEBUG] Area "${area.name}" - isAreaAvailableForAnyShift: ${isAreaAvailableForAnyShift}`);
                }

                if (!isAreaAvailableForAnyShift) {
                    radio.disabled = true;
                    if (typeof console !== 'undefined' && console.log) {
                        console.log(`[DEBUG] Area "${area.name}" - radio.disabled SET TO TRUE`);
                    }
                    const unavailableMsgSpan = document.createElement('span');
                    unavailableMsgSpan.className = 'area-unavailability-message';
                    const msgTemplate = localLanguageStrings.noAvailabilityForAreaInSession || 'No availability for {0} for this session';
                    unavailableMsgSpan.textContent = ` (${msgTemplate.replace('{0}', area.name)})`;

                    label.appendChild(unavailableMsgSpan);
                    if (typeof console !== 'undefined' && console.log) {
                        console.log(`[DEBUG] Area "${area.name}" - Message span appended with text: "${unavailableMsgSpan.textContent}"`);
                    }
                } else {
                    if (typeof console !== 'undefined' && console.log) {
                        console.log(`[DEBUG] Area "${area.name}" - radio.disabled REMAINS FALSE (or default)`);
                    }
                }

                radioItemContainer.appendChild(radio); radioItemContainer.appendChild(label);
                areaRadioGroupContainer.appendChild(radioItemContainer);
                radiosPopulated = true;

                areaAvailabilityInfo.push({
                    uid: area.uid.toString(),
                    name: area.name,
                    radioElement: radio,
                    labelElement: label,
                    isAvailable: isAreaAvailableForAnyShift,
                    isOriginallySelected: (initialUidToSelect === area.uid.toString())
                });
            });
        }

        const anyAreaEntry = areaAvailabilityInfo.find(a => a.uid === "any");
        if (anyAreaEntry) {
            const generalSlotsExist = allShiftsForAvailabilityCheck && allShiftsForAvailabilityCheck.some(shift =>
                shift.times && shift.times.some(time => time >= 0) &&
                (!availabilityData.areas || availabilityData.areas.length === 0)
            );
            anyAreaEntry.isAvailable = generalSlotsExist || atLeastOneSpecificAreaIsAvailable;
            if (!anyAreaEntry.isAvailable && anyAreaEntry.radioElement) {
                anyAreaEntry.radioElement.disabled = true;
                 const unavailableMsgSpan = document.createElement('span');
                 unavailableMsgSpan.className = 'area-unavailability-message';
                 // Corrected placeholder for Any Area name
                 const anyAreaName = anyAreaEntry.name || 'Any Area';
                 unavailableMsgSpan.textContent = ` (${(localLanguageStrings.noAvailabilityForAreaInSession || `No availability for {0} for this session`).replace('{0}', anyAreaName)})`;
                 if (anyAreaEntry.labelElement) anyAreaEntry.labelElement.appendChild(unavailableMsgSpan);
            }
        }

        let finalUidToSelect = null;
        const originalSelection = areaAvailabilityInfo.find(a => a.uid === initialUidToSelect);

        if (originalSelection && originalSelection.isAvailable) {
            finalUidToSelect = initialUidToSelect;
        } else {
            const anyAreaSelectable = anyAreaEntry && anyAreaEntry.isAvailable;
            if (anyAreaSelectable && localConfig.areaAnySelected === "true") {
                finalUidToSelect = "any";
            } else {
                const firstAvailableSpecific = areaAvailabilityInfo.find(a => a.uid !== "any" && a.isAvailable);
                if (firstAvailableSpecific) {
                    finalUidToSelect = firstAvailableSpecific.uid;
                } else if (anyAreaSelectable) {
                    finalUidToSelect = "any";
                } else {
                    finalUidToSelect = null;
                }
            }
        }

        currentSelectedAreaTextInSummary = '-';
        let anAreaWasSelected = false;
        areaAvailabilityInfo.forEach(areaInfo => {
            if (areaInfo.radioElement) {
                if (areaInfo.uid === finalUidToSelect && areaInfo.isAvailable) {
                    areaInfo.radioElement.checked = true;
                    currentSelectedAreaTextInSummary = areaInfo.name;
                    anAreaWasSelected = true;
                } else {
                    areaInfo.radioElement.checked = false;
                }
            }
        });

        if (!anAreaWasSelected) {
             currentSelectedAreaTextInSummary = localLanguageStrings.noAreaAvailableForSelection || "No areas available";
        }

        if (!radiosPopulated && localConfig.arSelect === "true") {
             updateSelectedAreaDisplay(localLanguageStrings.noAreasDefined || "No areas defined."); // Mocked
        } else {
             updateSelectedAreaDisplay(currentSelectedAreaTextInSummary); // Mocked
        }

    } else if (areaRadioGroupContainer) {
         updateSelectedAreaDisplay(null); // Mocked
         areaRadioGroupContainer.innerHTML = '';
    }

    // The rest of the function deals with rendering time slots, not critical for area logs
    // but include for completeness and to avoid breaking if it tries to run.
    const allShifts = availabilityData.shifts;
    let foundAnySlotsToShowOverall = false;

    if (!allShifts || !Array.isArray(allShifts) || allShifts.length === 0) {
        if(timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
        updateNextButtonState(); // Mocked
        return;
    }

    // Simplified remaining logic as it's not the focus for logs
    allShifts.forEach(shift => {
        if (!shift || typeof shift.name !== 'string') { console.log("Invalid shift object:", shift); return; }
        const displayableTimes = shift.times ? shift.times.filter(timeValue => timeValue >= 0 || getShowUnavailableSlots()) : [];
        if (displayableTimes.length > 0) {
            foundAnySlotsToShowOverall = true;
        }
    });

    if (!foundAnySlotsToShowOverall && timeSelectorContainer) {
         timeSelectorContainer.innerHTML = `<p class="no-times-message">${localLanguageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
    }
    updateNextButtonState(); // Mocked
}


// --- Main execution ---
const mockAvailabilityData = {
    shifts: [
        { name: "Early Bird", uid: "s1", times: [17.00, 17.50, 18.00, 18.50] },
        { name: "Dinner Late", uid: "s2", times: [22.00, 22.50, 23.00, 23.50, 24.00, 24.50, 25.00, 25.50] },
        { name: "Lunch", uid: "s3", times: [12.00, 12.50, 13.00, 13.50, 14.00] }
    ],
    areas: [
        { uid: "1000", name: "Inside Main", short: "Inside", times: [12.00, 12.50, 13.00, 13.50, 14.00, 17.00, 17.50, 18.00, 18.50, 22.00, 22.50, 23.00] },
        { uid: "1001", name: "Outside area", short: "Outside", times: [9.00,9.50,10.00,12.00,12.50,13.00,13.50,14.00,17.00,17.50,18.00,18.50,19.00,19.50,20.00] },
        { uid: "1002", name: "Patio", short: "Patio", times: [12.00, 12.50, 13.00, 13.50, 14.00, 17.00, 17.50, 18.00, 18.50, 19.00, 19.50, 20.00, 22.00, 22.50] }
    ],
    message: "Test data for debug."
};

console.log("--- Starting displayTimeSlots test ---");
displayTimeSlots(mockAvailabilityData);
console.log("--- Finished displayTimeSlots test ---");
