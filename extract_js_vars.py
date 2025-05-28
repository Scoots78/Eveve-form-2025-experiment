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
        # Increased timeout to 20 seconds
        response = requests.get(url, headers=headers, timeout=20) 
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        print(f"Successfully fetched HTML. Content length: {len(response.text)} bytes.") # Diagnostic print
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
    # Pattern 1: Look for a script tag containing 'var estName ='.
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+estName\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using 'var estName' pattern.")
        return match.group(1)

    # Pattern 2: Look for a script tag containing 'var dapi ='.
    match = re.search(r"<script[^>]*>([\s\S]*?var\s+dapi\s*=\s*[\s\S]*?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using 'var dapi' pattern.")
        return match.group(1)

    # Pattern 3: Fallback to a general pattern for inline scripts (no 'src' attribute).
    match = re.search(r"<script(?![^>]*src=)[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using general inline script pattern (no src attribute).")
        return match.group(1)
        
    # Pattern 4: Last resort, find any script tag.
    match = re.search(r"<script[^>]*>([\s\S]+?)<\/script>", html_content, re.DOTALL)
    if match:
        print("Found script block using the most general script pattern.")
        return match.group(1)

    print("Could not find a suitable script block.")
    return None

def extract_variable_value(script_content, var_name):
    """
    Extracts the value of a given JavaScript variable using regex.
    The value is returned as a string.
    """
    # This regex attempts to capture various JS value types:
    # - Quoted strings (double or single, handling escaped quotes)
    # - Arrays ([...])
    # - Objects ({...})
    # - Boolean literals (true/false)
    # - null / undefined
    # - Numbers (including decimals and negative numbers)
    # It captures everything up to the semicolon.
    regex_str = r"(?:var|let|const)\s+" + re.escape(var_name) + r"\s*=\s*((?:\"(?:\\\"|[^\"])*\"|\'(?:\\\'|[^\'])*\'|\[[\s\S]*?\]|\{[\s\S]*?\}|true|false|null|undefined|-?\d+(?:\.\d+)?).*?);"
    
    match = re.search(regex_str, script_content, re.DOTALL)
    
    if match:
        value = match.group(1).strip()
        return value
    
    # Fallback for variables that might be declared with `const country = 'NZ'` (from output)
    # where the previous regex might fail if it doesn't match the exact structure.
    # This is a more specific fallback for a `const variableName = 'string'` type pattern.
    if var_name == "country": # Specific example from output
        match_const = re.search(r"const\s+" + re.escape(var_name) + r"\s*=\s*\'(.*?)\';", script_content)
        if match_const:
            return f"'{match_const.group(1).strip()}'" # Re-add quotes for consistency if needed

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
        print("\n--- Start of fetched HTML (first 500 chars) for debugging ---")
        print(html_content[:500])
        print("--- End of fetched HTML snippet ---")
        return

    print("\n--- Start of Extracted Script Content (first 500 chars) ---")
    print(script_content[:500])
    print("--- End of Extracted Script Content snippet ---\n")
    
    variables_to_extract = [
        "estName", "dapi", "currSym", "country", "partyMin", "partyMax",
        "horizon", "timeStep", "todayYear", "todayMonth", "today",
        "preTime", "allShifts", "eventsB", "prefCountry"
    ]

    print("Extracted JavaScript Variables:\n")
    all_found = True
    not_found_vars = []
    for var_name in variables_to_extract:
        value = extract_variable_value(script_content, var_name)
        if value is not None:
            # Special handling for 'country' if it was captured by the specific const regex
            # and to ensure its output format consistency.
            # The output from previous run for country was: `const  country = 'NZ'`
            # then `country: 'NZ'`. This seems to be an artifact of how it was printed or extracted.
            # The goal is variable_name: value
            if var_name == "country" and value.startswith("const"): # cleanup if needed
                country_val_match = re.search(r"const\s+country\s*=\s*(.*?);", value, re.IGNORECASE)
                if country_val_match:
                    value = country_val_match.group(1).strip()
            
            print(f"{var_name}: {value}")
        else:
            print(f"{var_name}: Not Found")
            all_found = False
            not_found_vars.append(var_name)
    
    if not all_found:
        print(f"\nNote: Some variables were not found: {', '.join(not_found_vars)}. This might be expected if the target page's structure differs or variables are not present.")

if __name__ == "__main__":
    main()
    print("\nScript execution finished.")
    print("Note: The 'requests' library needs to be installed in the environment (e.g., pip install requests).")
