# Version: 20240507-100000
import re
import requests
import json # Though not directly used for output in this module, good to keep if any internal debugging needs it.

# Global list of variables to extract
VARIABLES_TO_EXTRACT = [
    "lng", "prefCountry", "areaMsg", "backColours", "test", "tmsVersion", "tmsRelease", 
    "redirect", "messages", "allShifts", "always", "loyaltyOptin", "allergy", "invoice", 
    "arSelect", "showEvents", "eventMessages", "eventsB", "dapi", "todayMonth", "today", 
    "now", "todayYear", "preTime", "narrowWin", "wideWin", "startSun", "thankURL", 
    "trailing", "days", "LinkPriv", "LinkTC", "estPhone", "partyMin", "partyMax", 
    "horizon", "timeStep", "estName", "standbyOnline", "maxRequest", "estFull", 
    "currSym", "country", "sisters", "areaAny", "options", "AvailPage", "ForLarger", 
    "preSelected", "selected", "br", "PERHEAD", "TOTAL", "addonError", "allergyYN", 
    "areaName", "availMonth", "cache", "calendar", "cardRequired", "charge", "count", 
    "created", "descMenu", "estCalendarAvail", "estNot", "eventName", "eventsActive", 
    "focusCount", "from", "to", "fullName", "invoiceRequired", "limited", "loading", 
    "loyal", "noStandby", "portal", "monthFirst", "monthName", "shoulder", 
    "sisterLoads", "sistersLoading", "sisterName", "sisterTimes", "telLink", 
    "timesAvail", "onTheHour", "usrLang", "vacateMsg", "viewPrivacy", "viewTerms"
]

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def fetch_html(url: str, headers: dict) -> str | None:
    """
    Fetches HTML content from the given URL.
    """
    try:
        response = requests.get(url, headers=headers, timeout=20) 
        response.raise_for_status() 
        # print(f"Successfully fetched HTML. Content length: {len(response.text)} bytes.", flush=True) # Optional: for server-side logging
        return response.text
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error occurred while fetching {url}: {e}", flush=True)
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error occurred while fetching {url}: {e}", flush=True)
    except requests.exceptions.Timeout as e:
        print(f"Timeout occurred while fetching {url}: {e}", flush=True)
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while fetching {url}: {e}", flush=True)
    return None

def extract_script_tag_content(html_content: str) -> str | None:
    """
    Extracts the content of the main inline JavaScript block from HTML.
    Tries a few patterns to find the relevant script block.
    """
    if not html_content:
        return None

    # Pattern 1: Look for a script tag containing 'var estName ='.
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+estName\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        # print("Found script block using 'var estName' pattern.", flush=True) # Optional: for server-side logging
        return match.group(1)

    # Pattern 2: Look for a script tag containing 'var dapi ='.
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+dapi\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        # print("Found script block using 'var dapi' pattern.", flush=True) # Optional: for server-side logging
        return match.group(1)
    
    # Pattern 3: Fallback to a general pattern for inline scripts (no 'src' attribute).
    match = re.search(r"<script(?![^>]*src=)[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        # print("Found script block using general inline script pattern (no src attribute).", flush=True) # Optional
        return match.group(1)
        
    # Pattern 4: Last resort, find any script tag.
    match = re.search(r"<script[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        # print("Found script block using the most general script pattern.", flush=True) # Optional
        return match.group(1)

    print("Could not find a suitable script tag content.", flush=True)
    return None

def _extract_single_variable(script_content: str, var_name: str) -> str | None:
    """
    Helper function to extract a single JavaScript variable's value using regex.
    """
    # (?:var|let|const)    - Matches 'var', 'let', or 'const'. Non-capturing group.
    # \s+                  - Matches one or more whitespace characters.
    # re.escape(var_name)  - Matches the literal variable name.
    # \s*=\s*              - Matches '=' surrounded by optional whitespace.
    # ([\s\S]+?)           - Capturing group 1: Matches any character (non-greedy). This is the value.
    # ;                    - Matches the terminating semicolon.
    regex_str = r"(?:var|let|const)\s+" + re.escape(var_name) + r"\s*=\s*([\s\S]+?);"
    match = re.search(regex_str, script_content)
    
    if match:
        value = match.group(1).strip()
        return value
    return None

def extract_all_variables(script_content: str) -> dict:
    """
    Takes script content and extracts variables from VARIABLES_TO_EXTRACT list.
    Returns a dictionary of found variables.
    """
    extracted_data = {}
    if not script_content:
        return extracted_data
        
    for var_name in VARIABLES_TO_EXTRACT:
        value = _extract_single_variable(script_content, var_name)
        if value is not None:
            extracted_data[var_name] = value
    return extracted_data

def get_config_for_establishment(est_name: str) -> dict | None:
    """
    Main function to fetch and extract configuration for a given establishment name.
    """
    if not est_name or not isinstance(est_name, str):
        print("Invalid est_name provided.", flush=True)
        return None 

    target_url = f"https://nz.eveve.com/web/form?est={est_name}"
    
    html_content = fetch_html(target_url, DEFAULT_HEADERS)
    if html_content is None:
        print(f"Failed to fetch HTML for {est_name}.", flush=True)
        return None 

    script_tag_content = extract_script_tag_content(html_content)
    if script_tag_content is None:
        print(f"Failed to extract script content for {est_name}.", flush=True)
        return None 

    variables_dict = extract_all_variables(script_tag_content)

    if variables_dict:  # Ensure variables_dict is not empty
        country_val = variables_dict.get("country")
        # Extracted values might have quotes, e.g., "'NZ'" or "\"NZ\""
        if country_val and isinstance(country_val, str):
            # Remove typical surrounding quotes and whitespace
            cleaned_country_val = country_val.strip().strip("'"'"")
            if cleaned_country_val == "NZ":
                # Force currSym to '$' for NZ establishments
                variables_dict["currSym"] = "$"  # Store as a clean '$'

    # print(f"Extracted {len(variables_dict)} variables for {est_name}.", flush=True) # Optional logging
    
    return variables_dict

# Example usage (for testing this module directly, not for Flask app)
if __name__ == '__main__':
    print("Testing extract_js_vars_logic.py...")
    test_est_name = "TestNZWorkforce1" 
    # test_est_name = "NONEXISTENTEST" # For testing failure
    
    config_data = get_config_for_establishment(test_est_name)
    
    if config_data is not None:
        print(f"\n--- Successfully retrieved config for {test_est_name} ---")
        # Print a summary or part of the data
        print(f"Found {len(config_data)} variables.")
        if "estName" in config_data:
            print(f"Restaurant Name: {config_data['estName']}")
        if "lng" in config_data:
            print(f"Language data (lng) found (first 50 chars): {config_data['lng'][:50]}...")
        # For full output:
        # print("\nFull extracted data:")
        # print(json.dumps(config_data, indent=2))
    else:
        print(f"\n--- Failed to retrieve config for {test_est_name} ---")

    print("\nTesting with an invalid est_name (None)...")
    invalid_config = get_config_for_establishment(None)
    if invalid_config is None:
        print("Correctly handled None est_name: returned None.")
    else:
        print(f"Incorrectly handled None est_name: returned {invalid_config}")

    print("\nTesting with an invalid est_name (empty string)...")
    empty_config = get_config_for_establishment("")
    if empty_config is None: 
        print("Correctly handled empty string est_name: returned None.")
    else:
        print(f"Incorrectly handled empty string est_name: returned {empty_config}")

    print("\nTest completed.")
