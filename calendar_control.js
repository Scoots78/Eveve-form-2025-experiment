document.addEventListener('DOMContentLoaded', () => {
    const calendarHost = document.getElementById('flatpickr-calendar-host');
    const calendarTopBar = document.getElementById('calendar-top-bar');

    if (calendarHost && calendarTopBar) {
        // Add Click Listener to Top Bar to toggle calendar visibility
        calendarTopBar.addEventListener('click', () => {
            calendarHost.classList.toggle('calendar-visible');
        });

        const flatpickrInstance = flatpickr(calendarHost, {
            inline: true, // Render the calendar inline
            minDate: "today", // Disable past dates
            defaultDate: "today", // Select today's date by default
            dateFormat: "Y-m-d", // Internal format for Flatpickr
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    const displayDate = instance.formatDate(selectedDates[0], "D M j | Y");
                    calendarTopBar.textContent = displayDate;

                    const standardDate = instance.formatDate(selectedDates[0], "Y-m-d"); // dateStr is already Y-m-d
                    calendarTopBar.dataset.selectedDate = standardDate;

                    // Call the global handler
                    if (window.handleCoversChangeGlobal) {
                        window.handleCoversChangeGlobal();
                    } else {
                        console.warn('handleCoversChangeGlobal is not defined on window.');
                    }

                    // Auto-hide on Date Selection
                    if (calendarHost.classList.contains('calendar-visible')) {
                        calendarHost.classList.remove('calendar-visible');
                    }
                }
            }
        });

        // Initial Top Bar Update (after Flatpickr initialization)
        if (flatpickrInstance.selectedDates.length > 0) {
            const initialDisplayDate = flatpickrInstance.formatDate(flatpickrInstance.selectedDates[0], "D M j | Y");
            const initialStandardDate = flatpickrInstance.formatDate(flatpickrInstance.selectedDates[0], "Y-m-d");

            calendarTopBar.textContent = initialDisplayDate;
            calendarTopBar.dataset.selectedDate = initialStandardDate;
            // No need to call handleCoversChangeGlobal here, as main.js triggers the initial data load.
        }

        // Make calendar visible by default on load
        calendarHost.classList.add('calendar-visible');

        // Remove the dynamically created hidden input if it exists from previous step (cleanup)
        // This part might be redundant if it was already removed or never committed, but good for safety.
        const oldHiddenInput = document.getElementById('actualDateInput');
        if (oldHiddenInput && oldHiddenInput.parentElement) {
            oldHiddenInput.parentElement.removeChild(oldHiddenInput);
        }

    } else {
        if (!calendarHost) console.error("Flatpickr calendar host element (#flatpickr-calendar-host) not found.");
        if (!calendarTopBar) console.error("Calendar top bar element (#calendar-top-bar) not found.");
    }
});
