document.addEventListener('DOMContentLoaded', () => {
    // --- Helper Functions ---

    function getQueryParam(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    function formatTime(decimalTime) {
        if (isNaN(decimalTime)) return 'N/A';
        const hours = Math.floor(decimalTime);
        const minutesDecimal = decimalTime - hours;
        const minutes = Math.round(minutesDecimal * 60);

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12; // Convert 0 or 12 to 12 for AM/PM
        
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
        return `${displayHours}:${formattedMinutes} ${ampm}`;
    }

    // --- Configuration Loading and Parsing ---
    let config = {};
    let languageStrings = {};
    let shifts = [];

    try {
        const configScriptElement = document.getElementById('configData');
        if (configScriptElement && configScriptElement.textContent) {
            config = JSON.parse(configScriptElement.textContent.trim());
        } else {
            console.error('Configuration data script tag not found or is empty.');
            // Provide default empty config to prevent further errors if possible
            config = {};
        }
    } catch (e) {
        console.error('Error parsing main config JSON:', e);
        config = {}; // Default to empty config on error
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

    try {
        if (config.allShifts && typeof config.allShifts === 'string') {
            shifts = (new Function('return ' + config.allShifts))();
            if (!Array.isArray(shifts)) {
                console.warn('Parsed config.allShifts is not an array. Defaulting to empty array.');
                shifts = [];
            }
        } else {
            console.warn('config.allShifts is missing or not a string. Using empty shifts array.');
            shifts = [];
        }
    } catch (e) {
        console.error('Error parsing config.allShifts:', e);
        shifts = [];
    }
    
    // Parse numeric config values (with defaults)
    const partyMin = parseInt(config.partyMin) || 1;
    const partyMax = parseInt(config.partyMax) || 10;
    const todayYear = parseInt(config.todayYear);
    const todayMonth = parseInt(config.todayMonth); // Assuming 0-indexed for JS Date if from JS, or needs adjustment
    const todayDate = parseInt(config.today);
    const timeStep = parseFloat(config.timeStep) || 0.5; // Default to 30 mins (0.5 hours)

    // --- DOM Elements ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    const dateSelector = document.getElementById('dateSelector');
    const coversSelector = document.getElementById('coversSelector');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue');

    // --- Initialize Restaurant Name ---
    const estNameFromUrl = getQueryParam('estName');
    if (estNameFromUrl) {
        restaurantNameSpan.textContent = estNameFromUrl;
    } else if (config.estName) {
        // Use estName from config if URL param is missing, remove quotes if present
        restaurantNameSpan.textContent = config.estName.replace(/^['"](.*)['"]$/, '$1');
    } else {
        restaurantNameSpan.textContent = languageStrings.defaultRestaurantName || 'Our Restaurant';
    }

    // --- Initialize Selectors ---

    // Date Selector
    let defaultDateStr = '';
    if (!isNaN(todayYear) && !isNaN(todayMonth) && !isNaN(todayDate)) {
        // Assuming config.todayMonth is 1-indexed from source, convert to 0-indexed for JS Date
        // If config.todayMonth is already 0-indexed, this needs adjustment.
        // For now, let's assume it's 1-indexed as often seen in non-JS backend data.
        const monthForDate = todayMonth -1; // Adjust if todayMonth is 0-indexed
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


    // Covers Selector
    coversSelector.min = partyMin;
    coversSelector.max = partyMax;
    coversSelector.value = partyMin;
    selectedCoversValueSpan.textContent = partyMin;

    // Time Selector
    function renderTimeSlots() {
        timeSelectorContainer.innerHTML = ''; // Clear existing slots
        if (shifts && Array.isArray(shifts) && shifts.length > 0) {
            shifts.forEach(shift => {
                if (shift && typeof shift.from === 'number' && typeof shift.to === 'number' && typeof shift.name === 'string') {
                    const shiftLabel = document.createElement('p');
                    shiftLabel.textContent = `${shift.name} Times:`; // e.g., "Lunch Times:"
                    timeSelectorContainer.appendChild(shiftLabel);

                    for (let time = shift.from; time < shift.to; time += timeStep) {
                        const timeButton = document.createElement('button');
                        const formattedDisplayTime = formatTime(time);
                        timeButton.textContent = formattedDisplayTime;
                        timeButton.classList.add('time-slot-button');
                        timeButton.dataset.timeValue = time; // Store decimal time for internal use
                        timeButton.dataset.timeDisplay = formattedDisplayTime; // Store display time
                        
                        timeButton.addEventListener('click', () => {
                            selectedTimeValueSpan.textContent = timeButton.dataset.timeDisplay;
                            // Optionally, remove 'selected' class from other buttons
                            document.querySelectorAll('.time-slot-button.selected').forEach(btn => btn.classList.remove('selected'));
                            timeButton.classList.add('selected');
                        });
                        timeSelectorContainer.appendChild(timeButton);
                    }
                }
            });
        } else {
            timeSelectorContainer.textContent = languageStrings.noTimesAvailable || 'No time slots available.';
        }
    }
    renderTimeSlots();


    // --- Update Selection Display Event Listeners ---
    dateSelector.addEventListener('input', () => {
        selectedDateValueSpan.textContent = dateSelector.value || '-';
    });

    coversSelector.addEventListener('input', () => {
        selectedCoversValueSpan.textContent = coversSelector.value || '-';
    });

    // Time selection is updated directly by time button event listeners.

    // Initial call to set default time if any button gets auto-selected or for placeholder
    if (selectedTimeValueSpan.textContent === '-') {
         const firstTimeButton = timeSelectorContainer.querySelector('.time-slot-button');
         if (firstTimeButton) {
             // selectedTimeValueSpan.textContent = firstTimeButton.dataset.timeDisplay; // Uncomment to auto-select first time
         }
    }
    
    console.log('Form logic initialized.');
    console.log('Config:', config);
    console.log('Language Strings:', languageStrings);
    console.log('Shifts:', shifts);

});
