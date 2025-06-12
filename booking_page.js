import { debounce } from './dom_utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const coversDisplay = document.getElementById('covers-display');
    const coversDecrement = document.getElementById('covers-decrement');
    const coversIncrement = document.getElementById('covers-increment');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');

    // Retrieve min/max from data attributes set by main.js
    // These attributes should be set by main.js before this script runs or accesses them.
    // If main.js's DOMContentLoaded runs after this, dataset attributes might not be immediately available.
    // However, typical script execution order should make them available.
    const minGuests = parseInt(coversDisplay.dataset.min) || 0; // Allow 0 as a valid min for initial state
    const maxGuests = parseInt(coversDisplay.dataset.max) || 12; // Default max, e.g. 12, if not found

    let currentCovers = 0; // Initial value set to 0

    // Adjust initial currentCovers based on min/max (though 0 should be fine if minGuests is 0)
    if (currentCovers < minGuests && minGuests !== 0) { // If minGuests is not 0, enforce it.
        currentCovers = minGuests;
    }
    if (currentCovers > maxGuests) {
        currentCovers = maxGuests;
    }

    // Function to toggle time selection visibility (will be properly defined in event_handlers.js)
    // For now, this is a placeholder to ensure it's called.
    // It will be replaced by an import later if we move its definition.
    function toggleTimeSelectionVisibilityLocal(value) {
        const timeSelectionSection = document.getElementById('time-selection-section');
        if (timeSelectionSection) {
            timeSelectionSection.style.display = value > 0 ? '' : 'none'; // Show if value > 0, else hide
        }
    }

    function updateCoversDisplayAndSummary() {
        coversDisplay.value = currentCovers;
        if (selectedCoversValueSpan) {
            // Display '-' if covers is 0, otherwise the number
            selectedCoversValueSpan.textContent = currentCovers === 0 ? '-' : currentCovers;
        }
        toggleTimeSelectionVisibilityLocal(currentCovers); // Update visibility whenever covers change
    }

    function triggerAvailabilityUpdate() {
        // Only trigger if covers > 0, as per new logic where time selection is hidden for 0 covers
        if (currentCovers > 0) {
            if (window.handleCoversChangeGlobal) {
                window.handleCoversChangeGlobal();
            } else {
                console.warn('handleCoversChangeGlobal is not defined on window. Availability check skipped.');
            }
        } else {
            // If covers is 0, we might want to clear existing time slots or show a message.
            // This part can be expanded based on desired behavior. For now, handled by toggleTimeSelectionVisibility.
            // Potentially, explicitly call a reset function from ui_manager if needed.
            const timeSelectorContainer = document.getElementById('timeSelectorContainer');
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = ''; // Clear time slots
            const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
             // Also reset addons and next button if covers go to 0
            if (window.resetAddonsAndNextButtonGlobal) { // Assuming a global reset function might be useful
                window.resetAddonsAndNextButtonGlobal();
            } else { // or call individual parts if not bundled
                const addonsDisplayArea = document.getElementById('addonsDisplayArea');
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';
                const nextButton = document.getElementById('nextButton');
                if (nextButton) nextButton.disabled = true;
            }
        }
    }

    const debouncedTriggerAvailabilityUpdate = debounce(triggerAvailabilityUpdate, 500);

    coversDecrement.addEventListener('click', () => {
        // Allow decrementing to 0. minGuests should be 0 for this.
        if (currentCovers > minGuests) { // If minGuests is 0, this allows currentCovers to become 0.
            currentCovers--;
            updateCoversDisplayAndSummary(); // This will call toggleTimeSelectionVisibilityLocal
            debouncedTriggerAvailabilityUpdate(); // This will check if currentCovers > 0
        }
    });

    coversIncrement.addEventListener('click', () => {
        if (currentCovers < maxGuests) {
            currentCovers++;
            updateCoversDisplayAndSummary(); // This will call toggleTimeSelectionVisibilityLocal
            debouncedTriggerAvailabilityUpdate(); // This will check if currentCovers > 0
        }
    });

    coversDisplay.addEventListener('change', () => { // Using 'change' event
        let newValue = parseInt(coversDisplay.value);

        // Validate against true operational min (e.g. 1 if you can't book for 0) vs. initial display min (0)
        const operationalMinGuests = 1; // Example: cannot actually book for 0 guests.
                                      // Or, if minGuests from config is >0, use that.
                                      // For now, assume 0 is a "reset" state, not a bookable quantity.

        if (isNaN(newValue) || newValue < minGuests) { // minGuests here is the absolute floor (0)
            newValue = minGuests;
        } else if (newValue > maxGuests) {
            newValue = maxGuests;
        }
        currentCovers = newValue;
        updateCoversDisplayAndSummary(); // This will call toggleTimeSelectionVisibilityLocal
        // For direct input changes, debounce might also be desired, or immediate depending on UX preference.
        // Using debounced version for consistency here.
        debouncedTriggerAvailabilityUpdate(); // This will check if currentCovers > 0
    });

    // Initial setup: Set the display value and hide time selection.
    updateCoversDisplayAndSummary(); // This sets coversDisplay.value to 0 and calls toggleTimeSelectionVisibilityLocal

    // console.log(`booking_page.js: Initial covers set to ${currentCovers}. Min: ${minGuests}, Max: ${maxGuests}`);
    // The first call to handleCoversChangeGlobal (if covers > 0) will be triggered by main.js
    // or by user interaction if initial covers is 0.
    // after all initial setup (including config loading) is complete.
});
