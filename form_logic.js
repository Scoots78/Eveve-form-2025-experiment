// Version: 20240507-120000
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
    const dateSelector = document.getElementById('dateSelector');
    const coversSelector = document.getElementById('coversSelector');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const dailyRotaMessageDiv = document.getElementById('dailyRotaMessage'); // Added for daily message

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

    function formatTime(decimalTime) {
        console.log('formatTime received:', decimalTime, 'type:', typeof decimalTime);
        if (decimalTime === null || typeof decimalTime === 'undefined' || isNaN(parseFloat(decimalTime))) {
            return 'N/A';
        }
        let hours = Math.floor(decimalTime);
        let fraction = decimalTime - hours;
        let minutes = Math.round(fraction * 60);
        if (minutes === 60) { hours++; minutes = 0; }
        let ampm = 'AM';
        let displayHours = hours;
        if (displayHours >= 24) { displayHours -= 24; }
        if (displayHours >= 12) { ampm = 'PM'; }
        if (displayHours === 0) { displayHours = 12; }
        else if (displayHours > 12) { displayHours -= 12; }
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
        currentEstName = getQueryParam('est');
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
                try { errorDetails = JSON.parse(errorDetails); } catch (e) { /* Keep as text */ }
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
            throw error;
        }
    }

    async function fetchAvailableTimes(estNameForApi, date, covers) {
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
        config = await loadConfigFromServer();
        languageStrings = parseJsObjectString(config.lng) || {};
        initialShiftsConfig = parseJsObjectString(config.allShifts) || [];
        const displayName = config.estName ? config.estName.replace(/^['"](.*)['"]$/, '$1') : currentEstName;
        if (restaurantNameSpan) restaurantNameSpan.textContent = displayName;

        if (dateSelector) {
            const todayStrForMin = getTodayDateString();
            dateSelector.min = todayStrForMin;
            dateSelector.value = todayStrForMin;
            if (selectedDateValueSpan) selectedDateValueSpan.textContent = todayStrForMin;
        } else { console.error("Date selector element not found!"); }

        const partyMin = parseInt(config.partyMin) || 1;
        const partyMax = parseInt(config.partyMax) || 10;
        if (coversSelector) {
            coversSelector.min = partyMin;
            coversSelector.max = partyMax;
            coversSelector.value = partyMin;
            if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
        } else { console.error("Covers selector element not found!"); }

        function displayTimeSlots(shiftsData) {
            console.log('displayTimeSlots received shiftsData:', JSON.stringify(shiftsData, null, 2));
            if (!timeSelectorContainer || !selectedTimeValueSpan) return;
            timeSelectorContainer.innerHTML = '';
            selectedTimeValueSpan.textContent = '-';

            if (!shiftsData || !Array.isArray(shiftsData) || shiftsData.length === 0) {
                timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
                return;
            }

            let foundAnySlotsToShow = false;
            shiftsData.forEach(shift => {
                console.log('Processing shift:', JSON.stringify(shift, null, 2));
                if (!shift || typeof shift.name !== 'string') {
                    console.warn("Invalid shift object:", shift); return;
                }
                const shiftTitle = document.createElement('h3');
                shiftTitle.textContent = shift.name;
                timeSelectorContainer.appendChild(shiftTitle);

                // Display shift-specific message
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
                        console.log('Attempting to process timeValue:', timeValue, 'type:', typeof timeValue);
                        if (typeof timeValue !== 'number') {
                            console.warn('Invalid time value in shift.times array:', timeValue, 'Expected a number.');
                            return;
                        }
                        const button = document.createElement('button');
                        button.className = 'time-slot-button';
                        if (timeValue < 0) {
                            if (!showUnavailableSlots) return;
                            button.textContent = 'Not Available';
                            button.classList.add('time-slot-unavailable');
                            button.disabled = true;
                        } else {
                            button.classList.add('time-slot-available');
                            button.dataset.time = timeValue;
                            button.textContent = formatTime(timeValue);
                            button.addEventListener('click', function() {
                                selectedTimeValueSpan.textContent = this.textContent;
                                timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
                                this.classList.add('time-slot-button-selected');
                            });
                        }
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShow = true;
                    });
                } else {
                    const noTimesMsg = document.createElement('p');
                    noTimesMsg.className = 'no-times-for-shift-message';
                    noTimesMsg.textContent = `No specific times listed for ${shift.name}.`;
                    shiftButtonContainer.appendChild(noTimesMsg);
                    foundAnySlotsToShow = true;
                }
            });
            if (!foundAnySlotsToShow) {
                 timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
            }
        }

        async function handleDateOrCoversChange() {
            if (!dateSelector || !coversSelector || !selectedDateValueSpan || !selectedCoversValueSpan || !selectedTimeValueSpan || !timeSelectorContainer || !dailyRotaMessageDiv) return;

            const selectedDateStr = dateSelector.value;
            const coversValue = parseInt(coversSelector.value, 10);
            const todayComparableString = getTodayDateString();

            // Clear previous daily rota message
            dailyRotaMessageDiv.textContent = '';
            dailyRotaMessageDiv.style.display = 'none';

            if (selectedDateStr < todayComparableString) {
                timeSelectorContainer.innerHTML = '<p class="error-message">Selected date is in the past. Please choose a current or future date.</p>';
                selectedDateValueSpan.textContent = '-';
                selectedCoversValueSpan.textContent = '-';
                selectedTimeValueSpan.textContent = '-';
                return;
            }

            selectedDateValueSpan.textContent = selectedDateStr || '-';
            selectedCoversValueSpan.textContent = coversValue || '-';
            selectedTimeValueSpan.textContent = '-';

            if (!currentEstName) {
                console.error('Restaurant Name (est) is not set. Cannot fetch times.');
                timeSelectorContainer.innerHTML = `<p class="error-message">Configuration error: Restaurant name not found.</p>`;
                return;
            }
            if (!selectedDateStr || isNaN(coversValue) || coversValue <= 0) {
                console.log('Validation failed: Date or covers invalid.');
                timeSelectorContainer.innerHTML = `<p class="error-message">Please select a valid date and number of guests.</p>`;
                return;
            }

            console.log(`Fetching for: est=${currentEstName}, date=${selectedDateStr}, covers=${coversValue}`);
            timeSelectorContainer.innerHTML = `<p class="loading-message">Loading times...</p>`;
            const availabilityData = await fetchAvailableTimes(currentEstName, selectedDateStr, coversValue);

            // Display Daily Rota Message (from availabilityData.message)
            if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                dailyRotaMessageDiv.textContent = availabilityData.message;
                dailyRotaMessageDiv.style.display = 'block';
            } else {
                dailyRotaMessageDiv.textContent = ''; // Clear if no message or empty
                dailyRotaMessageDiv.style.display = 'none';
            }

            // Process and display shifts and their specific messages
            if (availabilityData && availabilityData.shifts && availabilityData.shifts.length > 0) {
                displayTimeSlots(availabilityData.shifts);
            } else {
                // If no shifts, clear time slots and show relevant message (could be from daily message or generic)
                timeSelectorContainer.innerHTML = '';
                if (!dailyRotaMessageDiv.textContent) { // Only show this if no daily message took precedence
                    let messageToShow = languageStrings.noTimesAvailableDaySize || 'No time slots available for the selected date or party size.';
                    // The API might return a message even if shifts array is empty/missing
                    if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                         // This message is already displayed in dailyRotaMessageDiv,
                         // so we might just show a generic no slots message or rely on the daily one.
                         // For now, let's ensure a clear "no slots" message if shifts are empty.
                         messageToShow = languageStrings.noTimesAvailableDaySize || 'No time slots available for the selected date or party size.';
                    } else if (!availabilityData && !dailyRotaMessageDiv.textContent) {
                        // If fetch failed and no daily message
                        messageToShow = languageStrings.errorLoadingTimes || 'Could not load times. Please check connection or try again.';
                    }
                     timeSelectorContainer.innerHTML = `<p class="error-message">${messageToShow}</p>`;
                }
                selectedTimeValueSpan.textContent = '-';
            }
        }

        function setupEventListeners() {
            if (dateSelector) dateSelector.addEventListener('change', handleDateOrCoversChange);
            if (coversSelector) coversSelector.addEventListener('change', handleDateOrCoversChange);
        }
        setupEventListeners();

        console.log(`Performing initial load for ${currentEstName}`);
        if (currentEstName && dateSelector && dateSelector.value && coversSelector && parseInt(coversSelector.value) > 0) {
            const initialDateOnLoad = dateSelector.value;
            const todayStrForInitialLoad = getTodayDateString();
            if (initialDateOnLoad >= todayStrForInitialLoad) {
                if (timeSelectorContainer) timeSelectorContainer.innerHTML = '<p class="loading-message">Loading times...</p>';
                await handleDateOrCoversChange();
            } else {
                if (timeSelectorContainer) timeSelectorContainer.innerHTML = '<p class="error-message">Initial date is in the past. Please select a valid date.</p>';
                if (selectedDateValueSpan) selectedDateValueSpan.textContent = initialDateOnLoad;
                if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
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
