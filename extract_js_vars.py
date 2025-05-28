import re

def extract_script_content(html_content):
    """
    Extracts the content of the main inline JavaScript block from HTML.
    """
    script_match = re.search(r"<script.*?>\s*(// Static Variables.*?)<\/script>", html_content, re.DOTALL)
    if script_match:
        return script_match.group(1)
    else:
        # Fallback if the specific comment isn't there but a script tag is
        script_match = re.search(r"<script.*?>(.*?)<\/script>", html_content, re.DOTALL)
        if script_match:
            return script_match.group(1)
    return None

def extract_variable_value(script_content, var_name):
    """
    Extracts the value of a given JavaScript variable using regex.
    Handles strings (single or double quotes), numbers, arrays, and objects.
    The value is returned as a string.
    """
    # Regex to find "var varName = value;" or "let varName = value;" or "const varName = value;"
    # It captures the value part.
    # This regex attempts to capture:
    # 1. Quoted strings (single or double)
    # 2. Arrays (starting with [ and ending with ])
    # 3. Objects (starting with { and ending with })
    # 4. Numbers
    # 5. Boolean literals (true/false)
    # It tries to match until a semicolon, or a comma followed by a newline (for object/array elements)
    # or end of line if it's the last declaration.
    
    # More robust regex to capture various types of values until a semicolon
    # It looks for 'var varName = ' and then captures everything until the semicolon.
    # It needs to correctly handle cases where a semicolon might be inside a string.
    # To simplify, we'll assume semicolons are not embedded in the string values themselves.
    
    # Improved regex:
    # var\s+varName\s*=\s*(.*?);
    # (.*?); will capture everything up to the first semicolon. This is usually correct for simple assignments.
    # For arrays/objects, the ; is typically at the end of the entire literal.
    regex = r"(?:var|let|const)\s+" + re.escape(var_name) + r"\s*=\s*(.*?);"
    match = re.search(regex, script_content, re.DOTALL)
    
    if match:
        value = match.group(1).strip()
        # If the value is explicitly 'undefined' or 'null', capture that.
        # Otherwise, the value is what was captured.
        return value
    return None

def main():
    html_file_path = "form_content.html"
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"Error: The file {html_file_path} was not found.")
        return
    except Exception as e:
        print(f"Error reading file {html_file_path}: {e}")
        return

    script_content = extract_script_content(html_content)
    if not script_content:
        print("Error: Could not find or extract the main inline script block.")
        return

    variables_to_extract = [
        "estName", "dapi", "currSym", "country", "partyMin", "partyMax",
        "horizon", "timeStep", "todayYear", "todayMonth", "today",
        "preTime", "allShifts", "eventsB", "prefCountry"
    ]

    print("Extracted JavaScript Variables:\n")
    for var_name in variables_to_extract:
        value = extract_variable_value(script_content, var_name)
        if value is not None:
            print(f"{var_name}: {value}")
        else:
            print(f"{var_name}: Not Found")

if __name__ == "__main__":
    main()
