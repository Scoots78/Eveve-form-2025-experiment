# Version: 20240507-100000
import os
from flask import Flask, jsonify, request, send_from_directory
from extract_js_vars_logic import get_config_for_establishment

# Initialize Flask App
# Serve static files (booking_page.html, form_logic.js, style.css) from the current directory
app = Flask(__name__, static_folder='.', static_url_path='')

# API Endpoint to get configuration
@app.route('/api/get-config')
def get_config_api():
    est_name = request.args.get('est')
    if not est_name:
        return jsonify({"error": "Missing 'est' parameter"}), 400

    print(f"API: Received request for est_name: {est_name}", flush=True) # Server-side log
    config_data = get_config_for_establishment(est_name)

    if config_data is None:
        # This indicates a failure in fetching or critical parsing step within get_config_for_establishment
        print(f"API: Failed to retrieve or parse configuration for {est_name} from external source.", flush=True)
        return jsonify({"error": "Failed to retrieve or parse configuration from external source"}), 500
    
    if not config_data: # Checks if the dictionary is empty
        # This means HTML/script was fetched, but no variables from our list were found
        print(f"API WARNING: No variables extracted for {est_name} from its source. Providing default fallback configuration.", flush=True)
        # Provide a minimal, default configuration
        default_config = {
            "estName": f"{est_name} (Default Config)",
            "currSym": "$",
            "country": "NZ", # Assuming NZ as a default if not specified
            "lng": "{'errorGeneric': 'Default config: Language data not found.'}", # Basic language string
            "allShifts": "[]", # Empty shifts array
            "partyMin": "1",
            "partyMax": "10",
            "horizon": "90", # Default booking horizon
            "timeStep": "30",
            "arSelect": "false",
            "showEvents": "false", # Disable events if main config fails
            "eventsB": "[]",
            # Add other critical keys with sensible defaults if the frontend expects them
            # For example, if `config.usrLang` is critical in main.js or elsewhere before full parsing.
            "usrLang": "'en'", # Default language
            "minGuests": "1" # Default minimum guests for booking_page.js
        }
        # Log that we are returning a default config
        print(f"API: For {est_name}, returning a minimal default configuration due to extraction failure.", flush=True)
        return jsonify(default_config), 200 # Return 200 OK with defaults
        
    print(f"API: Successfully retrieved {len(config_data)} variables for {est_name}.", flush=True)
    return jsonify(config_data)

# Serve booking_page.html at root and specific path
@app.route('/')
@app.route('/booking_page.html')
def serve_booking_page():
    # Ensure app.static_folder is correctly pointing to where booking_page.html is
    # If booking_page.html is in the same directory as app.py, app.static_folder ('.') is correct.
    return send_from_directory(app.static_folder, 'booking_page.html')

# Flask's static file handling will automatically serve:
# - form_logic.js (if requested as /form_logic.js)
# - style.css (if requested as /style.css)
# as long as they are in the directory specified by `static_folder` (which is '.' here).

if __name__ == '__main__':
    # Make sure to install Flask and requests: pip install Flask requests
    print("Starting Flask server on http://localhost:3010", flush=True)
    app.run(debug=True, port=3010)
