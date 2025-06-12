// --- DOM Utilities ---

import { getConfig } from './config_manager.js'; // Needed for currency symbol in formatSelectedAddons

/**
 * Gets the value of the currently selected radio button in a group.
 * @param {string} groupName - The name attribute of the radio button group.
 * @returns {string|null} The value of the selected radio button, or null if none is selected.
 */
export function getSelectedRadioValue(groupName) {
    const checkedRadio = document.querySelector(`input[name="${groupName}"]:checked`);
    return checkedRadio ? checkedRadio.value : null;
}

/**
 * Formats a decimal time value into a human-readable string (e.g., "2:30 PM").
 * @param {number|null|undefined} decimalTime - The time as a decimal number (e.g., 14.5 for 2:30 PM).
 * @returns {string} The formatted time string, or 'N/A' if the input is invalid.
 */
export function formatTime(decimalTime) {
    if (decimalTime === null || typeof decimalTime === 'undefined' || isNaN(parseFloat(decimalTime))) {
        return 'N/A';
    }
    let hours = Math.floor(decimalTime);
    let fraction = decimalTime - hours;
    let minutes = Math.round(fraction * 60);
    if (minutes === 60) {
        hours++;
        minutes = 0;
    }
    let ampm = 'AM';
    let displayHours = hours;
    if (displayHours >= 24) { displayHours -= 24; } // Handle times past midnight e.g. 24.5 -> 00:30
    if (displayHours >= 12) { ampm = 'PM'; }
    if (displayHours === 0) {
        displayHours = 12; // Midnight case
    } else if (displayHours > 12) {
        displayHours -= 12;
    }
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
    return `${displayHours}:${minutesStr} ${ampm}`;
}

/**
 * Formats the selected addons into a comma-separated string for API calls or display.
 * Also calculates and includes the total price of addons for display purposes.
 * @param {object} selectedAddons - An object containing the selected addons, structured by usage type.
 * @param {object|null} selectedAddons.usage1 - Selected addon for usage type 1.
 * @param {Array<object>} selectedAddons.usage2 - Array of selected addons for usage type 2.
 * @param {Array<object>} selectedAddons.usage3 - Array of selected addons for usage type 3.
 * @param {number} guestCount - The current number of guests, used for "Per Guest" addon calculations.
 * @returns {{ stringForApi: string, displayString: string }} An object containing the string for the API and a string for display.
 */
export function formatSelectedAddonsForDisplay(selectedAddons, guestCount) {
    let addonApiParts = [];
    let displayItems = [];
    let grandTotal = 0;

    const localConfig = getConfig();
    const currencySymbol = localConfig.currSym ? localConfig.currSym.replace(/&[^;]+;/g, '') : '$';

    // Process usage1 addons
    if (selectedAddons.usage1 && selectedAddons.usage1.uid) {
        addonApiParts.push(`${selectedAddons.usage1.uid}:1`);
        const addon = selectedAddons.usage1;
        const basePrice = (addon.price || 0) / 100; // price is in cents
        const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
        grandTotal += itemCost;
        displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
    }

    // Process usage2 addons
    if (selectedAddons.usage2 && selectedAddons.usage2.length > 0) {
        selectedAddons.usage2.forEach(addon => {
            if (addon.uid && addon.quantity > 0) { // Ensure quantity is positive
                addonApiParts.push(`${addon.uid}:${addon.quantity}`);
                const basePrice = (addon.price || 0) / 100; // price is in cents
                let itemCost = 0;
                let itemDisplayString = "";

                if (addon.per === "Party") {
                    itemCost = basePrice;  // Cost is flat basePrice for "Per Party"
                    itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${basePrice.toFixed(2)} - Per Party)`;
                } else { // Default to "Per Guest" or other types if not "Party"
                    itemCost = basePrice * addon.quantity;
                    itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${itemCost.toFixed(2)})`;
                }
                grandTotal += itemCost;
                displayItems.push(itemDisplayString);
            }
        });
    }

    // Process usage3 addons
    if (selectedAddons.usage3 && selectedAddons.usage3.length > 0) {
        selectedAddons.usage3.forEach(addon => {
            if (addon.uid) {
                addonApiParts.push(`${addon.uid}:1`); // Assuming quantity is always 1 for usage3 checkboxes
                const basePrice = (addon.price || 0) / 100; // price is in cents
                const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
                grandTotal += itemCost;
                displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
            }
        });
    }

    let finalDisplayString = '-';
    if (displayItems.length > 0) {
        let VFMDisplay = displayItems.join(', ');
        VFMDisplay += ` --- Total Addons: ${currencySymbol}${grandTotal.toFixed(2)}`;
        finalDisplayString = VFMDisplay;
    }

    return {
        stringForApi: addonApiParts.join(','),
        displayString: finalDisplayString
    };
}

/**
 * Formats selected addons into a string suitable for API submission.
 * This is a simpler version of formatSelectedAddonsForDisplay, only returning the API string.
 * @param {object} selectedAddons - An object containing the selected addons.
 * @returns {string} A comma-separated string of selected addons for the API.
 */
export function formatSelectedAddonsForApi(selectedAddons) {
    let addonParts = [];
    if (selectedAddons.usage1 && selectedAddons.usage1.uid) {
        addonParts.push(`${selectedAddons.usage1.uid}:1`);
    }
    if (selectedAddons.usage2 && selectedAddons.usage2.length > 0) {
        selectedAddons.usage2.forEach(addon => {
            if (addon.uid && addon.quantity > 0) { // Ensure quantity is positive
                addonParts.push(`${addon.uid}:${addon.quantity}`);
            }
        });
    }
    if (selectedAddons.usage3 && selectedAddons.usage3.length > 0) {
        selectedAddons.usage3.forEach(addon => {
            if (addon.uid) { // Assuming quantity is always 1 for usage3 checkboxes
                addonParts.push(`${addon.uid}:1`);
            }
        });
    }
    return addonParts.join(',');
}
