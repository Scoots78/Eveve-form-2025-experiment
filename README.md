# Restaurant Booking Form

## Project Description
This project is a web application designed to enable users to initiate a restaurant booking process. It dynamically fetches restaurant-specific configurations (like operating hours, available areas, and menu addons) and real-time availability (time slots based on date and party size) from an external third-party service (`nz.eveve.com`). Users can select a date, number of guests, preferred time, area (if applicable), and any available addons. The application then summarizes these selections, preparing for a subsequent booking confirmation step (which is not yet implemented).

## Features
- Dynamic loading of restaurant-specific configurations.
- Date selection using an interactive calendar interface (Flatpickr).
- Selection for the number of guests.
- Display of available time slots based on selected date and guest count, fetched in real-time.
- Optional area selection within the restaurant, if configured by the establishment.
- Selection of addons/menus specific to the chosen time slot and shift.
- A summary display of all selected booking details.
- Dynamic UI updates based on user selections and fetched data.

## Technology Stack
- **Backend:** Python (Flask framework)
- **Frontend:** JavaScript (Vanilla, modular ES6), HTML5, CSS3
- **Data Extraction:** Python (`requests` library for HTTP calls, `re` module for regular expression-based parsing) to scrape and extract JavaScript variable values from the HTML content of an external website.

## Project Structure
- **`app.py`**: The main Flask application. It serves the static frontend files (`booking_page.html`, JavaScript modules, `style.css`) and provides a crucial API endpoint:
    - `/api/get-config`: This endpoint takes an establishment identifier (`est`) as a query parameter. It then uses `extract_js_vars_logic.py` to fetch and parse configuration data from the external restaurant's booking page on `nz.eveve.com`. This configuration is then returned as JSON to the frontend.
- **`booking_page.html`**: The single HTML page that structures the booking form and user interface.
- **JavaScript Modules (formerly `form_logic.js`)**: The frontend logic is now modularized into several JavaScript files:
    - **`main.js`**: The main entry point for the frontend application. It orchestrates the initialization of other modules, sets up global handlers, and manages the overall application flow.
    - **`config_manager.js`**: Responsible for fetching the initial restaurant configuration (via `/api/get-config`) and storing it. This configuration includes crucial data like `eventsB` (array of event definitions) and `showEventsFeature` (flag for enabling event display), addon details, and area settings. Provides getters for other modules to access this configuration.
    - **`api_service.js`**:
        - Manages direct API interactions with the external `nz.eveve.com` service.
        - `fetchAvailableTimes(est, date, covers)`: Fetches day-specific availability. The response can include standard shifts, special *events* (within the `shifts` array of the response), and area information.
        - `holdBooking(holdApiData)`: Sends a GET request to `nz.eveve.com/web/hold` to attempt a temporary booking. `holdApiData` includes `est`, `lng`, `covers`, `date`, `time`, and conditionally `area` (for shift bookings with specific area), `addons` (comma-separated string of selected addon UIDs/quantities), and `eventId` (if an event is selected).
    - **`event_handlers.js`**:
        - Manages user interactions (e.g., date selection, guest number changes, time/event selection, addon choices, area selection) and coordinates the application's response.
        - `handleDateOrCoversChange()`: Initiates fetching of availability data (which can include events) from `api_service.js` and triggers UI updates via `ui_manager.js`.
        - `timeSlotDelegatedListener()`: Handles clicks on both regular time slot buttons (shifts) and special event buttons.
            - For *event clicks*: Retrieves canonical event details from `config_manager.js` (using `eventsB`), updates `state_manager.js` with selected event details (including UID and selected time), typically resets/hides addons and area selection as they may not apply or differ for events.
            - For *shift clicks*: Sets selected shift details, triggers rendering of relevant addons (via `ui_manager.js`) based on the shift's configuration and potentially selected area, and updates area selector states.
        - `handleAddonUsage1Selection()`, `handleAddonUsage2Selection()`, `handleAddonUsage3Selection()`: Implement the logic for selecting/deselecting addons based on their `usage` type (e.g., radio, checkbox, quantity input), updating `state_manager.js`.
        - `handleAreaChange()`: Responds to area selection changes, re-evaluating and re-rendering addons if necessary for the new area context.
        - `handleNextButtonClick()`: Constructs the `holdApiData` object (including `area`, `addons`, `eventId` as appropriate) and calls `api_service.js.holdBooking()`. Manages UI transitions to the customer details form upon successful hold.
        - `handleConfirmBookingSubmit()`: Makes a direct `fetch` PATCH request to `nz.eveve.com/web/update` to finalize the booking, sending customer details and the selected `addons` string.
    - **`ui_manager.js`**:
        - Handles all direct DOM manipulations for updating the user interface.
        - `displayTimeSlots(availabilityData)`: Renders buttons for available time slots. Critically, this function now also handles rendering special "event" buttons if events are present in `availabilityData.shifts`, distinguishing them visually or by metadata from regular shift time slots.
        - `renderAddons(addonsArray, usagePolicy, covers, shiftName, areaUID)`: Dynamically creates and displays addon selection UI elements (checkboxes, radio buttons, quantity selectors with plus/minus buttons) based on the `addons` array provided for a selected shift/event and its `usage` policy. It considers the number of covers for `usage2` addons and filters addons by area if applicable.
        - Manages visibility and content of summary sections, loading indicators, error messages, and area selectors.
    - **`state_manager.js`**: Manages the shared application state, such as current selections for date, covers, time (decimal format), selected shift name, selected area UID, selected event details (including UID and time), and selected addons (categorized by `usage` type).
    - **`dom_utils.js`**: Provides utility functions for common DOM manipulation tasks, string formatting (e.g., `formatTime`), and formatting selected addons into a comma-separated string for API calls (`formatSelectedAddonsForApi`).
    - **`calendar_control.js`**: Manages the Flatpickr calendar instance, including its initialization, event handling for date selection, and integration with the rest of the application.
    - **`booking_page.js`**: Contains specific UI logic for the "number of guests" (covers) input, including increment/decrement buttons and debounced calls to update availability.
- **`extract_js_vars_logic.py`**: A Python module dedicated to fetching the HTML content of a specific restaurant's booking page from `nz.eveve.com`. It then uses regular expressions to find and extract the values of predefined JavaScript variables (like `eventsB`, `addonMassage`, `areas`, etc.) from inline script tags within that HTML. These variables constitute the initial configuration data for the application.
- **`style.css`**: The CSS file providing all styling for `booking_page.html`, including styles for the Flatpickr calendar, time slots, event buttons, and addon elements.

## Setup and Installation
1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Ensure Python 3.x is installed.**
3.  **Create and activate a virtual environment (recommended):**
    ```bash
    python -m venv venv
    # On Windows
    # venv\Scriptsctivate
    # On macOS/Linux
    # source venv/bin/activate
    ```
4.  **Install dependencies:**
    ```bash
    pip install Flask requests
    ```
5.  **Run the application:**
    ```bash
    python app.py
    ```
6.  **Access the application:**
    Open a web browser and navigate to `http://localhost:3010?est=YOUR_EST_NAME`.
    Replace `YOUR_EST_NAME` with a valid establishment identifier from `nz.eveve.com` (e.g., `TestNZWorkforce1` for testing).

## API Endpoint
-   **`/api/get-config?est=<establishment_name>`**
    -   **Method:** GET
    -   **Description:** Retrieves essential configuration variables for the specified restaurant establishment. This data is scraped by the Python backend (`extract_js_vars_logic.py`) from the live booking page of the restaurant on `nz.eveve.com` (specifically, from `https://nz.eveve.com/web/form?est=<est_name>`).
    -   **Parameters:**
        -   `est` (string, required): The unique identifier for the restaurant establishment.
    -   **Returns:** JSON object containing key-value pairs of configuration data. This includes, but is not limited to:
        -   Restaurant operational details (name, hours, etc.).
        -   Language strings for UI elements.
        -   Shift definitions and their properties.
        -   Area configuration (e.g., `arSelect` flag, list of areas).
        -   Addon definitions, including their types, pricing, and usage rules (`usage1`, `usage2`, `usage3`).
        -   Event definitions (`eventsB` array), including their UIDs, names, descriptions, and other properties.
        -   Flags like `showEventsFeature` to control event visibility.

## External Dependencies
-   **`nz.eveve.com`**: The application is critically dependent on this external third-party service for all its core booking data and operations. Any changes to their API endpoints or data structures can break this application. Key interactions include:
    1.  **Initial Configuration (`app.py` via `extract_js_vars_logic.py`):**
        *   Endpoint: `https://nz.eveve.com/web/form?est=<est_name>`
        *   Method: GET
        *   Purpose: The Python backend scrapes this page's HTML to extract JavaScript variables. These variables provide essential setup information, including restaurant details, language strings, shift definitions, area configurations, addon details, and event definitions (`eventsB`).
    2.  **Real-time Availability (`api_service.js`):**
        *   Endpoint: `https://nz.eveve.com/web/day-avail?est=<est_name>&covers=<covers>&date=<date>`
        *   Method: GET
        *   Purpose: Fetches available time slots, area details, and information about specific events or shifts for the selected date and number of guests. The response's `shifts` array can contain both regular shifts and special event objects.
    3.  **Temporary Booking Hold (`api_service.js`):**
        *   Endpoint: `https://nz.eveve.com/web/hold`
        *   Method: GET
        *   Purpose: Attempts to place a temporary hold on a selected time slot or event.
        *   Key Parameters: `est`, `lng`, `covers`, `date`, `time`. Conditionally includes `area` (for non-event bookings with area selection), `addons` (formatted string of selected addon UIDs and quantities), and `eventId` (if an event is selected instead of a regular time slot).
    4.  **Booking Confirmation/Update (`event_handlers.js` directly using `fetch`):**
        *   Endpoint: `https://nz.eveve.com/web/update`
        *   Method: PATCH
        *   Purpose: Confirms the booking by providing customer details and associating them with the previously acquired booking hold (`uid`).
        *   Key Parameters: `est`, `uid` (from hold response), `lng`, `firstName`, `lastName`, `phone`, `email`, `notes`, `optem` (opt-in marketing). Critically, it also includes the `addons` parameter if addons were selected.
-   **Flatpickr**: A lightweight, powerful datetime picker used for the calendar interface. (Loaded via CDN in `booking_page.html`)

## How it Works
1.  The user accesses the application URL with an `est` query parameter (e.g., `http://localhost:3010?est=TestNZWorkforce1`).
2.  The Flask backend (`app.py`) serves `booking_page.html` and related static assets.
3.  `main.js` on the frontend is initiated. It coordinates with `config_manager.js` to fetch the restaurant configuration.
4.  `config_manager.js` triggers a call to the Flask backend's `/api/get-config` endpoint.
5.  The `/api/get-config` endpoint in `app.py` calls `extract_js_vars_logic.py`.
6.  `extract_js_vars_logic.py` makes an HTTP GET request to `https://nz.eveve.com/web/form?est=<est_name>` to fetch the restaurant's main booking page HTML.
7.  It then parses this HTML to extract values from inline JavaScript variables (configuration).
8.  This configuration JSON is sent back to `config_manager.js`, which stores it and makes it available to other modules via `state_manager.js`.
9.  `main.js` initializes the UI elements using `ui_manager.js` and sets up event listeners using `event_handlers.js`. The calendar is initialized by `calendar_control.js`.
10. When the user selects a date (via `calendar_control.js`) or changes the number of guests (via `booking_page.js`), `event_handlers.js` triggers an update.
11. `event_handlers.js` then calls `api_service.js` to make an asynchronous GET request to `https://nz.eveve.com/web/day-avail?est=<est_name>&covers=<covers>&date=<date>`. This API call fetches:
    *   Available time slots.
    *   Area information (if applicable to the restaurant).
    *   Details about specific *events* or *shifts* available for the selected date and party size. The API response's `shifts` array can contain both regular shift objects and special event objects.
12. The response data from `day-avail` is processed. `ui_manager.js` dynamically updates the UI to display:
    *   Regular time slot buttons for standard shifts.
    *   Special "event" buttons if any events are returned by the API for the selected day. These are derived from the `shifts` array in the API response but may be cross-referenced with canonical event data from the initial configuration (`eventsB`).
    *   Area selection options (e.g., radio buttons) if the restaurant is configured for area selection (`arSelect` is true) and areas are available.
13. If a user selects a time slot (for a shift) or an event button:
    *   If it's a shift, and addons are associated with that shift (and potentially the selected area), `ui_manager.js` renders the addon selection interface. Addons can have different behaviors based on their `usage` type (e.g., `usage1` for single-choice radio/checkbox, `usage2` for quantity selection, `usage3` for multiple-choice checkboxes).
    *   If it's an event, addon availability depends on the event's configuration. Often, events may not have separate addons, or they might be intrinsic to the event package.
14. A summary of the user's selections (date, time, guests, area, selected addons) is continuously updated on the page by `ui_manager.js` based on data held in `state_manager.js`.
15. When the user clicks the "Next" button, `event_handlers.js` gathers all selected data and calls `api_service.js`'s `holdBooking` function. This makes a GET request to `https://nz.eveve.com/web/hold`.
    *   The data sent includes `est`, `lng` (language), `covers`, `date`, and `time`.
    *   Crucially, it also conditionally includes:
        *   `area`: The UID of the selected area, if area selection is active and an area is chosen (not applicable for "any" area or if an event is selected).
        *   `addons`: A comma-separated string of selected addon UIDs (and quantities for `usage2` addons), formatted by `dom_utils.js`.
        *   `eventId`: The UID of the selected event, if an event was chosen instead of a regular time slot. If `eventId` is present, `area` is typically not sent.
    *   If the hold is successful, the application transitions to a view for collecting customer details. Otherwise, an error is shown.
16. After a successful hold, the user enters their details. Submitting this form triggers `event_handlers.js` to make a PATCH request (directly via `fetch`) to `https://nz.eveve.com/web/update`. This call includes the customer's information, the `uid` from the successful hold response, and again, the selected `addons` string. This finalizes the booking.

## Current Status Assessment (as of May 2024)
-   The application successfully provides a user interface for the initial stages of creating a restaurant booking, now featuring an interactive calendar.
-   It demonstrates the capability to fetch, parse, and utilize complex configuration and real-time availability data from the external `nz.eveve.com` service.
-   The core logic for selecting date, covers, time, area (where applicable), and addons is functional.
-   The frontend JavaScript has been refactored into modules for better organization and maintainability.
-   The "Next" button correctly gathers all selected booking parameters.
-   Area selection persistence across date/cover changes was identified as an improvement area but has been deferred for the current task.

## Suggested Next Steps / Future Development
-   **Implement "Hold" API Interaction:** This is the most critical next step. The data collected by the "Next" button should be used by `api_service.js` to make an API call to `https://nz.eveve.com/web/hold` (or a similar endpoint) to attempt to place a temporary hold on the selected booking slot. This would involve handling the API response (success/failure) and providing feedback to the user via `ui_manager.js`.
-   **Comprehensive Error Handling & Resilience:**
    -   Enhance error handling in `api_service.js` for all external API calls (`day-avail` fetching, and the future `hold` call). Implement user-friendly messages via `ui_manager.js` for network timeouts, server errors from `nz.eveve.com`, or unexpected data formats.
    -   Add more specific error detection within `extract_js_vars_logic.py` if essential configuration variables are not found in the scraped HTML, potentially falling back to defaults or alerting the user.
-   **UI/UX Enhancements:**
    -   Implement more noticeable and consistent loading indicators (e.g., spinners or ghost elements) in `ui_manager.js` while data is being fetched asynchronously by `api_service.js`.
    -   Improve visual feedback for disabled options or unavailable time slots.
    -   Review and refine the layout, especially for the addons section, to ensure clarity and ease of use, particularly if there are many addons.
    -   Consider adding client-side validation messages for inputs like guest numbers (e.g., if outside min/max) using `event_handlers.js` and `ui_manager.js`.
-   **Code Quality & Maintainability:**
    -   The refactoring of `form_logic.js` into multiple modules has significantly improved code organization. Continue to ensure that each module maintains its specific responsibility.
    -   Add more inline comments to complex sections of the JavaScript and Python code to improve readability and maintainability.
-   **Testing Strategy:**
    -   **Frontend (JavaScript):** Implement unit tests for key utility functions in `dom_utils.js`, logic in `state_manager.js`, `config_manager.js`, `api_service.js`, and event handling logic using a framework like Jest or Mocha. Test individual components like `calendar_control.js` and `booking_page.js`.
    -   **Backend (Python):**
        -   Add unit tests for `extract_js_vars_logic.py` to verify that it correctly parses variables from sample HTML content under various scenarios (e.g., variables present, absent, different formats).
        -   Write unit tests for the Flask API endpoint in `app.py` to ensure it handles requests correctly and interacts as expected with `extract_js_vars_logic.py`.
-   **Configuration Robustness:**
    -   The list `VARIABLES_TO_EXTRACT` in `extract_js_vars_logic.py` is fundamental. If `nz.eveve.com` alters its frontend JavaScript variable names or structure, the scraping mechanism will break. Consider adding a post-extraction check for the presence of essential variables and logging warnings or errors if they are missing.
    -   Explore ways to make the configuration extraction less brittle, though this is challenging with web scraping.

## Event Selection Flow
The application supports booking special events if they are configured for the restaurant and made available through the `nz.eveve.com` API.

1.  **Configuration:** Event definitions (including UIDs, names, descriptions, times, etc.) are initially scraped from the restaurant's booking page HTML (from a JavaScript variable, typically `eventsB`) by `extract_js_vars_logic.py` and passed to the frontend via the `/api/get-config` endpoint. This canonical event data is stored by `config_manager.js`. A flag like `showEventsFeature` may also control overall event visibility.
2.  **Availability Check:** When a user selects a date and number of guests, the `fetchAvailableTimes` function in `api_service.js` calls the `nz.eveve.com/web/day-avail` API. The response's `shifts` array can contain objects that represent these pre-defined events, alongside regular shifts.
3.  **Display:** `ui_manager.js`, specifically in its `displayTimeSlots` function, checks the items in the `shifts` array from the API. If an item corresponds to an event (e.g., by matching an ID or a specific property), it's rendered as a distinct "event button" in the time selection area, often visually differentiated from standard time slots. The button will typically display the event's name and specific start time.
4.  **Selection:**
    *   When a user clicks an event button, the `timeSlotDelegatedListener` in `event_handlers.js` identifies it as an event selection.
    *   It retrieves the full canonical details of the event from `config_manager.js` (using the event's UID).
    *   The selected event's details (including its UID and the specific time slot chosen, if the event has multiple sittings) are stored in `state_manager.js`.
    *   Typically, selecting an event will:
        *   Bypass regular shift-based area selection (area selection is usually hidden or disabled).
        *   Reset or hide any previously displayed addons, as addons are generally tied to shifts or might be included intrinsically with the event package. Addon availability for events depends on the specific configuration.
5.  **Booking Process (Hold Call):**
    *   When proceeding to the "Next" step (hold call), if an event is selected, `event_handlers.js` includes an `eventId` parameter (with the event's UID) in the `holdApiData` sent to `nz.eveve.com/web/hold`.
    *   The `area` parameter is usually omitted when `eventId` is present.
    *   Addons might be sent if they are specifically applicable and selected for that event.

This flow allows the system to dynamically offer and process bookings for special events alongside regular table reservations.

## Addon Selection Flow
Addons (extras like set menus, special offers, or pre-ordered items) can be selected by the user if they are available for the chosen time slot/event and area.

1.  **Configuration:** Addon definitions (UID, name, price, description, type, usage policy, area/shift applicability) are part of the initial configuration scraped by `extract_js_vars_logic.py` and provided to the frontend. `config_manager.js` stores this.
2.  **Availability and Display:**
    *   After a user selects a time slot (for a regular shift) and, if applicable, an area, `event_handlers.js` (often triggered by `timeSlotDelegatedListener` or `handleAreaChange`) determines which addons are relevant.
    *   `ui_manager.js` (specifically `renderAddons`) then dynamically generates the UI elements for these available addons.
    *   The rendering depends on the addon's `usage` policy:
        *   **`usage: 0` or `usage: 1` (Single Choice):** Often rendered as radio buttons (if multiple `usage: 1` addons are grouped) or a single checkbox. The user can select one. `usage: 0` might imply an addon is informational or automatically included.
        *   **`usage: 2` (Quantity Choice):** Rendered with a quantity input field and plus/minus buttons, allowing the user to specify how many of the addon they want (often up to the number of guests).
        *   **`usage: 3` (Multiple Choice):** Rendered as checkboxes, allowing the user to select multiple addons from a list.
    *   Addons can also be filtered based on whether they are applicable to the selected area (`areaUID` parameter in `renderAddons`).
3.  **Selection Logic:**
    *   User interactions with addon UI elements (clicks on checkboxes, radios, quantity buttons) are handled by delegated listeners in `event_handlers.js` (e.g., `addonsDelegatedListener` which calls specific handlers like `handleAddonUsage1Selection`, `handleAddonUsage2Selection`, `handleAddonUsage3Selection`).
    *   These handlers update the `selectedAddons` object in `state_manager.js`, which keeps track of chosen addons and their quantities.
    *   The UI summary of selected addons is updated by `ui_manager.js`.
4.  **Booking Process (Hold and Update Calls):**
    *   When the user proceeds to the "Next" step (hold call), `event_handlers.js` retrieves the selected addons from `state_manager.js`.
    *   `dom_utils.js.formatSelectedAddonsForApi()` formats this data into a comma-separated string (e.g., `addonUID1,addonUID2:qty2,addonUID3`).
    *   This `addons` string is included as a query parameter in the GET request to `nz.eveve.com/web/hold`.
    *   Similarly, for the final booking confirmation, this `addons` string is also included in the PATCH request to `nz.eveve.com/web/update`.

This system allows for flexible addon offerings tailored to specific shifts, events, and areas, enhancing the booking customisation.

## Known Issues/Limitations
-   **Critical Dependency on External Site:** The entire application hinges on the consistent structure and availability of `nz.eveve.com`. Any significant changes to their frontend HTML (specifically, the inline JavaScript variables) or API endpoints will likely break this application. This is a common risk with web scraping-based integrations.
-   **Area Selection Stickiness (Deferred):** The user's selected area is not reliably remembered if they change the date or number of guests. This was identified for improvement but deferred from the current scope of work. This primarily affects the user experience if they go back and forth changing parameters after an initial area selection.
-   **Limited `est` Parameter Discovery:** Users need to know a valid `est` (establishment) identifier to use the application. There's no built-in mechanism to browse or search for available establishments.
-   **Error Handling Granularity:** While error handling exists, particularly for API calls, further refinement could provide more specific feedback to users for different failure scenarios (e.g., specific business logic errors from Eveve vs. network issues).
