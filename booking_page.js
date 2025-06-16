import { debounce } from './dom_utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const coversDisplay = document.getElementById('covers-display');
    const coversDecrement = document.getElementById('covers-decrement');
    const coversIncrement = document.getElementById('covers-increment');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');

    // It's safer to get these from window.bookingConfig if main.js guarantees it's populated.
    // For now, assuming dataset attributes are correctly set by main.js before this script runs.
    const minGuestsFromDataset = parseInt(coversDisplay.dataset.min); // This is the 'floor' for the input (e.g., 0 or 1)
    const maxGuestsFromDataset = parseInt(coversDisplay.dataset.max);

    // Operational minimum for booking (cannot be 0)
    const operationalMinGuests = window.bookingConfig && typeof window.bookingConfig.minGuests === 'number'
        ? window.bookingConfig.minGuests
        : 1; // Default operational min if not in config (should always be >= 1)

    const maxGuests = !isNaN(maxGuestsFromDataset) ? maxGuestsFromDataset : 12;

    let currentCovers = 0; // Initial value set to 0
    let isInitialCoversState = true; // Flag for initial state

    // No initial adjustment based on minGuests needed here as currentCovers starts at 0,
    // and minGuests (from dataset) is used as the floor for user interaction.

    function updateButtonStates() {
        // Decrement button logic:
        if (isInitialCoversState) {
            coversDecrement.disabled = (currentCovers === 0);
        } else {
            // Once initial state is passed, cannot go below operationalMinGuests
            coversDecrement.disabled = (currentCovers <= operationalMinGuests);
        }
        // Increment button logic:
        coversIncrement.disabled = (currentCovers >= maxGuests);
    }

    function toggleTimeSelectionVisibilityLocal(value) {
        const timeSelectionSection = document.getElementById('time-selection-section');
        if (timeSelectionSection) {
            // Show if value >= operationalMinGuests, else hide.
            // Or, more simply, if value > 0 (because 0 is the "reset" state)
            timeSelectionSection.style.display = value >= operationalMinGuests ? '' : 'none';
        }
    }

    function updateCoversDisplayAndSummary() {
        coversDisplay.value = currentCovers;
        if (selectedCoversValueSpan) {
            selectedCoversValueSpan.textContent = (currentCovers === 0 && isInitialCoversState) ? '-' : currentCovers;
        }
        toggleTimeSelectionVisibilityLocal(currentCovers);
        updateButtonStates(); // Update button states whenever covers change
    }

    function triggerAvailabilityUpdate() {
        // Only trigger if covers are at a bookable level (>= operationalMinGuests)
        // The visibility of the time section is already handled by toggleTimeSelectionVisibilityLocal
        // which uses operationalMinGuests.
        // The call to handleCoversChangeGlobal itself has logic for covers === 0 (from previous step),
        // which means it won't fetch if covers is 0.
        // So, this check might be redundant if handleCoversChangeGlobal is robust.
        // However, explicit is good.
        if (currentCovers >= operationalMinGuests) {
            if (window.handleCoversChangeGlobal) {
                window.handleCoversChangeGlobal();
            } else {
                console.warn('handleCoversChangeGlobal is not defined on window. Availability check skipped.');
            }
        } else { // Covers are 0 (initial state) or less than operationalMin (should not happen if logic is correct)
            const timeSelectorContainer = document.getElementById('timeSelectorContainer');
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = '';
            const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
            if (window.resetAddonsAndNextButtonGlobal) {
                window.resetAddonsAndNextButtonGlobal();
            } else {
                const addonsDisplayArea = document.getElementById('addonsDisplayArea');
                if (addonsDisplayArea) addonsDisplayArea.innerHTML = '';
                const nextButton = document.getElementById('nextButton');
                if (nextButton) nextButton.disabled = true;
            }
        }
    }

    const debouncedTriggerAvailabilityUpdate = debounce(triggerAvailabilityUpdate, 500);

    coversDecrement.addEventListener('click', () => {
        const targetMin = isInitialCoversState ? 0 : operationalMinGuests;
        if (currentCovers > targetMin) {
            currentCovers--;
            // isInitialCoversState remains true if currentCovers becomes 0 again from operationalMinGuests
            // This specific edge case (decrementing from operationalMin to 0) might need refinement
            // based on desired behavior (should it revert to initial state or stick to opMin floor?).
            // For now, assume if it hits 0, it's like the initial state for display purposes.
            if (currentCovers === 0 && !isInitialCoversState) {
                // This path should ideally not be hit if decrement is disabled at operationalMinGuests
                // but if it is, treat 0 as initial display state.
            }
            updateCoversDisplayAndSummary();
            debouncedTriggerAvailabilityUpdate();
        }
        updateButtonStates(); // Ensure buttons update even if value doesn't change (e.g. at boundary)
    });

    coversIncrement.addEventListener('click', () => {
        if (currentCovers < maxGuests) {
            if (isInitialCoversState && currentCovers === 0) {
                // First increment from 0: set currentCovers to operationalMinGuests
                currentCovers = operationalMinGuests;
                isInitialCoversState = false;
            } else {
                currentCovers++;
                if (isInitialCoversState) { // Should be false now unless opMin was 0
                    isInitialCoversState = false;
                }
            }
            updateCoversDisplayAndSummary();
            debouncedTriggerAvailabilityUpdate();
        }
        updateButtonStates(); // Ensure buttons update
    });

    coversDisplay.addEventListener('change', () => { // Using 'change' event
        let newValue = parseInt(coversDisplay.value);
        const floorValue = isInitialCoversState ? 0 : operationalMinGuests;

        if (isNaN(newValue) || newValue < floorValue) {
            newValue = floorValue;
        } else if (newValue > maxGuests) {
            newValue = maxGuests;
        }

        if (isInitialCoversState && newValue >= operationalMinGuests) {
            isInitialCoversState = false;
        }
        // If user types 0 after being in non-initial state, what happens?
        // Current logic: if newValue is 0, and was not initial, it will be set to operationalMinGuests by floorValue logic above.
        // If it *was* initial, 0 is fine.

        currentCovers = newValue;
        updateCoversDisplayAndSummary();
        debouncedTriggerAvailabilityUpdate();
        updateButtonStates();
    });

    // Initial setup
    updateCoversDisplayAndSummary(); // Sets display, summary, and initial button states.
});
// Note: The logic for minGuests (from dataset, floor for input) vs operationalMinGuests (from config, actual booking min)
// is now more complex. Ensure window.bookingConfig is populated by main.js before this script runs.
// If window.bookingConfig.minGuests is not available, it defaults to 1.
// The minGuests from dataset (e.g. coversDisplay.dataset.min) should ideally be 0 to allow the "reset" state.
// If coversDisplay.dataset.min is 1, then currentCovers cannot be initialized to 0 effectively through user interaction.
// This assumes main.js sets coversDisplay.dataset.min to "0" if this "initial zero" state is desired.
