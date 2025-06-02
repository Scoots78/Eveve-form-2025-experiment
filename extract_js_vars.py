import re
import requests # Added for fetching HTML
import json     # Added for JSON output

# Define Target URL
target_url = "https://nz.eveve.com/web/form?est=TestNZWorkforce1"

def fetch_html(url):
    """
    Fetches HTML content from the given URL.
    Includes a User-Agent header and handles potential errors.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        # Diagnostic print, kept for operational transparency
        print(f"Successfully fetched HTML. Content length: {len(response.text)} bytes.", flush=True)
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

def extract_script_content(html_content):
    """
    Extracts the content of an inline JavaScript block presumed to contain variable definitions.
    It tries a few patterns to find the relevant script block.
    """
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+estName\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        # Diagnostic print
        print("Found script block using 'var estName' pattern.", flush=True)
        return match.group(1)

    match = re.search(r"<script[^>]*>([\s\S]*?var\s+dapi\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        # Diagnostic print
        print("Found script block using 'var dapi' pattern.", flush=True)
        return match.group(1)

    match = re.search(r"<script(?![^>]*src=)[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        # Diagnostic print
        print("Found script block using general inline script pattern (no src attribute).", flush=True)
        return match.group(1)

    match = re.search(r"<script[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        # Diagnostic print
        print("Found script block using the most general script pattern.", flush=True)
        return match.group(1)

    print("Could not find a suitable script block.", flush=True)
    return None

def extract_variable_value(script_content, var_name):
    """
    Extracts the value of a given JavaScript variable using regex.
    The value is returned as a string, capturing multi-line objects/arrays.
    It looks for var, let, or const declarations.
    """
    regex_str = r"(?:var|let|const)\s+" + re.escape(var_name) + r"\s*=\s*([\s\S]+?);"
    match = re.search(regex_str, script_content)

    if match:
        value = match.group(1).strip()
        return value

    return None

def main():
    # Diagnostic print
    print(f"Fetching HTML content from: {target_url}\n", flush=True)
    html_content = fetch_html(target_url)

    if not html_content:
        # Error message already printed by fetch_html
        print("Failed to fetch HTML content. Exiting.", flush=True)
        # Output an empty JSON object in case of fetch failure before extraction attempt
        print(json.dumps({}, indent=4))
        return

    script_content = extract_script_content(html_content)
    if not script_content:
        # Error message already printed by extract_script_content
        print("Error: Could not find or extract a suitable inline script block.", flush=True)
        if html_content:
            # Diagnostic print
            print("\n--- Start of fetched HTML (first 500 chars) for debugging ---", flush=True)
            print(html_content[:500], flush=True)
            print("--- End of fetched HTML snippet ---", flush=True)
        # Output an empty JSON object if script block isn't found
        print(json.dumps({}, indent=4))
        return

    # Diagnostic print for script content snippet
    # print("\n--- Start of Extracted Script Content (first 300 chars) ---", flush=True)
    # print(script_content[:300], flush=True) # Reduced snippet size
    # print("--- End of Extracted Script Content snippet ---\n", flush=True)

    variables_to_extract = [
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

    extracted_data = {} # Initialize dictionary to store found variables

    # Removed the "Extracted JavaScript Variables:" print for cleaner JSON output
    # print("Extracted JavaScript Variables:\n", flush=True)

    for var_name in variables_to_extract:
        value = extract_variable_value(script_content, var_name)
        if value is not None:
            extracted_data[var_name] = value
            # Removed line-by-line printing: print(f"{var_name}: {value}", flush=True)
        # "Not Found" variables are deliberately not added to extracted_data

    # Removed the old summary block:
    # print(f"\n--- Summary ---")
    # print(f"Found {found_count} out of {len(variables_to_extract)} variables.")
    # if not_found_vars:
    #     print(f"Variables not found ({len(not_found_vars)}): {', '.join(sorted(not_found_vars))}")
    # else:
    #     print("All specified variables were found.")

    # Output the collected data as a single JSON object
    # This should be the primary output of the script if successful.
    print(json.dumps(extracted_data, indent=4))

if __name__ == "__main__":
    main()
    # Diagnostic print, kept for operational transparency
    # print("\nScript execution finished.", flush=True)
    # print("Note: The 'requests' library needs to be installed in the environment (e.g., pip install requests).", flush=True)
