document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const bookingUid = params.get('bookingUid');
    const est = params.get('est');
    const lng = params.get('lng');

    if (!bookingUid || !est || !lng) {
        alert('Error: Missing booking information (UID, est, or lng). Please try your booking again.');
        window.location.href = 'booking_page.html'; // Redirect back
        return; // Stop further execution
    }

    console.log('Booking UID:', bookingUid, 'Est:', est, 'Lng:', lng);

    const form = document.getElementById('customerDetailsForm');
    const confirmButton = document.getElementById('confirmBookingButton');

    if (form && confirmButton) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const notes = document.getElementById('notes').value;
            const mailOptIn = document.getElementById('mailOptIn').checked;
            const optem = mailOptIn ? '1' : '0';

            // Validation
            if (!(firstName || lastName) || !(phone || email)) {
                alert('Please provide either a first or last name, and either a phone number or an email address.');
                return; // Stop submission
            }

            const baseUrl = 'https://nz.eveve.com/web/update';
            const queryParams = new URLSearchParams({
                est: est,
                uid: bookingUid,
                lng: lng,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                email: email,
                notes: notes,
                optem: optem
            });
            const apiUrl = `${baseUrl}?${queryParams.toString()}`;

            console.log('Confirm Booking API URL:', apiUrl);

            confirmButton.disabled = true;
            confirmButton.textContent = 'Confirming...';

            try {
                const response = await fetch(apiUrl, {
                    method: 'PATCH'
                });

                const responseData = await response.json();

                if (response.ok && responseData.ok === true) {
                    alert('Booking confirmed successfully!');
                    confirmButton.textContent = 'Booking Confirmed!';
                    // Form elements could be disabled here:
                    // Array.from(form.elements).forEach(el => el.disabled = true);
                } else {
                    const errorMessage = responseData.msg || responseData.message || 'Failed to confirm booking. Please try again.';
                    alert(`Error: ${errorMessage}`);
                    confirmButton.disabled = false;
                    confirmButton.textContent = 'Confirm Booking';
                }
            } catch (error) {
                console.error('Error confirming booking:', error);
                alert('An unexpected error occurred while confirming your booking. Please try again.');
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirm Booking';
            }
        });
    } else {
        console.error('Customer details form or confirm button not found.');
        alert('A critical page error occurred. Please try again or contact support.');
    }
});
