import re
import requests # Added for fetching HTML

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
        print(f"Successfully fetched HTML. Content length: {len(response.text)} bytes.")
        return response.text
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error occurred while fetching {url}: {e}")
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error occurred while fetching {url}: {e}")
    except requests.exceptions.Timeout as e:
        print(f"Timeout occurred while fetching {url}: {e}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while fetching {url}: {e}")
    return None

def extract_script_content(html_content):
    """
    Extracts the content of an inline JavaScript block presumed to contain variable definitions.
    It tries a few patterns to find the relevant script block.
    """
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+estName\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using 'var estName' pattern.")
        return match.group(1)

    match = re.search(r"<script[^>]*>([\s\S]*?var\s+dapi\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using 'var dapi' pattern.")
        return match.group(1)

    match = re.search(r"<script(?![^>]*src=)[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using general inline script pattern (no src attribute).")
        return match.group(1)
        
    match = re.search(r"<script[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using the most general script pattern.")
        return match.group(1)

    print("Could not find a suitable script block.")
    return None

def extract_variable_value(script_content, var_name):
    """
    Extracts the value of a given JavaScript variable using regex.
    The value is returned as a string, capturing multi-line objects/arrays.
    It looks for var, let, or const declarations.
    """
    # Regex explanation:
    # (?:var|let|const)    - Matches 'var', 'let', or 'const'. Non-capturing group.
    # \s+                  - Matches one or more whitespace characters.
    # re.escape(var_name)  - Matches the literal variable name, escaping any special regex chars.
    # \s*=\s*              - Matches '=' surrounded by optional whitespace.
    # ([\s\S]+?)           - Capturing group 1: Matches any character (including newlines)
    #                        non-greedily. This is the variable's value.
    # ;                    - Matches the terminating semicolon of the JavaScript statement.
    #
    # This regex is designed to capture everything from the '=' up to the
    # first semicolon that terminates that specific variable declaration.
    regex_str = r"(?:var|let|const)\s+" + re.escape(var_name) + r"\s*=\s*([\s\S]+?);"
    
    match = re.search(regex_str, script_content) # Removed re.DOTALL as [\s\S] handles newlines
    
    if match:
        value = match.group(1).strip()
        return value
    
    return None

def main():
    print(f"Fetching HTML content from: {target_url}\n")
    html_content = fetch_html(target_url)

    if not html_content:
        print("Failed to fetch HTML content. Exiting.")
        return

    script_content = extract_script_content(html_content)
    if not script_content:
        print("Error: Could not find or extract a suitable inline script block from the fetched HTML.")
        if html_content: # Print snippet if HTML was fetched but script block wasn't found
            print("\n--- Start of fetched HTML (first 500 chars) for debugging ---")
            print(html_content[:500])
            print("--- End of fetched HTML snippet ---")
        return

    print("\n--- Start of Extracted Script Content (first 300 chars) ---")
    print(script_content[:300]) # Reduced snippet size
    print("--- End of Extracted Script Content snippet ---\n")
    
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

    print("Extracted JavaScript Variables:\n")
    found_count = 0
    not_found_vars = []
    for var_name in variables_to_extract:
        value = extract_variable_value(script_content, var_name)
        if value is not None:
            print(f"{var_name}: {value}")
            found_count += 1
        else:
            # Only print "Not Found" for a few to keep output cleaner during runs,
            # the final list of not_found_vars is more important.
            if len(not_found_vars) < 5: 
                print(f"{var_name}: Not Found")
            not_found_vars.append(var_name)
    
    print(f"\n--- Summary ---")
    print(f"Found {found_count} out of {len(variables_to_extract)} variables.")
    if not_found_vars:
        print(f"Variables not found ({len(not_found_vars)}): {', '.join(sorted(not_found_vars))}")
    else:
        print("All specified variables were found.")


if __name__ == "__main__":
    main()
    print("\nScript execution finished.")
    print("Note: The 'requests' library needs to be installed in the environment (e.g., pip install requests).")
