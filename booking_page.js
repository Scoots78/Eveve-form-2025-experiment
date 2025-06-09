document.addEventListener('DOMContentLoaded', () => {
    const coversDisplay = document.getElementById('covers-display');
    const coversDecrement = document.getElementById('covers-decrement');
    const coversIncrement = document.getElementById('covers-increment');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');

    // Retrieve min/max from data attributes set by main.js
    // These attributes should be set by main.js before this script runs or accesses them.
    // If main.js's DOMContentLoaded runs after this, dataset attributes might not be immediately available.
    // However, typical script execution order should make them available.
    const minGuests = parseInt(coversDisplay.dataset.min) || 1;
    const maxGuests = parseInt(coversDisplay.dataset.max) || 12; // Default max, e.g. 12, if not found

    let currentCovers = 2; // Desired initial value

    // Adjust initial currentCovers based on min/max
    if (currentCovers < minGuests) {
        currentCovers = minGuests;
    }
    if (currentCovers > maxGuests) {
        currentCovers = maxGuests;
    }

    function updateCoversDisplayAndSummary() {
        coversDisplay.value = currentCovers;
        if (selectedCoversValueSpan) {
            selectedCoversValueSpan.textContent = currentCovers;
        }
    }

    function triggerAvailabilityUpdate() {
        if (window.handleCoversChangeGlobal) {
            window.handleCoversChangeGlobal();
        } else {
            // This might occur if booking_page.js runs before main.js finishes defining the global.
            // Consider deferring this call slightly if issues arise, or ensuring script order.
            console.warn('handleCoversChangeGlobal is not defined on window. Availability check skipped.');
        }
    }

    coversDecrement.addEventListener('click', () => {
        if (currentCovers > minGuests) {
            currentCovers--;
            updateCoversDisplayAndSummary();
            triggerAvailabilityUpdate();
        }
    });

    coversIncrement.addEventListener('click', () => {
        if (currentCovers < maxGuests) {
            currentCovers++;
            updateCoversDisplayAndSummary();
            triggerAvailabilityUpdate();
        }
    });

    coversDisplay.addEventListener('change', () => { // Using 'change' event
        let newValue = parseInt(coversDisplay.value);
        if (isNaN(newValue) || newValue < minGuests) {
            newValue = minGuests;
        } else if (newValue > maxGuests) {
            newValue = maxGuests;
        }
        currentCovers = newValue;
        // Update display to the validated (and possibly corrected) value
        updateCoversDisplayAndSummary();
        triggerAvailabilityUpdate();
    });

    // Initial setup: Set the display value.
    // The actual data fetching and UI update for timeslots based on this initial value
    // is expected to be triggered by main.js after all configurations are loaded
    // and initial event handlers are set up.
    updateCoversDisplayAndSummary();

    // console.log(`booking_page.js: Initial covers set to ${currentCovers}. Min: ${minGuests}, Max: ${maxGuests}`);
    // It's generally better to let main.js make the first call to handleCoversChangeGlobal
    // after all initial setup (including config loading) is complete.
});
