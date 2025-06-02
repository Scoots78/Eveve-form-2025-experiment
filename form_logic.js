// Version: 20240507-110000
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global variables for the module scope ---
    let config = {};
    let languageStrings = {};
    let initialShiftsConfig = []; // For shifts data from config, if any
    let currentEstName = '';

    // --- Toggle for unavailable slots ---
    const showUnavailableSlots = true; // Set to false to hide unavailable slots

    // --- DOM Elements (defined early for broader access if needed) ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    const dateSelector = document.getElementById('dateSelector'); // dateSelector is the datePicker
    const coversSelector = document.getElementById('coversSelector');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');

    // --- Helper Functions ---
    function getQueryParam(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Updated formatTime function as per task description
    function formatTime(decimalTime) {
        // Debug line added as per task instructions
        console.log('formatTime received:', decimalTime, 'type:', typeof decimalTime);

        if (decimalTime === null || typeof decimalTime === 'undefined' || isNaN(parseFloat(decimalTime))) {
            return 'N/A'; // Or some other placeholder for invalid input
        }

        let hours = Math.floor(decimalTime);
        let fraction = decimalTime - hours;
        let minutes = Math.round(fraction * 60);

        if (minutes === 60) { // Handle cases like 12.99... rounding up
            hours++;
            minutes = 0;
        }

        // Determine AM/PM and adjust hours for 12-hour format
        let ampm = 'AM';
        let displayHours = hours;

        if (displayHours >= 24) {
            displayHours -= 24; // Bring it into the 0-23 range for "next day" AM
        }
        // At this point, displayHours is effectively 0-23 range of the "logical" day

        if (displayHours >= 12) {
            ampm = 'PM';
        }
        if (displayHours === 0) { // Midnight case
            displayHours = 12; // 12 AM
        } else if (displayHours > 12) {
            displayHours -= 12; // Convert 13-23 to 1-11 PM
        }
        // Hours from 1 to 11 AM remain as is for displayHours

        const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);

        return `${displayHours}:${minutesStr} ${ampm}`;
    }


    function parseJsObjectString(jsString) {
        if (!jsString || typeof jsString !== 'string') {
            console.warn('Invalid input for parseJsObjectString:', jsString);
            return null;
        }
        try {
            return new Function('return ' + jsString)();
        } catch (e) {
            console.error('Error parsing JavaScript object string:', e, 'String was:', jsString);
            return null;
        }
    }

    // --- API Call Functions ---
    async function loadConfigFromServer() {
        currentEstName = getQueryParam('est'); // Sets the module-scoped currentEstName

        if (!currentEstName) {
            console.error('Restaurant ID (est) missing from URL.');
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">Error: Restaurant ID (est) missing from URL.</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Configuration Error';
            throw new Error('Restaurant ID (est) missing from URL.');
        }

        const localApiUrl = `/api/get-config?est=${currentEstName}`;
        console.log(`Fetching configuration from: ${localApiUrl}`);

        try {
            const response = await fetch(localApiUrl);
            if (!response.ok) {
                let errorDetails = await response.text();
                try { errorDetails = JSON.parse(errorDetails); } catch (e) { /* Keep as text if not JSON */ }
                console.error('Failed to load config from server:', response.status, errorDetails);
                throw new Error(`Failed to load config: ${response.statusText}. Details: ${JSON.stringify(errorDetails)}`);
            }
            const fetchedConfig = await response.json();
            console.log('Configuration loaded successfully:', fetchedConfig);
            return fetchedConfig;
        } catch (error) {
            console.error('Error in loadConfigFromServer:', error);
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">Failed to load restaurant configuration. Please try again later.</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Load Error';
            throw error; // Propagate error to stop further execution
        }
    }

    async function fetchAvailableTimes(estNameForApi, date, covers) { // Renamed estName to estNameForApi to avoid conflict
        const apiUrl = `https://nz.eveve.com/web/day-avail?est=${estNameForApi}&covers=${covers}&date=${date}`;
        console.log(`Fetching available times from: ${apiUrl}`);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorData;
                try { errorData = await response.json(); } catch (e) { errorData = await response.text(); }
                console.error('Day Avail API Error Response Data:', errorData);
                throw new Error(`HTTP error! status: ${response.status}. Body: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            console.log('Available times data received:', data);
            return data;
        } catch (error) {
            console.error('Error fetching available times:', error);
            return null;
        }
    }

    // --- Core Logic ---
    try {
        // 1. Load Configuration
        config = await loadConfigFromServer(); // currentEstName is set within this function

        // 2. Parse language strings and initial shifts from config
        languageStrings = parseJsObjectString(config.lng) || {};
        initialShiftsConfig = parseJsObjectString(config.allShifts) || [];

        // 3. Initialize Restaurant Name Display
        const displayName = config.estName ? config.estName.replace(/^['"](.*)['"]$/, '$1') : currentEstName;
        if (restaurantNameSpan) restaurantNameSpan.textContent = displayName;

        // 4. Initialize Selectors (Date, Covers)

        // Date Picker Initialization
        if (dateSelector) {
            const todayStrForMin = getTodayDateString(); // Use helper for min attribute
            dateSelector.min = todayStrForMin;
            dateSelector.value = todayStrForMin; // Default to today

            if (selectedDateValueSpan) {
                selectedDateValueSpan.textContent = todayStrForMin; // Update display
            }
        } else {
            console.error("Date selector element not found!");
        }

        // Covers Selector Initialization (using config values)
        const partyMin = parseInt(config.partyMin) || 1;
        const partyMax = parseInt(config.partyMax) || 10;
        if (coversSelector) {
            coversSelector.min = partyMin;
            coversSelector.max = partyMax;
            coversSelector.value = partyMin; // Default to min party size
            if (selectedCoversValueSpan) {
                selectedCoversValueSpan.textContent = coversSelector.value;
            }
        } else {
            console.error("Covers selector element not found!");
        }


        // 5. Time Slot Display Function
        function displayTimeSlots(shiftsData) {
            // Debug log at the very beginning of the function
            console.log('displayTimeSlots received shiftsData:', JSON.stringify(shiftsData, null, 2));

            if (!timeSelectorContainer || !selectedTimeValueSpan) return;
            timeSelectorContainer.innerHTML = '';
            selectedTimeValueSpan.textContent = '-';

            if (!shiftsData || !Array.isArray(shiftsData) || shiftsData.length === 0) {
                timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
                return;
            }

            let foundAvailableTimes = false; // To track if any bookable time is found
            let foundAnySlotsToShow = false; // To track if any slot (bookable or unavailable) is shown

            shiftsData.forEach(shift => {
                // Debug log for each shift being processed
                console.log('Processing shift:', JSON.stringify(shift, null, 2));

                if (!shift || typeof shift.name !== 'string') {
                    console.warn("Invalid shift object:", shift); return;
                }
                const shiftTitle = document.createElement('h3');
                shiftTitle.textContent = shift.name;
                timeSelectorContainer.appendChild(shiftTitle);

                const shiftButtonContainer = document.createElement('div');
                shiftButtonContainer.className = 'shift-times-wrapper';
                timeSelectorContainer.appendChild(shiftButtonContainer);

                if (Array.isArray(shift.times) && shift.times.length > 0) {
                    shift.times.forEach(timeValue => {
                        console.log('Attempting to process timeValue:', timeValue, 'type:', typeof timeValue);

                        if (typeof timeValue !== 'number') {
                            console.warn('Invalid time value in shift.times array:', timeValue, 'Expected a number.');
                            return;
                        }

                        const button = document.createElement('button');
                        button.className = 'time-slot-button'; // Common class

                        if (timeValue < 0) {
                            if (!showUnavailableSlots) {
                                return; // Skip this iteration, effectively hiding the slot
                            }
                            button.textContent = 'Not Available';
                            button.classList.add('time-slot-unavailable');
                            button.disabled = true;
                            foundAnySlotsToShow = true; // We are showing an "unavailable" slot
                        } else {
                            button.classList.add('time-slot-available');
                            button.dataset.time = timeValue;
                            button.textContent = formatTime(timeValue);
                            button.addEventListener('click', function() {
                                selectedTimeValueSpan.textContent = this.textContent;
                                timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
                                this.classList.add('time-slot-button-selected');
                            });
                            foundAvailableTimes = true; // A bookable time was found
                            foundAnySlotsToShow = true; // We are showing a bookable slot
                        }
                        shiftButtonContainer.appendChild(button);
                    });
                } else { // No times listed for this shift
                    const noTimesMsg = document.createElement('p');
                    noTimesMsg.className = 'no-times-for-shift-message';
                    noTimesMsg.textContent = `No specific times listed for ${shift.name}.`;
                    shiftButtonContainer.appendChild(noTimesMsg);
                    if (shift.times.length === 0) foundAnySlotsToShow = true;
                }
            });

            if (!foundAnySlotsToShow) {
                 timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
            }
        }

        // 6. Event Handling Logic
        async function handleDateOrCoversChange() {
            if (!dateSelector || !coversSelector || !selectedDateValueSpan || !selectedCoversValueSpan || !selectedTimeValueSpan || !timeSelectorContainer) return;

            const selectedDateStr = dateSelector.value;
            const coversValue = parseInt(coversSelector.value, 10);

            // Fallback check for past dates
            const todayComparableString = getTodayDateString();
            if (selectedDateStr < todayComparableString) {
                timeSelectorContainer.innerHTML = '<p class="error-message">Selected date is in the past. Please choose a current or future date.</p>';
                // Clear selection displays
                selectedDateValueSpan.textContent = '-'; // Or keep selectedDateStr to show the invalid date
                selectedCoversValueSpan.textContent = '-';
                selectedTimeValueSpan.textContent = '-';
                return;
            }

            // Update display for date and covers immediately (if not a past date)
            selectedDateValueSpan.textContent = selectedDateStr || '-';
            selectedCoversValueSpan.textContent = coversValue || '-';
            selectedTimeValueSpan.textContent = '-'; // Reset time selection

            if (!currentEstName) {
                console.error('Restaurant Name (est) is not set. Cannot fetch times.');
                timeSelectorContainer.innerHTML = `<p class="error-message">Configuration error: Restaurant name not found.</p>`;
                return;
            }
            // Validation for dateValue and coversValue (already includes selectedDateStr)
            if (!selectedDateStr || isNaN(coversValue) || coversValue <= 0) {
                console.log('Validation failed: Date or covers invalid.');
                timeSelectorContainer.innerHTML = `<p class="error-message">Please select a valid date and number of guests.</p>`;
                return;
            }

            console.log(`Fetching for: est=${currentEstName}, date=${selectedDateStr}, covers=${coversValue}`);
            timeSelectorContainer.innerHTML = `<p class="loading-message">Loading times...</p>`;
            const availabilityData = await fetchAvailableTimes(currentEstName, selectedDateStr, coversValue);

            if (availabilityData && availabilityData.shifts && availabilityData.shifts.length > 0) {
                displayTimeSlots(availabilityData.shifts);
            } else {
                timeSelectorContainer.innerHTML = '';
                let messageToShow = languageStrings.noTimesAvailableDaySize || 'No time slots available for the selected date or party size.';
                if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                    messageToShow = availabilityData.message;
                } else if (!availabilityData) {
                    messageToShow = languageStrings.errorLoadingTimes || 'Could not load times. Please check connection or try again.';
                }
                timeSelectorContainer.innerHTML = `<p class="error-message">${messageToShow}</p>`;
                selectedTimeValueSpan.textContent = '-';
            }
        }

        // 7. Setup Event Listeners
        function setupEventListeners() {
            if (dateSelector) dateSelector.addEventListener('change', handleDateOrCoversChange);
            if (coversSelector) coversSelector.addEventListener('change', handleDateOrCoversChange);
        }
        setupEventListeners();

        // 8. Initial Time Slot Load
        console.log(`Performing initial load for ${currentEstName}`);
        if (currentEstName && dateSelector && dateSelector.value && coversSelector && parseInt(coversSelector.value) > 0) {
            // Check if initial date is not in the past before initial load
            const initialDateOnLoad = dateSelector.value;
            const todayStrForInitialLoad = getTodayDateString();
            if (initialDateOnLoad >= todayStrForInitialLoad) {
                timeSelectorContainer.innerHTML = '<p class="loading-message">Loading times...</p>';
                await handleDateOrCoversChange();
            } else {
                // This case should ideally not happen if dateSelector.min is set correctly
                // and dateSelector.value defaults to today.
                timeSelectorContainer.innerHTML = '<p class="error-message">Initial date is in the past. Please select a valid date.</p>';
                selectedDateValueSpan.textContent = initialDateOnLoad; // Show the problematic date
                selectedCoversValueSpan.textContent = coversSelector.value;
                selectedTimeValueSpan.textContent = '-';
            }
        } else {
            let promptMessage = languageStrings.promptSelection || 'Please select date and guests for times.';
            if (!currentEstName) promptMessage = languageStrings.errorConfigMissing || 'Restaurant config missing.';
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p>${promptMessage}</p>`;
            console.log('Skipping initial time slot load: conditions not met (estName, date, or covers).');
        }

        console.log('Form logic fully initialized.');

    } catch (error) {
        console.error('Critical error during form initialization:', error);
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'critical-error-message';
            errorDiv.textContent = languageStrings.errorCriticalInit || 'Could not initialize booking form. Please try refreshing the page or contact support.';
            const formContainer = document.querySelector('.form-container');
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
