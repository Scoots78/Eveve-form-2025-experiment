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
    getIsInitialRenderCycle,
    setCurrentBookingUid, // Existing import
    setEstForConfirmation,
    setLngForConfirmation,
    setRestaurantFullNameFromHold,
    getCurrentBookingUid,
    getEstForConfirmation,
    getLngForConfirmation,
    clearConfirmationContext, // Existing import
    setSelectedDateForSummary,
    setSelectedCoversForSummary,
    setSelectedAreaNameForSummary,
    setSelectedAddonsForContext, // Existing import
    getSelectedAddonsForContext, // Added import
    // setActiveEvents, // Removed as activeEvents state is removed
    setSelectedEventDetails, // Existing import
    getSelectedEventDetails // Added back for event handling
} from './state_manager.js';
// Removed: import { eventsB, showEventsFeature } from './event_data.js';
import { getEventsB, getShowEventsFlag, getEventMessages } from './config_manager.js'; // Added
import {
    displayTimeSlots,
    renderAddons,
    updateSelectedAddonsDisplay as updateAddonsDisplayUI,
    updateNextButtonState as updateNextBtnUI,
    updateSelectedAreaDisplay, // Changed: No alias, direct use
    updateDailyRotaMessage,
    showLoadingTimes,
    displayErrorMessageInTimesContainer,
    resetTimeRelatedUI,
    showTimeSelectionSummary,
    showTimeSelectionAccordion,
    updateAllUsage2ButtonStatesUI, // Added import
    showAreaSelector, // Added import
    hideAreaSelector, // Added import
    showLoadingOverlay,
    hideLoadingOverlay,
    showCustomerDetailsView, // Existing import
    showBookingSelectionView // Added import
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

// --- Shift Change Specific Handler ---
export function handleShiftChangeClearSelection() {
    // 1. Reset selected time and shift name in state
    setCurrentSelectedDecimalTime(null); // This should also clear the shift name in state_manager
    setSelectedEventDetails(null); // Clear any selected event details

    // 2. Update selected time display in summary
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
    if (selectedTimeValueSpan) {
        selectedTimeValueSpan.textContent = '-';
    }

    // 3. Reset selected addons
    resetStateAddons();
    updateAddonsDisplayUI(); // Updates summary text for addons

    // --- Modified DOM CLEARING LOGIC for addonsDisplayArea ---
    const addonsDisplayArea = document.getElementById('addonsDisplayArea');
    if (addonsDisplayArea) {
        addonsDisplayArea.innerHTML = ''; // Clear any previous addon input elements
        addonsDisplayArea.style.display = 'none'; // Hide the container
    }
    // --- END OF MODIFIED LOGIC ---

    // 4. Hide area selector and clear area state/display
    hideAreaSelector();
    setCurrentSelectedAreaUID(null);
    updateSelectedAreaDisplay(null);

    // 5. Update Next button state
    updateNextBtnUI();

    // 6. Accordion visibility is handled by the caller in ui_manager.js (h3 click listener)
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
        setCurrentSelectedDecimalTime(null);
        setSelectedEventDetails(null); // Clear selected event
        // setActiveEvents([]); // No longer needed, activeEvents state removed
        updateDailyRotaMessage('');
        updateNextBtnUI();
        return;
    }

    const localLanguageStrings = getLanguageStrings();
    const localCurrentEstName = getCurrentEstName();

    updateDailyRotaMessage('');
    resetTimeRelatedUI();
    setCurrentShiftUsagePolicy(null);
    setSelectedEventDetails(null); // Clear selected event details when date/covers change
    // setActiveEvents([]); // No longer needed

    if (!selectedDateStr || selectedDateStr < getTodayDateString()) {
        const messageKey = !selectedDateStr ? 'errorInvalidInput' : 'errorDateInPast';
        const defaultMessage = !selectedDateStr ? 'Please select a valid date.' : 'Selected date is in the past. Please choose a current or future date.';
        if (document.getElementById('time-selection-section').style.display !== 'none') {
            displayErrorMessageInTimesContainer(messageKey, defaultMessage);
        }
        if(selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
        if(selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value;

        updateSelectedAreaDisplay(null);
        updateNextBtnUI();
        return;
    }

    if(selectedDateValueSpan) selectedDateValueSpan.textContent = selectedDateStr || '-';
    if(selectedCoversValueSpan && coversDisplay) selectedCoversValueSpan.textContent = coversDisplay.value;

    setCurrentSelectedDecimalTime(null);
    setCurrentSelectedAreaUID(null);
    updateSelectedAreaDisplay(null);
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

        // The API response (availabilityData.shifts) is now the source of truth for what to display.
        // No need to separately filter/set activeEvents from config.eventsB here for display purposes.
        // setActiveEvents([]) was already called during resetTimeRelatedUI or if covers are 0.
        // If activeEvents state is to be removed, this call might not be strictly necessary
        // but harmless for now if it's just clearing.
        // setActiveEvents([]); // Let's remove this to avoid confusion, as its role is changing.

        const currentAvailData = getCurrentAvailabilityData(); // This contains the .shifts array from API
        updateDailyRotaMessage(currentAvailData ? currentAvailData.message : '');

        if (currentAvailData && currentAvailData.shifts && currentAvailData.shifts.length > 0) {
            displayTimeSlots(currentAvailData); // Pass the whole availabilityData
        } else {
            // If currentAvailData is null or has no shifts/events from API
            displayErrorMessageInTimesContainer('errorLoadingTimes', 'No shifts or events available for this selection.');
            setCurrentShiftUsagePolicy(null);
            updateNextBtnUI();
        }
    } catch (error) {
        console.error('Error during availability fetch/processing in handleDateOrCoversChange:', error);
        displayErrorMessageInTimesContainer('errorLoadingTimes', 'Could not load times. Please try again.');
        setCurrentShiftUsagePolicy(null);
        // setActiveEvents([]); // If activeEvents state is being removed.
        updateNextBtnUI();
    }
}

export function handleAreaChange() { // No longer async
    const coversDisplay = document.getElementById('covers-display');
    const coversValue = coversDisplay ? parseInt(coversDisplay.value, 10) : 0;

    const selectedTime = getCurrentSelectedDecimalTime();
    const selectedShiftName = getCurrentSelectedShiftName();
    const availabilityData = getCurrentAvailabilityData();
    const newlySelectedAreaUID = getCurrentSelectedAreaUID();
    const localLanguageStrings = getLanguageStrings(); // For addon messages

    // If critical data is missing, update button and exit
    if (selectedTime === null || !selectedShiftName || !availabilityData || !availabilityData.shifts) {
        console.warn("handleAreaChange: Missing critical data (time, shift name, or availability data). Cannot update addons.");
        updateNextBtnUI();
        return;
    }

    const shiftObject = availabilityData.shifts.find(s => s.name === selectedShiftName);

    if (!shiftObject) {
        console.warn(`handleAreaChange: Shift object not found for name: ${selectedShiftName}. Cannot update addons.`);
        updateNextBtnUI();
        return;
    }

    // 1. Re-render Addons based on the new area
    resetStateAddons(); // Clear previous addon choices for the new area context

    if (shiftObject.addons && Array.isArray(shiftObject.addons)) {
        renderAddons(shiftObject.addons, shiftObject.usage, coversValue, shiftObject.name, newlySelectedAreaUID);
    } else {
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        if (addonsDisplayArea) {
            addonsDisplayArea.innerHTML = `<p>${localLanguageStrings.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
            addonsDisplayArea.style.display = 'block';
        }
    }
    updateAddonsDisplayUI(); // Update the summary of selected addons

    // 2. Update Next Button state
    updateNextBtnUI();

    // Note: displayTimeSlots() and fetchAvailableTimes() are NOT called here.
    // The area radio button states are updated by timeSlotDelegatedListener when a new time is picked.
    // updateSelectedAreaDisplay() is handled by the 'change' event listener on areaRadioGroupContainer.
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
    const timeToSubmit = getCurrentSelectedDecimalTime(); // This will be event time if event is selected
    const selectedEvent = getSelectedEventDetails();

    let areaToSubmit = null;
    let loadingMessage = `One moment, we're holding your spot at ${localCurrentEstName}...`;

    const holdApiData = {
        est,
        lng: language,
        covers: parseInt(numCovers, 10),
        date: selectedDate,
        time: timeToSubmit
        // Addons will be added later if they exist
    };

    if (selectedEvent) {
        holdApiData.eventId = selectedEvent.uid;
        holdApiData.eventName = selectedEvent.name; // For backend logging or direct use
        // Area is typically null for events, unless specific event logic dictates otherwise
        holdApiData.area = null;
        loadingMessage = `One moment, we're holding your spot for ${selectedEvent.name}...`;
    } else {
        // Only set area if it's a shift booking and area selection is active
        if (localConfig.arSelect === "true" && getCurrentSelectedAreaUID() && getCurrentSelectedAreaUID() !== "any") {
            areaToSubmit = getCurrentSelectedAreaUID();
        }
        holdApiData.area = areaToSubmit;
    }

    const addonsString = formatSelectedAddonsForApi(getSelectedAddons());
    if (addonsString && addonsString.trim() !== "") {
        holdApiData.addons = addonsString;
    }

    if (!selectedDate || timeToSubmit === null || !numCovers || !est) {
        console.error("Missing required data for hold call:", { selectedDate, timeToSubmit, numCovers, est, event: selectedEvent, area: holdApiData.area, addons: addonsString });
        return;
    }

    showLoadingOverlay(loadingMessage);
    console.log("Event Handlers - Hold API Call Data to be sent:", holdApiData);

    try {
        const holdResponse = await holdBooking(holdApiData);
        console.log("Event Handlers - Hold API Response:", holdResponse);

        if (holdResponse && holdResponse.ok === true) {
            // Store all necessary context from the successful hold
            setCurrentBookingUid(holdResponse.uid);
            setEstForConfirmation(localCurrentEstName);
            setLngForConfirmation(language);
            setRestaurantFullNameFromHold(holdResponse.full);

            // Capture details for summary display
            const pageCalendarTopBar = document.getElementById('calendar-top-bar'); // Renamed to avoid conflict
            const dateForSummary = pageCalendarTopBar ? pageCalendarTopBar.dataset.selectedDate : null;
            setSelectedDateForSummary(dateForSummary);

            const pageCoversDisplay = document.getElementById('covers-display'); // Renamed to avoid conflict
            const coversForSummary = pageCoversDisplay ? parseInt(pageCoversDisplay.value) : null;
            setSelectedCoversForSummary(coversForSummary);

            const currentSelectedAreaUID = getCurrentSelectedAreaUID(); // Renamed to avoid conflict
            const currentAvailabilityData = getCurrentAvailabilityData(); // Renamed to avoid conflict
            let areaNameForSummary = null;
            if (currentSelectedAreaUID && currentSelectedAreaUID !== 'any' && currentAvailabilityData && currentAvailabilityData.areas) {
                const areaObject = currentAvailabilityData.areas.find(a => a.uid.toString() === currentSelectedAreaUID);
                if (areaObject) {
                    areaNameForSummary = areaObject.name;
                }
            } else if (currentSelectedAreaUID === 'any') {
                const langStrings = getLanguageStrings();
                areaNameForSummary = langStrings.anyAreaSelectedText || 'Any Available';
            }
            setSelectedAreaNameForSummary(areaNameForSummary);

            // Store selected addons for context/summary
            setSelectedAddonsForContext(getSelectedAddons());

            // The loading overlay ("holding your spot...") will be hidden by the 'finally' block.
            // Then, switch to the customer details view.
            showCustomerDetailsView();

            // Optional: If a brief "Spot held!" message is desired on the overlay before it's hidden
            // and the view switches, it could be done here:
            // showLoadingOverlay('Your spot is held! Please provide your details.');
            // However, the 'finally' block will hide it. If the transition is quick,
            // this message might not be visible for long or might cause a flicker.
            // For now, relying on the finally block to hide the "holding..." message
            // and then immediately showing the new view is cleaner.

        } else {
            // Handle business logic errors (e.g., spot no longer available)
            const errorMessage = (holdResponse && holdResponse.msg) ? holdResponse.msg : 'Failed to hold your spot. Please try again.';
            // The loading overlay will be hidden by the 'finally' block.
            alert(errorMessage);
            // No view change, stay on booking selection.
        }
    } catch (error) {
        console.error("Event Handlers - Error during holdBooking call:", error);
        const localLanguageStrings = getLanguageStrings();
        alert(localLanguageStrings.errorGeneric || "An error occurred while trying to complete your booking. Please try again.");
        // The 'finally' block handles hiding the overlay.
    } finally {
        // This ensures the overlay is hidden if no redirection occurs (e.g. error)
        // or before switching to the customer details view on success.
        hideLoadingOverlay();
    }
}

function timeSlotDelegatedListener(event) {
    // Target both shift and event time buttons that are available
    const button = event.target.closest('.time-slot-button.time-slot-available, .event-time-button.time-slot-available');

    if (button && !button.disabled) {
        const timeSelectorContainer = document.getElementById('timeSelectorContainer');
        if (timeSelectorContainer) {
            // Clear selection from all potentially selected buttons (shifts or events)
            timeSelectorContainer.querySelectorAll('.time-slot-button-selected, .event-time-button-selected').forEach(btn => {
                btn.classList.remove('time-slot-button-selected');
                btn.classList.remove('event-time-button-selected');
            });
        }
        // Add the appropriate selection class based on button type
        const isEventButton = button.classList.contains('event-time-button');
        button.classList.add(isEventButton ? 'event-time-button-selected' : 'time-slot-button-selected');

        const timeValue = parseFloat(button.dataset.time);
        const selectedTimeValueSpan = document.getElementById('selectedTimeValue');

        if (isEventButton) {
            const eventUid = button.dataset.eventUid;
            // Fetch canonical event details from config_manager
            const canonicalEvents = getEventsB();
            const canonicalEventObject = canonicalEvents.find(e => e.uid.toString() === eventUid);

            if (canonicalEventObject) {
                // The event item from the API (`availabilityData.shifts`) might have day-specific details
                // like a modified name or specific times. For `setSelectedEventDetails`, we want the
                // canonical details from `config.eventsB` primarily, plus the selected time.
                // The API's event item name was used for panel title.
                // The API's event item times were used for buttons.
                // The modal uses canonical desc.
                setSelectedEventDetails({
                    ...canonicalEventObject, // Use all details from canonical definition
                    selectedTime: timeValue  // Add the specific time slot that was clicked
                });

                setCurrentSelectedDecimalTime(timeValue, null); // Set global time, clear shift name
                setCurrentShiftUsagePolicy(null); // Events might have different addon logic if implemented
                resetStateAddons();
                updateAddonsDisplayUI();

                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = formatTime(timeValue);
                // Use canonicalEventObject.name for the summary, as it's the full, official name
                showTimeSelectionSummary(canonicalEventObject.name, formatTime(timeValue));

                hideAreaSelector();
                setCurrentSelectedAreaUID(null);
                updateSelectedAreaDisplay(null);

                const addonsDisplayArea = document.getElementById('addonsDisplayArea');
                if (addonsDisplayArea) {
                    addonsDisplayArea.innerHTML = '';
                    addonsDisplayArea.style.display = 'none';
                }
            } else {
                console.error(`Canonical event details not found for UID: ${eventUid} in config.eventsB.`);
                setSelectedEventDetails(null); // Clear if we can't find details
                setCurrentSelectedDecimalTime(null, null); // Clear time
                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
                // Consider resetting showTimeSelectionSummary or showing an error
            }
        } else { // It's a shift button
            setSelectedEventDetails(null); // Clear any selected event

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

            // --- EXISTING SHIFT AREA AUTO-SWITCH LOGIC ---
            if (shiftObject && button.classList.contains('time-slot-partial-area')) {
                let newAreaUidToSelect = null;
                const localConfig = getConfig();
                const selectedTime = timeValue;

                if (localConfig.areaAny === "true") {
                    const anyAreaRadio = document.getElementById('area-any');
                    if (anyAreaRadio) {
                        newAreaUidToSelect = "any";
                    }
                }

                if (newAreaUidToSelect === null) {
                    if (availabilityData && availabilityData.areas && Array.isArray(availabilityData.areas)) {
                        for (const area of availabilityData.areas) {
                            if (area.times && area.times.includes(selectedTime)) {
                                newAreaUidToSelect = area.uid.toString();
                                break;
                            }
                        }
                    }
                }
                if (newAreaUidToSelect !== null) {
                    setCurrentSelectedAreaUID(newAreaUidToSelect);
                }
            }
            // --- END OF EXISTING SHIFT AREA AUTO-SWITCH LOGIC ---

            if (shiftObject) {
                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = formatTime(timeValue);
                setCurrentSelectedDecimalTime(timeValue, shiftObject.name);
                setCurrentShiftUsagePolicy((shiftObject && typeof shiftObject.usage !== 'undefined') ? shiftObject.usage : null);
                resetStateAddons();
                updateAddonsDisplayUI();
                const coversDisplay = document.getElementById('covers-display');
                const guestCount = parseInt(coversDisplay.value);
                updateAllUsage2ButtonStatesUI(guestCount);
                const currentAreaUID = getCurrentSelectedAreaUID();

                if (shiftObject.addons && Array.isArray(shiftObject.addons)) {
                    renderAddons(shiftObject.addons, shiftObject.usage, guestCount, shiftObject.name, currentAreaUID);
                } else {
                    const addonsDisplayArea = document.getElementById('addonsDisplayArea');
                    const lang = getLanguageStrings();
                    if (addonsDisplayArea) {
                        addonsDisplayArea.innerHTML = `<p>${lang.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
                        addonsDisplayArea.style.display = 'block';
                    }
                }
                showTimeSelectionSummary(shiftObject.name, formatTime(timeValue));

                const localConfig = getConfig();
                const localLanguageStrings = getLanguageStrings();
                const areaRadioGroupContainer = document.getElementById('areaRadioGroupContainer');

                if (localConfig.arSelect === "true" && areaRadioGroupContainer) {
                    const selectedTime = timeValue;
                    const allAreaRadioItems = areaRadioGroupContainer.querySelectorAll('.area-radio-item');
                    let areaWasSelectedThisCycle = false;

                    allAreaRadioItems.forEach(item => {
                        const radio = item.querySelector('input[type="radio"]');
                        const messageSpan = item.querySelector('.area-availability-message-span');
                        if (!radio || !messageSpan) return;

                        let isAvailable = false;
                        let areaNameForMessage = '';

                        if (radio.value === 'any') {
                            isAvailable = shiftObject?.times?.includes(selectedTime) ?? false;
                            areaNameForMessage = localLanguageStrings.anyAreaText || "Any Area";
                        } else {
                            const areaUidRadio = radio.value; // Renamed to avoid conflict with outer scope areaUid
                            const areaObject = availabilityData.areas?.find(a => a.uid.toString() === areaUidRadio);
                            isAvailable = areaObject?.times?.includes(selectedTime) ?? false;
                            areaNameForMessage = areaObject?.name || areaUidRadio;
                        }

                        radio.disabled = !isAvailable;
                        if (isAvailable) {
                            messageSpan.textContent = '';
                            messageSpan.style.display = 'none';
                        } else {
                            const msgTemplate = localLanguageStrings.noAvailabilityForAreaAtTime || "No availability for {0} for this time";
                            messageSpan.textContent = msgTemplate.replace('{0}', areaNameForMessage);
                            messageSpan.style.display = 'inline';
                        }
                    });

                    let uidToSelect = null;
                    const currentSelectedAreaFromState = getCurrentSelectedAreaUID();
                    const anyAreaRadioElement = areaRadioGroupContainer.querySelector('input[name="areaSelection"][value="any"]');
                    const anyAreaIsEnabled = anyAreaRadioElement && !anyAreaRadioElement.disabled;

                    if (currentSelectedAreaFromState) {
                        const currentRadio = areaRadioGroupContainer.querySelector(`input[name="areaSelection"][value="${currentSelectedAreaFromState}"]`);
                        if (currentRadio && !currentRadio.disabled) {
                            uidToSelect = currentSelectedAreaFromState;
                        }
                    }

                    if (uidToSelect === null && anyAreaIsEnabled) {
                        uidToSelect = "any";
                    }

                    if (uidToSelect === null) {
                        const specificAreaRadios = areaRadioGroupContainer.querySelectorAll('input[name="areaSelection"]:not([value="any"])');
                        for (const specificRadio of specificAreaRadios) {
                            if (!specificRadio.disabled) {
                                uidToSelect = specificRadio.value;
                                break;
                            }
                        }
                    }

                    let selectedLabelText = null;
                    allAreaRadioItems.forEach(item => {
                        const radio = item.querySelector('input[type="radio"]');
                        if (radio) {
                            radio.checked = (radio.value === uidToSelect);
                            if (radio.checked) {
                                areaWasSelectedThisCycle = true;
                                const label = item.querySelector('label');
                                selectedLabelText = label ? label.textContent : radio.value;
                            }
                        }
                    });

                    setCurrentSelectedAreaUID(uidToSelect);

                    if (areaWasSelectedThisCycle && selectedLabelText) {
                        const mainLabelText = selectedLabelText.split(" (")[0];
                        updateSelectedAreaDisplay(mainLabelText);
                    } else {
                        updateSelectedAreaDisplay(localLanguageStrings.noAreaAvailableForTimeSlot || "No areas available for this time.");
                    }

                    showAreaSelector();
                } else if (localConfig.arSelect !== "true") {
                    setCurrentSelectedAreaUID(null);
                    updateSelectedAreaDisplay(null);
                    hideAreaSelector();
                }
            } else {
                console.warn(`Shift object not found for time slot button. Attempted UID: ${shiftUidFromDataset}, Attempted Name: ${shiftNameFromDataset}`, button);
                hideAreaSelector();
                setCurrentSelectedAreaUID(null);
                updateSelectedAreaDisplay(null);
            }
        }
        updateNextBtnUI(); // Update next button state for both event and shift selections
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
                const areaId = event.target.value;
                setCurrentSelectedAreaUID(areaId);

                // Determine text for display
                let areaNameToDisplay;
                const languageStrings = getLanguageStrings();
                if (areaId === "any") {
                    areaNameToDisplay = languageStrings.anyAreaSelectedText || "Any";
                } else {
                    const label = areaRadioGroupContainer.querySelector(`label[for="${event.target.id}"]`);
                    areaNameToDisplay = label ? label.textContent : areaId;
                }
                updateSelectedAreaDisplay(areaNameToDisplay); // Update UI immediately

                handleAreaChange(); // Then handle data fetching & further logic
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

    const customerDetailsForm = document.getElementById('customerDetailsFormSPA');
    if (customerDetailsForm) {
        customerDetailsForm.addEventListener('submit', handleConfirmBookingSubmit);
    }

    const goBackButton = document.getElementById('goBackButton');
    if (goBackButton) {
        goBackButton.addEventListener('click', handleGoBackToBookingSelection);
    }
}

export function handleGoBackToBookingSelection() {
    console.log('Go Back button clicked. Returning to booking selection.');
    showBookingSelectionView();
    clearConfirmationContext();
}

export async function handleConfirmBookingSubmit(event) {
    event.preventDefault();

    const bookingUid = getCurrentBookingUid();
    const est = getEstForConfirmation();
    const lng = getLngForConfirmation();
    const addonsContextObject = getSelectedAddonsForContext(); // Get addons context

    if (!bookingUid || !est || !lng) {
        alert('Error: Booking session details are missing. Please try again from the start.');
        // Consider additional logic here, e.g., showBookingSelectionView();
        return;
    }

    const firstName = document.getElementById('firstNameSPA').value;
    const lastName = document.getElementById('lastNameSPA').value;
    const phone = document.getElementById('phoneSPA').value;
    const email = document.getElementById('emailSPA').value;
    const notes = document.getElementById('notesSPA').value;
    const mailOptIn = document.getElementById('mailOptInSPA').checked;
    const optem = mailOptIn ? '1' : '0';

    if (!(firstName || lastName) || !(phone || email)) {
        alert('Please provide either a first or last name, and either a phone number or an email address.');
        return;
    }

    const baseUrl = 'https://nz.eveve.com/web/update';
    const formattedAddonsString = formatSelectedAddonsForApi(addonsContextObject);

    const queryParamsData = {
        est: est,
        uid: bookingUid,
        lng: lng,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        notes: notes,
        optem: optem
    };

    if (formattedAddonsString && formattedAddonsString.trim() !== "") {
        queryParamsData.addons = formattedAddonsString;
    }

    const queryParams = new URLSearchParams(queryParamsData);
    const apiUrl = `${baseUrl}?${queryParams.toString()}`;
    console.log("Confirm Booking API URL:", apiUrl);

    const confirmButton = document.getElementById('confirmBookingButtonSPA');
    const goBackButton = document.getElementById('goBackButton');
    const confirmationMessageArea = document.getElementById('confirmationMessageArea');

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Confirming...';
    }
    if (goBackButton) goBackButton.style.display = 'none';

    if (confirmationMessageArea) {
        confirmationMessageArea.textContent = '';
        confirmationMessageArea.style.display = 'none';
    }

    try {
        const response = await fetch(apiUrl, { method: 'PATCH' });
        const responseData = await response.json();

        if (response.ok && responseData.ok === true) {
            if (confirmationMessageArea) {
                confirmationMessageArea.textContent = 'Booking confirmed successfully!';
                confirmationMessageArea.className = 'api-message success-message';
                confirmationMessageArea.style.display = 'block';
            } else {
                alert('Booking confirmed successfully!');
            }
            if (confirmButton) confirmButton.textContent = 'Booking Confirmed!';
            // document.getElementById('customerDetailsFormSPA').style.display = 'none'; // Optionally hide form
        } else {
            const errorMessage = responseData.msg || responseData.message || 'Failed to confirm booking.';
            if (confirmationMessageArea) {
                confirmationMessageArea.textContent = `Error: ${errorMessage}`;
                confirmationMessageArea.className = 'api-message error-message';
                confirmationMessageArea.style.display = 'block';
            } else {
                alert(`Error: ${errorMessage}`);
            }
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirm Booking';
            }
            if (goBackButton) goBackButton.style.display = '';
        }
    } catch (error) {
        console.error('Error confirming booking:', error);
        if (confirmationMessageArea) {
            confirmationMessageArea.textContent = 'An unexpected error occurred. Please try again.';
            confirmationMessageArea.className = 'api-message error-message';
            confirmationMessageArea.style.display = 'block';
        } else {
            alert('An unexpected error occurred. Please try again.');
        }
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm Booking';
        }
        if (goBackButton) goBackButton.style.display = '';
    }
}
