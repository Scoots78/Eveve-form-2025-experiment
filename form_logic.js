document.addEventListener('DOMContentLoaded', () => {
    // --- Helper Functions ---

    function getQueryParam(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    function formatTime(decimalTime) {
        // Ensure decimalTime is treated as a number, especially if it comes from dataset
        const time = parseFloat(decimalTime);
        if (isNaN(time)) return 'N/A';
        
        const hours = Math.floor(time);
        const minutesDecimal = time - hours;
        const minutes = Math.round(minutesDecimal * 60);

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
        return `${displayHours}:${formattedMinutes} ${ampm}`;
    }

    // --- API Call Function ---
    async function fetchAvailableTimes(estName, date, covers) {
        const apiUrl = `https://nz.eveve.com/web/day-avail?est=${estName}&covers=${covers}&date=${date}`;
        console.log(`Fetching available times from: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                // Try to parse error response as JSON, then text if JSON fails
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = await response.text();
                }
                console.error('API Error Response Data:', errorData);
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. Body: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            console.log('Available times data received:', data);
            return data;
        } catch (error) {
            console.error('Error fetching available times:', error);
            return null; // Return null on error as per requirements
        }
    }

    // --- Configuration Loading and Parsing ---
    let config = {};
    let languageStrings = {};
    // initialShifts is not directly used by the new displayTimeSlots logic
    // as the structure from config.allShifts (from-to range) differs from API (array of specific times).

    try {
        const configScriptElement = document.getElementById('configData');
        if (configScriptElement && configScriptElement.textContent) {
            config = JSON.parse(configScriptElement.textContent.trim());
        } else {
            console.error('Configuration data script tag not found or is empty.');
            config = {};
        }
    } catch (e) {
        console.error('Error parsing main config JSON:', e);
        config = {}; 
    }

    try {
        if (config.lng && typeof config.lng === 'string') {
            languageStrings = (new Function('return ' + config.lng))();
        } else {
            console.warn('config.lng is missing or not a string. Using empty language strings.');
            languageStrings = {};
        }
    } catch (e) {
        console.error('Error parsing config.lng:', e);
        languageStrings = {};
    }
    
    const partyMin = parseInt(config.partyMin) || 1;
    const partyMax = parseInt(config.partyMax) || 10;
    const todayYear = parseInt(config.todayYear);
    const todayMonth = parseInt(config.todayMonth); 
    const todayDate = parseInt(config.today);

    // --- DOM Elements ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    const dateSelector = document.getElementById('dateSelector');
    const coversSelector = document.getElementById('coversSelector');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue'); 
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');


    // --- Initialize Restaurant Name ---
    let currentEstName = getQueryParam('estName');
    if (currentEstName) {
        restaurantNameSpan.textContent = currentEstName;
    } else if (config.estName) {
        currentEstName = config.estName.replace(/^['"](.*)['"]$/, '$1');
        restaurantNameSpan.textContent = currentEstName;
    } else {
        currentEstName = null; // Set to null if no estName is available
        restaurantNameSpan.textContent = languageStrings.defaultRestaurantName || 'Our Restaurant';
        console.warn('Restaurant name (estName) not found in URL params or config. API calls may fail.');
    }

    // --- Initialize Selectors ---
    let defaultDateStr = '';
    if (!isNaN(todayYear) && !isNaN(todayMonth) && !isNaN(todayDate)) {
        const monthForDate = todayMonth - 1; 
        try {
            defaultDateStr = new Date(todayYear, monthForDate, todayDate).toISOString().split('T')[0];
        } catch (e) {
            console.warn("Could not form date from config, defaulting to today", e);
            defaultDateStr = new Date().toISOString().split('T')[0];
        }
    } else {
        defaultDateStr = new Date().toISOString().split('T')[0];
    }
    dateSelector.value = defaultDateStr;
    selectedDateValueSpan.textContent = defaultDateStr;

    coversSelector.min = partyMin;
    coversSelector.max = partyMax;
    coversSelector.value = partyMin; 
    selectedCoversValueSpan.textContent = coversSelector.value;


    // --- Time Slot Display Function ---
    function displayTimeSlots(shiftsData) {
        timeSelectorContainer.innerHTML = '';
        // selectedTimeValueSpan is already defined in the outer scope
        if(selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-'; 

        if (!shiftsData || !Array.isArray(shiftsData) || shiftsData.length === 0) {
            // This case is now primarily handled by the enhanced error logic in handleDateOrCoversChange
            // but can serve as a final fallback if displayTimeSlots is called directly with empty data.
            timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
            return;
        }

        let foundAvailableTimes = false;
        shiftsData.forEach(shift => {
            if (shift && typeof shift.name === 'string') {
                const shiftTitle = document.createElement('h3');
                shiftTitle.textContent = shift.name;
                timeSelectorContainer.appendChild(shiftTitle);

                const shiftButtonContainer = document.createElement('div');
                shiftButtonContainer.className = 'shift-times-wrapper';
                timeSelectorContainer.appendChild(shiftButtonContainer);

                if (Array.isArray(shift.times) && shift.times.length > 0) {
                    shift.times.forEach(timeObj => { 
                        const timeValue = timeObj.time; 
                        if (typeof timeValue !== 'number') {
                            console.warn('Invalid time value in shift.times:', timeObj);
                            return; 
                        }
                        foundAvailableTimes = true;

                        const button = document.createElement('button');
                        button.className = 'time-slot-button';
                        button.dataset.time = timeValue; 
                        button.textContent = formatTime(timeValue);
                        
                        button.addEventListener('click', function() {
                            if(selectedTimeValueSpan) selectedTimeValueSpan.textContent = this.textContent; 

                            const allTimeButtons = timeSelectorContainer.querySelectorAll('.time-slot-button');
                            allTimeButtons.forEach(btn => btn.classList.remove('time-slot-button-selected'));
                            this.classList.add('time-slot-button-selected');
                        });
                        shiftButtonContainer.appendChild(button);
                    });
                } else {
                    const noTimesForShiftMsg = document.createElement('p');
                    noTimesForShiftMsg.textContent = `No specific times listed for ${shift.name}.`;
                    noTimesForShiftMsg.className = 'no-times-for-shift-message';
                    shiftButtonContainer.appendChild(noTimesForShiftMsg);
                }
            } else {
                console.warn("Invalid shift object in shiftsData:", shift);
            }
        });
        
        if (!foundAvailableTimes) {
             timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No specific time slots found for the available shifts.'}</p>`;
        }
    }
    
    // --- Event Handling Logic ---
    async function handleDateOrCoversChange() {
        const dateValue = dateSelector.value;
        const coversValue = parseInt(coversSelector.value, 10);

        // Update display for date and covers immediately
        selectedDateValueSpan.textContent = dateValue || '-';
        selectedCoversValueSpan.textContent = coversValue || '-';
        if(selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-'; // Reset time selection

        if (!currentEstName) {
            console.error('Restaurant Name (estName) is not set. Cannot fetch times.');
            timeSelectorContainer.innerHTML = `<p class="error-message">Configuration error: Restaurant name not found.</p>`;
            return;
        }
        if (!dateValue || isNaN(coversValue) || coversValue <= 0) {
            console.log('Validation failed: Date or covers are invalid.');
            // Clear time slots or show a generic "not available" type message through displayTimeSlots
            // or set a specific message if preferred.
            timeSelectorContainer.innerHTML = `<p class="error-message">Please select a valid date and number of guests.</p>`;
            displayTimeSlots(null); // This will show "no times available" or similar.
            return;
        }

        console.log(`Fetching for: est=${currentEstName}, date=${dateValue}, covers=${coversValue}`);
        timeSelectorContainer.innerHTML = `<p class="loading-message">Loading times...</p>`; 

        const availabilityData = await fetchAvailableTimes(currentEstName, dateValue, coversValue);
        
        // Enhanced Error Handling Logic
        if (availabilityData && availabilityData.shifts && availabilityData.shifts.length > 0) {
            displayTimeSlots(availabilityData.shifts);
        } else {
            // Clear loading message before showing error or specific API message
            timeSelectorContainer.innerHTML = ''; // Ensure loading message is gone

            let messageToShow = 'No time slots available for the selected date or party size.'; // Default message
            if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                // Use message from API if provided and not empty
                messageToShow = availabilityData.message;
            } else if (!availabilityData) { // If fetchAvailableTimes returned null (indicating a fetch/network error)
                messageToShow = 'Could not load times. Please check your connection or try again later.';
            }
            // Display the determined message
            timeSelectorContainer.innerHTML = `<p class="error-message">${messageToShow}</p>`;
            
            // Also ensure the main selection display for time is reset
            // selectedTimeValueSpan is already defined in the outer scope
            if (selectedTimeValueSpan) {
                selectedTimeValueSpan.textContent = '-';
            }
        }
    }

    // --- Setup Event Listeners ---
    function setupEventListeners() {
        dateSelector.addEventListener('change', handleDateOrCoversChange);
        coversSelector.addEventListener('change', handleDateOrCoversChange);
    }
    
    setupEventListeners();
    
    console.log('Form logic initialized.');
    
    // --- Initial API Call on Page Load ---
    const initialDateOnLoad = dateSelector.value;
    const initialCoversOnLoad = parseInt(coversSelector.value);

    if (currentEstName && initialDateOnLoad && initialCoversOnLoad > 0) {
        console.log(`Performing initial load of times for ${currentEstName}, Date: ${initialDateOnLoad}, Covers: ${initialCoversOnLoad}`);
        // Set initial loading message before the call
        timeSelectorContainer.innerHTML = '<p class="loading-message">Loading times...</p>';
        handleDateOrCoversChange(); // This function already handles API call and display
    } else {
        // If initial conditions for API call are not met, display a prompt
        let promptMessage = 'Please select a date and number of guests to see available times.';
        if (!currentEstName) {
            promptMessage = 'Restaurant configuration is missing. Cannot load times.';
        }
        timeSelectorContainer.innerHTML = `<p>${promptMessage}</p>`;
        console.log('Skipping initial load: Date, Covers, or Restaurant Name not set appropriately.');
    }
});
