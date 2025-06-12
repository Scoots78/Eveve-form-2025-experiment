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
    - **`main.js`**: The main entry point for the frontend application. It orchestrates the initialization of other modules and manages the overall application flow.
    - **`config_manager.js`**: Responsible for fetching the initial restaurant configuration (via `/api/get-config`) and storing it.
    - **`api_service.js`**: Handles all API calls to the external `nz.eveve.com` service, such as fetching day-specific availability (time slots, areas).
    - **`event_handlers.js`**: Manages user interactions (e.g., date selection, guest number changes) and coordinates the application's response to these events.
    - **`ui_manager.js`**: Handles updates to the DOM, including rendering dynamic content like time slots, areas, and addons based on fetched data and user selections.
    - **`state_manager.js`**: Manages the shared application state, such as current selections for date, covers, time, area, and addons.
    - **`dom_utils.js`**: Provides utility functions for common DOM manipulation tasks and formatting.
    - **`calendar_control.js`**: Manages the Flatpickr calendar instance, including its initialization, event handling for date selection, and integration with the rest of the application.
    - **`booking_page.js`**: Contains specific logic related to the covers input on the booking page, potentially handling validation or specific UI interactions for guest number selection.
- **`extract_js_vars_logic.py`**: A Python module dedicated to fetching the HTML content of a specific restaurant's booking page from `nz.eveve.com`. It then uses regular expressions to find and extract the values of predefined JavaScript variables from inline script tags within that HTML. These variables constitute the configuration data for the application.
- **`style.css`**: The CSS file providing all styling for `booking_page.html`, including styles for the Flatpickr calendar.

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
    -   **Description:** Retrieves essential configuration variables for the specified restaurant establishment. This data is scraped from the live booking page of the restaurant on `nz.eveve.com`.
    -   **Parameters:**
        -   `est` (string, required): The unique identifier for the restaurant establishment.
    -   **Returns:** JSON object containing key-value pairs of configuration data (e.g., restaurant name, language strings, shift details, addon information, area selection policy).

## External Dependencies
-   **`nz.eveve.com`**: The application is critically dependent on this external service for:
    1.  Initial configuration data (scraped from its HTML).
    2.  Real-time availability data (fetched via its `day-avail` API endpoint).
    The structure, content, and availability of this external site directly and significantly impact the application's functionality.
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
10. When the user selects a date using the Flatpickr calendar, `calendar_control.js` captures the selection. `event_handlers.js` responds to this change (and changes to guest numbers via `booking_page.js` logic).
11. `event_handlers.js` instructs `api_service.js` to make an asynchronous GET request to `https://nz.eveve.com/web/day-avail?est=<est_name>&covers=<covers>&date=<date>` to fetch available time slots, areas, and specific shift details.
12. The response data is processed, and `ui_manager.js` dynamically updates the UI to display available time slots, areas, and addons.
13. If addons are associated with the selected time/shift, `ui_manager.js` renders them for user selection.
14. A summary of the user's selections (date, time, guests, area, addons) is continuously updated on the page by `ui_manager.js`, based on data held in `state_manager.js`.
15. The "Next" button currently gathers all selected data (managed by `event_handlers.js` and `state_manager.js`) but does not yet perform a booking/hold action.

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

## Known Issues/Limitations
-   **Critical Dependency on External Site:** The entire application hinges on the consistent structure and availability of `nz.eveve.com`. Any significant changes to their frontend HTML (specifically, the inline JavaScript variables) or API endpoints will likely break this application. This is a common risk with web scraping-based integrations.
-   **No Booking Finalization:** The application currently only allows the user to select booking parameters. It does not actually make or confirm a booking with the restaurant.
-   **Area Selection Stickiness (Deferred):** The user's selected area is not reliably remembered if they change the date or number of guests. This was identified for improvement but deferred from the current scope of work.
-   **Limited `est` Parameter Discovery:** Users need to know a valid `est` (establishment) identifier to use the form. There's no built-in way to discover these.
