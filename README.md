## Project Overview
This project is a web-based booking form system designed to allow users to book appointments or reservations. It features dynamic loading of establishment-specific configurations, real-time availability checking, and selection of services or addons.

The backend is powered by Flask (Python), and the frontend interactivity is managed by vanilla JavaScript.

## Features
-   **Dynamic Configuration:** Loads specific settings and services (like available shifts, addons, min/max party size, language preferences) for each establishment dynamically.
-   **Date & Guest Selection:** Users can select their desired date and number of guests for the booking.
-   **Real-Time Availability:** Checks and displays available time slots by querying an external API in real-time.
-   **Shift-Based Time Slots:** Available times are presented grouped by shifts (e.g., Lunch, Dinner).
-   **Flexible Addon Selection:** Supports different addon behaviors based on the shift's configuration (`usage` policy):
    *   **No Menu Selection (`usage: 0`):** Shifts where no specific menu selection is enforced or primarily offered.
    *   **All Guests Same Menu (`usage: 1`):** All guests receive the same selected menu/addon (typically presented as a single checkbox for one option, or radio buttons for multiple options).
    *   **Each Guest Any Menu (`usage: 2`):** Each guest can select different menus/addons, or multiples of the same, often managed with quantity selectors.
    *   **Optional Menus (`usage: 3`):** Guests can choose from a list of optional addons (typically presented as checkboxes), where the selection is not tied to the number of guests for its core logic.
    *   Addons can also be configured to be charged **per guest** or **per party**.
-   **Custom Messages:** Displays messages from the establishment, either for the day or specific to a shift.

## File Structure
-   `app.py`: The main Flask application file. It serves the static frontend files and provides the `/api/get-config` endpoint.
-   `form_logic.js`: Contains all the client-side JavaScript logic for handling user interactions, fetching availability, and displaying information on `booking_page.html`.
-   `booking_page.html`: The primary HTML file that structures the booking form presented to the user. It links to `form_logic.js` and `style.css`.
-   `style.css`: Contains all CSS rules for styling the booking form.
-   `extract_js_vars_logic.py`: Python script responsible for fetching and parsing establishment-specific configuration data from external sources. `get_config_for_establishment` is the key function used by `app.py`.
-   `extract_js_vars.py`: Likely a supporting script for `extract_js_vars_logic.py` or part of the configuration extraction mechanism.
-   `booking_form.html`: An HTML file that appears to be an example or an older, self-contained version of a booking form, with JavaScript variables defined directly within the file.
-   `form_content.html`: Similar to `booking_form.html`, this file also seems to be a standalone HTML example with embedded JavaScript, likely for reference or testing purposes.
-   `README.md`: This file.

## Setup and Running the Application

### Prerequisites
-   Python 3.x
-   pip (Python package installer)

### Installation
1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    Open your terminal and run:
    ```bash
    pip install Flask requests
    ```

### Running the Application
1.  **Start the Flask server:**
    Navigate to the project's root directory in your terminal and run:
    ```bash
    python app.py
    ```
    You should see output indicating the server is running, typically on `http://localhost:3010`.

2.  **Access the booking form:**
    Open your web browser and go to:
    ```
    http://localhost:3010/booking_page.html?est=your_establishment_name
    ```
    **Important:** Replace `your_establishment_name` with an actual establishment identifier that the system is configured to fetch data for (i.e., one that works with the `extract_js_vars_logic.py` script). Without a valid `est` parameter, the application will show an error.

## API and Data Exchange

The application relies on both an internal backend API (for configuration) and an external API (for booking availability).

### 1. Internal Configuration API

*   **Purpose:** To fetch establishment-specific settings, such as name, language strings, shift definitions, addon details, and operational parameters.
*   **Endpoint:** `GET /api/get-config`
*   **Request Parameter:**
    *   `est` (string): The unique identifier for the establishment. This is passed as a URL query parameter.
*   **Response (JSON):**
    A JSON object containing various configuration key-value pairs. Important keys include:
    *   `estName` (string): Display name of the establishment.
    *   `lng` (string): A JSON string containing language key-value pairs for UI text.
    *   `allShifts` (string): A JSON string representing an array of shift objects. Each shift can have a `name`, `addons` array, and `usage` policy for addons.
    *   `partyMin` (string/number): Minimum number of guests allowed for a booking.
    *   `partyMax` (string/number): Maximum number of guests allowed for a booking.
    *   `currSym` (string): Currency symbol (e.g., "$").
    *   Other parameters relevant to the booking engine for that establishment.
*   **Data Flow:**
    1.  `form_logic.js` (frontend) requests configuration from `/api/get-config?est=<name>` when the page loads.
    2.  `app.py` (Flask backend) receives the request.
    3.  `app.py` calls `get_config_for_establishment(est_name)` from `extract_js_vars_logic.py`.
    4.  `extract_js_vars_logic.py` fetches raw data (likely a script or HTML) from an external source specific to the `est_name`.
    5.  It parses this raw data to extract the required variables.
    6.  The extracted variables are returned as a JSON response to `form_logic.js`.

### 2. External Availability API (Eveve)

*   **Purpose:** To fetch real-time booking availability (time slots) and associated shift-specific addons for a given date and party size.
*   **Endpoint:** `GET https://nz.eveve.com/web/day-avail`
*   **Request Parameters:**
    *   `est` (string): The establishment identifier.
    *   `covers` (number): The number of guests for the booking.
    *   `date` (string): The desired date for the booking, formatted as `YYYY-MM-DD`.
*   **Response (JSON):**
    A JSON object detailing daily and shift-specific information.
    *   `message` (string, optional): A general message from the establishment for the selected date (e.g., "Kitchen closes early").
    *   `shifts` (array): An array of shift objects available for the selected date and party size. Each shift object contains:
        *   `name` (string): Name of the shift (e.g., "Dinner").
        *   `message` (string, optional): A message specific to this shift.
        *   `times` (array of numbers): A list of available time slots in decimal format (e.g., `18.5` for 6:30 PM). A negative number usually indicates an unavailable slot that might still be displayed.
        *   `addons` (array of objects, optional): A list of addon items available for that specific shift. Each addon object typically includes:
            *   `uid` (number): Unique ID for the addon.
            *   `name` (string): Name of the addon.
            *   `price` (number): Price of the addon (often in cents).
            *   `desc` (string): Description of the addon.
            *   `per` (string): Basis of the addon charge, typically "person" (charged per guest) or "booking" (charged once per party/booking).
            *   `min` (number), `max` (number): Min/max covers for which the addon is valid.
        *   `usage` (number, optional): An integer indicating the UI policy and behavior for addons in this shift:
            *   `0`: "No Menu Selection" - No specific menu selection is enforced.
            *   `1`: "All guests same menu" - Typically a single choice (radio button/single checkbox) applying to all guests.
            *   `2`: "Each guest any menu" - Allows quantity-based selection for addons, potentially different for each guest.
            *   `3`: "Optional Menus" - Multiple optional addons can be selected (checkboxes), selection logic not primarily dependent on guest count.
*   **Data Flow:**
    1.  `form_logic.js` (frontend) makes a `fetch` request to the Eveve API whenever the user changes the date or number of covers.
    2.  The Eveve API returns the availability data directly to `form_logic.js`.
    3.  `form_logic.js` processes this data to display time slots and addons.

### 3. Data Handled by `form_logic.js`

`form_logic.js` dynamically manages user selections and prepares data that would eventually be used for a booking. Key data structures include:

*   **User Input:** Selected date, number of covers, and chosen time slot.
*   **Addon Selections (`currentSelectedAddons` object):**
    *   `usage1` (object | null): Stores the selected addon if the shift's `usage` policy is 1 (single-choice, either one checkbox or one radio button from a group). Contains `{ uid, name, price }`.
    *   `usage2` (array of objects): Stores selected addons if the `usage` policy is 2 (quantity selection). Each object is `{ uid, name, price, quantity }`.
    *   `usage3` (array of objects): Stores selected addons if the `usage` policy is 3 (multiple checkboxes). Each object is `{ uid, name, price }`.
    This data is updated as the user interacts with the addon options.

## Future Enhancements

This section outlines potential improvements to enhance the user experience (UX), user interface (UI), and overall functionality of the booking system.

### 1. Improved UX/UI for Date/Time Selection
*   **Visual Calendar:** Implement a more interactive visual calendar component for date selection, potentially highlighting days with general availability or special events.
*   **Clearer Slot Status:** Enhance the visual distinction between available, selected, and unavailable time slots. Consider tooltips for unavailable slots if they are shown (e.g., "Fully booked", "Restaurant closed").
*   **Timezone Awareness:** If the application serves users across different timezones, ensure that all times are clearly communicated and handled correctly, possibly with user-selectable timezone preferences.

### 2. Customer Information Fields & Booking Data
*   **Integrate Customer Detail Inputs:** Add form fields to `booking_page.html` (or via `form_content.html` if it were to be used as a template) for users to enter their details. Based on `booking_form.html`, these would include:
    *   First Name
    *   Last Name
    *   Phone Number
    *   Email Address
    *   Special Notes/Requests
*   **Data Aggregation:** The `form_logic.js` would need to collect this information alongside the existing selections:
    *   `selectedCovers`: Number of guests.
    *   `selectedDate`: Date of booking.
    *   `selectedTime`: Time of booking.
    *   `selectedAddons`: Consolidated list of chosen addons from `currentSelectedAddons.usage1`, `currentSelectedAddons.usage2`, and `currentSelectedAddons.usage3`.

### 3. Booking Submission Process
*   **Implement `bookNow()` Functionality:** Develop the logic for a `bookNow()` function (or equivalent) in `form_logic.js`. This function would:
    1.  Validate all required fields (date, time, covers, customer details).
    2.  Compile all booking data (selections and customer details) into a structured JSON payload.
    3.  Send this payload to a new backend endpoint (e.g., `/api/create-booking`).
*   **Backend Booking Endpoint:** Create a new Flask route (e.g., `@app.route('/api/create-booking', methods=['POST'])`) in `app.py` to:
    1.  Receive the booking data.
    2.  Process the booking (this might involve validation, saving to a database, or forwarding to another system like Eveve's booking confirmation API, if available).
    3.  Return a success or error response to the client.

### 4. User Confirmation and Feedback
*   **On-Page Confirmation:** After a successful booking submission, display a clear confirmation message to the user on the page, including a summary of their booking.
*   **Email Confirmation:** Consider sending an email confirmation to the user (would require email sending capabilities on the backend).

### 5. Addon Management UI
*   **Enhanced Display:** For establishments with many addons or complex rules, improve the UI for addon selection. This could include categorization, better visual cues for addon types (e.g., per-person vs. per-booking), and clearer pricing display.
*   **Dynamic Price Updates:** Show a running total or dynamically update the price as addons are selected/deselected.
