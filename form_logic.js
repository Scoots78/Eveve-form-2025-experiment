// Version: 20240507-140000
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global variables for the module scope ---
    let config = {};
    let languageStrings = {};
    let initialShiftsConfig = []; 
    let currentEstName = '';
    let currentShiftUsagePolicy = null; // Added for Next button logic
    let currentSelectedAddons = {
        usage1: null,
        usage2: [],
        usage3: []
    };

    // --- Toggle for unavailable slots ---
    const showUnavailableSlots = true; 

    // --- DOM Elements ---
    const restaurantNameSpan = document.getElementById('restaurantName');
    const dateSelector = document.getElementById('dateSelector'); 
    const coversSelector = document.getElementById('coversSelector');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    const selectedTimeValueSpan = document.getElementById('selectedTimeValue');
    const selectedDateValueSpan = document.getElementById('selectedDateValue');
    const selectedCoversValueSpan = document.getElementById('selectedCoversValue');
    const dailyRotaMessageDiv = document.getElementById('dailyRotaMessage');

    // --- Helper Functions ---
    function getQueryParam(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatTime(decimalTime) {
        // console.log('formatTime received:', decimalTime, 'type:', typeof decimalTime); // Removed
        if (decimalTime === null || typeof decimalTime === 'undefined' || isNaN(parseFloat(decimalTime))) {
            return 'N/A';
        }
        let hours = Math.floor(decimalTime);
        let fraction = decimalTime - hours;
        let minutes = Math.round(fraction * 60);
        if (minutes === 60) { hours++; minutes = 0; }
        let ampm = 'AM';
        let displayHours = hours;
        if (displayHours >= 24) { displayHours -= 24; }
        if (displayHours >= 12) { ampm = 'PM'; }
        if (displayHours === 0) { displayHours = 12; } 
        else if (displayHours > 12) { displayHours -= 12; }
        const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
        return `${displayHours}:${minutesStr} ${ampm}`;
    }

    function parseJsObjectString(jsString) {
        if (!jsString || typeof jsString !== 'string') {
            // console.warn('Invalid input for parseJsObjectString:', jsString); // Kept as it's a warning for invalid input
            return null;
        }
        try {
            return new Function('return ' + jsString)();
        } catch (e) {
            console.error('Error parsing JavaScript object string:', e, 'String was:', jsString); // Kept as it's an error
            return null;
        }
    }

    // --- API Call Functions ---
    async function loadConfigFromServer() {
        currentEstName = getQueryParam('est'); 
        if (!currentEstName) {
            console.error('Restaurant ID (est) missing from URL.'); // Kept as it's an error
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">Error: Restaurant ID (est) missing from URL.</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Configuration Error';
            throw new Error('Restaurant ID (est) missing from URL.');
        }
        const localApiUrl = `/api/get-config?est=${currentEstName}`;
        // console.log(`Fetching configuration from: ${localApiUrl}`); // Removed general operational log
        try {
            const response = await fetch(localApiUrl);
            if (!response.ok) {
                let errorDetails = await response.text();
                try { errorDetails = JSON.parse(errorDetails); } catch (e) { /* Keep as text */ }
                console.error('Failed to load config from server:', response.status, errorDetails); // Kept as it's an error
                throw new Error(`Failed to load config: ${response.statusText}. Details: ${JSON.stringify(errorDetails)}`);
            }
            const fetchedConfig = await response.json();
            // console.log('Configuration loaded successfully:', fetchedConfig); // Removed general operational log
            return fetchedConfig;
        } catch (error) {
            console.error('Error in loadConfigFromServer:', error); // Kept as it's an error
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">Failed to load restaurant configuration. Please try again later.</p>`;
            if (restaurantNameSpan) restaurantNameSpan.textContent = 'Load Error';
            throw error; 
        }
    }

    async function fetchAvailableTimes(estNameForApi, date, covers) { 
        const apiUrl = `https://nz.eveve.com/web/day-avail?est=${estNameForApi}&covers=${covers}&date=${date}`;
        // console.log(`Fetching available times from: ${apiUrl}`); // Removed general operational log
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorData;
                try { errorData = await response.json(); } catch (e) { errorData = await response.text(); }
                console.error('Day Avail API Error Response Data:', errorData); // Kept as it's an error
                throw new Error(`HTTP error! status: ${response.status}. Body: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            // console.log('Available times data received:', data); // Removed general operational log
            return data;
        } catch (error) {
            console.error('Error fetching available times:', error); // Kept as it's an error
            return null;
        }
    }

    // --- Addon Display and Selection Logic ---
    function updateSelectedAddonsDisplay() {
        const selectedAddonsValueSpan = document.getElementById('selectedAddonsValue');
        if (!selectedAddonsValueSpan) return;

        const coversSelectorEl = document.getElementById('coversSelector');
        const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) || 0 : 0;
        const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';

        let displayItems = [];
        let grandTotal = 0;

        // Process usage1 addons
        if (currentSelectedAddons.usage1) {
            const addon = currentSelectedAddons.usage1;
            const basePrice = (addon.price || 0) / 100; // price is in cents
            const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
            grandTotal += itemCost;
            displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
        }

        // Process usage2 addons
        currentSelectedAddons.usage2.forEach(addon => {
            const basePrice = (addon.price || 0) / 100; // price is in cents
            let itemCost = 0;
            let itemDisplayString = "";

            if (addon.per === "Party") {
                itemCost = basePrice;  // Cost is flat basePrice for "Per Party"
                // Display quantity for informational purposes, but use basePrice for itemCost
                itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${basePrice.toFixed(2)} - Per Party)`;
            } else { // Default to "Per Guest" or other types if not "Party"
                itemCost = basePrice * addon.quantity;
                itemDisplayString = `${addon.name} x${addon.quantity} (${currencySymbol}${itemCost.toFixed(2)})`;
            }
            grandTotal += itemCost;
            displayItems.push(itemDisplayString);
        });

        // Process usage3 addons
        currentSelectedAddons.usage3.forEach(addon => {
            const basePrice = (addon.price || 0) / 100; // price is in cents
            const itemCost = (addon.per === "Guest" && guestCount > 0) ? basePrice * guestCount : basePrice;
            grandTotal += itemCost;
            displayItems.push(`${addon.name} (${currencySymbol}${itemCost.toFixed(2)})`);
        });

        if (displayItems.length > 0) {
            let displayText = displayItems.join(', ');
            displayText += ` --- Total Addons: ${currencySymbol}${grandTotal.toFixed(2)}`;
            selectedAddonsValueSpan.textContent = displayText;
        } else {
            selectedAddonsValueSpan.textContent = '-';
        }
        // console.log('Updated currentSelectedAddons for display:', JSON.stringify(currentSelectedAddons, null, 2)); // Optional: for debugging
    }

    function handleAddonUsage1Selection(event, addonData, isSingleCheckboxMode) {
        const checkboxOrRadio = event.target;
        // console.log('handleAddonUsage1Selection called:', addonData, 'Checked/Mode:', checkboxOrRadio.checked, isSingleCheckboxMode); // Removed
        if (isSingleCheckboxMode) {
            if (checkboxOrRadio.checked) {
                // Store more fields from addonData
                currentSelectedAddons.usage1 = {
                    uid: addonData.uid,
                    name: addonData.name,
                    price: parseFloat(addonData.price), // Ensure price is numeric
                    per: addonData.per,
                    type: addonData.type,
                    desc: addonData.desc
                };
            } else {
                currentSelectedAddons.usage1 = null;
            }
        } else { 
            // Store more fields from addonData
            currentSelectedAddons.usage1 = {
                uid: addonData.uid,
                name: addonData.name,
                price: parseFloat(addonData.price), // Ensure price is numeric
                per: addonData.per,
                type: addonData.type,
                desc: addonData.desc
            };
        }
        updateSelectedAddonsDisplay();
        updateNextButtonState(); // Added call
    }

    function handleAddonUsage2Selection(addonData, quantity) {
        const addonUid = addonData.uid;
        // console.log('handleAddonUsage2Selection called:', addonData, 'Quantity:', quantity); // Removed
        currentSelectedAddons.usage2 = currentSelectedAddons.usage2.filter(a => a.uid !== addonUid);
        if (quantity > 0) {
            // Store more fields from addonData
            currentSelectedAddons.usage2.push({
                uid: addonData.uid,
                name: addonData.name,
                price: parseFloat(addonData.price), // Ensure price is numeric
                per: addonData.per,
                type: addonData.type,
                desc: addonData.desc,
                quantity: quantity
            });
        }
        updateSelectedAddonsDisplay();
        updateNextButtonState(); // Added call
    }

    function handleAddonUsage3Selection(event) {
        const checkbox = event.target;
        const addonUid = parseInt(checkbox.dataset.addonUid, 10);
        const addonName = checkbox.dataset.addonName;
        const addonPrice = parseFloat(checkbox.dataset.addonPrice); // Already ensuring price is numeric
        const addonPer = checkbox.dataset.addonPer;
        const addonType = checkbox.dataset.addonType;
        const addonDesc = checkbox.dataset.addonDesc;
        // console.log('handleAddonUsage3Selection called:', addonUid, 'Checked:', checkbox.checked); // Removed
        if (checkbox.checked) {
            if (!currentSelectedAddons.usage3.some(a => a.uid === addonUid)) {
                // Store more fields from dataset
                currentSelectedAddons.usage3.push({
                    uid: addonUid,
                    name: addonName,
                    price: addonPrice,
                    per: addonPer,
                    type: addonType,
                    desc: addonDesc
                });
            }
        } else {
            currentSelectedAddons.usage3 = currentSelectedAddons.usage3.filter(addon => addon.uid !== addonUid);
        }
        updateSelectedAddonsDisplay();
        updateNextButtonState(); // Added call
    }

    // --- Addon Rendering Functions ---

    function updateNextButtonState() {
        const nextButton = document.getElementById('nextButton');
        if (!nextButton) return;

        nextButton.disabled = true; // Default to disabled

        const selectedTimeValueEl = document.getElementById('selectedTimeValue');
        const selectedTimeText = selectedTimeValueEl ? selectedTimeValueEl.textContent : '-';

        if (!selectedTimeText || selectedTimeText === '-' || selectedTimeText.includes('N/A')) {
            return;
        }

        const coversSelectorEl = document.getElementById('coversSelector');
        const guestCount = coversSelectorEl ? parseInt(coversSelectorEl.value) : 0;

        if (currentShiftUsagePolicy === null || typeof currentShiftUsagePolicy === 'undefined') {
            // If time is selected and no specific addon policy is active, enable Next.
            nextButton.disabled = false;
            return;
        }

        switch (parseInt(currentShiftUsagePolicy)) {
            case 0: // No Menu Selection
                nextButton.disabled = false;
                break;
            case 1: // All Guests Same Menu (usage1 addons)
                if (currentSelectedAddons.usage1 && currentSelectedAddons.usage1.uid) {
                    nextButton.disabled = false;
                } else {
                    nextButton.disabled = true;
                }
                break;
            case 2: // Each Guest Any Menu (usage2 addons)
                if (guestCount > 0 && getTotalUsage2AddonQuantity() === guestCount) {
                    nextButton.disabled = false;
                } else {
                    nextButton.disabled = true;
                }
                break;
            case 3: // Optional Menus (usage3 addons)
                nextButton.disabled = false;
                break;
            default: // Unknown policy or no addon gating
                nextButton.disabled = false;
                break;
        }
    }

    function getTotalUsage2AddonQuantity() {
        let total = 0;
        if (currentSelectedAddons && currentSelectedAddons.usage2) {
            currentSelectedAddons.usage2.forEach(addon => {
                total += addon.quantity;
            });
        }
        return total;
    }

    function updateAllUsage2ButtonStates(currentGuestCount) {
        const totalCurrentUsage2Quantity = getTotalUsage2AddonQuantity();

        document.querySelectorAll('.usage2-item .addon-quantity-selector').forEach(qtySelector => {
            const qtyInput = qtySelector.querySelector('.qty-input');
            const minusButton = qtySelector.querySelector('.minus-btn');
            const plusButton = qtySelector.querySelector('.plus-btn');

            if (!qtyInput || !minusButton || !plusButton) return; // Safety check

            const itemSpecificCurrentValue = parseInt(qtyInput.value);

            minusButton.disabled = (itemSpecificCurrentValue === 0);

            if (currentGuestCount === 0) {
                plusButton.disabled = true;
            } else {
                plusButton.disabled = (totalCurrentUsage2Quantity >= currentGuestCount);
            }
        });
    }

    function renderUsage1Addons(filteredAddons, guestCount, shiftName) {
        // console.log(`renderUsage1Addons for "${shiftName}" ...`); // Removed
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        if (!filteredAddons || filteredAddons.length === 0) return;
        if (filteredAddons.length === 1) {
            const addon = filteredAddons[0]; // Rest of the logic is fine
            const addonItemDiv = document.createElement('div');
            addonItemDiv.className = 'addon-item usage1-single';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'addon-checkbox usage1-checkbox';
            checkbox.value = addon.uid;
            checkbox.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
            checkbox.dataset.addonUid = addon.uid; checkbox.dataset.addonName = addon.name;
            checkbox.dataset.addonPrice = addon.price; checkbox.dataset.addonDesc = addon.desc;
            checkbox.dataset.addonPer = addon.per; checkbox.dataset.addonType = addon.type;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            let labelHTML = `<span class="addon-name">${addon.name}</span>`;
            if (typeof addon.price !== 'undefined' && addon.price !== null) {
                const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';
                const priceDisplay = (addon.price / 100).toFixed(2);
                labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
            }
            if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
            label.innerHTML = labelHTML;
            addonItemDiv.appendChild(checkbox);
            addonItemDiv.appendChild(label);
            addonsDisplayArea.appendChild(addonItemDiv);
            checkbox.addEventListener('change', event => handleAddonUsage1Selection(event, addon, true));
        } else { 
            const radioGroupContainer = document.createElement('div');
            radioGroupContainer.className = 'addon-radio-group';
            const radioGroupName = `shift_${shiftName.replace(/\s+/g, '_')}_usage1_addons`;
            filteredAddons.forEach(addon => { // Rest of the logic is fine
                const addonItemDiv = document.createElement('div');
                addonItemDiv.className = 'addon-item usage1-radio';
                const radioButton = document.createElement('input');
                radioButton.type = 'radio';
                radioButton.className = 'addon-radio usage1-radio-btn';
                radioButton.name = radioGroupName;
                radioButton.value = addon.uid;
                radioButton.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
                radioButton.dataset.addonUid = addon.uid; radioButton.dataset.addonName = addon.name;
                radioButton.dataset.addonPrice = addon.price; radioButton.dataset.addonDesc = addon.desc;
                radioButton.dataset.addonPer = addon.per; radioButton.dataset.addonType = addon.type;
                const label = document.createElement('label');
                label.htmlFor = radioButton.id;
                let labelHTML = `<span class="addon-name">${addon.name}</span>`;
                if (typeof addon.price !== 'undefined' && addon.price !== null) {
                    const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';
                    const priceDisplay = (addon.price / 100).toFixed(2);
                    labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
                }
                if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
                label.innerHTML = labelHTML;
                addonItemDiv.appendChild(radioButton);
                addonItemDiv.appendChild(label);
                radioGroupContainer.appendChild(addonItemDiv);
                radioButton.addEventListener('change', event => handleAddonUsage1Selection(event, addon, false));
            });
            addonsDisplayArea.appendChild(radioGroupContainer);
        }
    }

    function renderUsage2Addons(filteredAddons, guestCount, shiftName) {
        // console.log(`renderUsage2Addons for "${shiftName}" ...`); // Removed
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        if (!filteredAddons || filteredAddons.length === 0) return;
        filteredAddons.forEach(addon => { // Rest of the logic is fine
            const addonItemDiv = document.createElement('div');
            addonItemDiv.className = 'addon-item usage2-item';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'addon-info';
            let infoHTML = `<span class="addon-name">${addon.name}</span>`;
            if (typeof addon.price !== 'undefined' && addon.price !== null) {
                const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';
                const priceDisplay = (addon.price / 100).toFixed(2);
                infoHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
            }
            if (addon.desc) infoHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
            infoDiv.innerHTML = infoHTML;
            addonItemDiv.appendChild(infoDiv);
            const qtyContainer = document.createElement('div');
            qtyContainer.className = 'addon-quantity-selector';
            const minusButton = document.createElement('button');
            minusButton.type = 'button'; minusButton.textContent = '-';
            minusButton.className = 'qty-btn minus-btn'; minusButton.disabled = true; 
            const qtyInput = document.createElement('input');
            qtyInput.type = 'text'; qtyInput.className = 'qty-input';
            qtyInput.value = '0'; qtyInput.readOnly = true; 
            qtyInput.dataset.addonUid = addon.uid;
            const plusButton = document.createElement('button');
            plusButton.type = 'button'; plusButton.textContent = '+';
            plusButton.className = 'qty-btn plus-btn';

            // Determine initial state for plusButton:
            if (guestCount === 0 || (getTotalUsage2AddonQuantity() >= guestCount && parseInt(qtyInput.value) === 0) ) {
                plusButton.disabled = true;
            } else {
                plusButton.disabled = false;
            }

            minusButton.addEventListener('click', () => {
                let currentSpecificValue = parseInt(qtyInput.value);
                if (currentSpecificValue > 0) {
                    currentSpecificValue--;
                    qtyInput.value = currentSpecificValue;
                    handleAddonUsage2Selection(addon, currentSpecificValue);
                    updateAllUsage2ButtonStates(guestCount);
                }
            });
            plusButton.addEventListener('click', () => {
                let currentSpecificValue = parseInt(qtyInput.value);
                const totalBeforeIncrement = getTotalUsage2AddonQuantity();

                if (totalBeforeIncrement < guestCount) {
                    currentSpecificValue++;
                    qtyInput.value = currentSpecificValue;
                    handleAddonUsage2Selection(addon, currentSpecificValue);
                    updateAllUsage2ButtonStates(guestCount);
                }
            });
            qtyContainer.appendChild(minusButton); qtyContainer.appendChild(qtyInput); qtyContainer.appendChild(plusButton);
            addonItemDiv.appendChild(qtyContainer);
            addonsDisplayArea.appendChild(addonItemDiv);
        });
        updateAllUsage2ButtonStates(guestCount);
    }

    function renderUsage3Addons(filteredAddons, guestCount, shiftName) {
        // console.log(`renderUsage3Addons for "${shiftName}" ...`); // Removed
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        if (!filteredAddons || filteredAddons.length === 0) return;
        filteredAddons.forEach(addon => { // Rest of the logic is fine
            const addonItemDiv = document.createElement('div');
            addonItemDiv.className = 'addon-item usage3-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'addon-checkbox usage3-checkbox';
            checkbox.value = addon.uid;
            checkbox.id = `addon-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
            checkbox.dataset.addonUid = addon.uid; checkbox.dataset.addonName = addon.name;
            checkbox.dataset.addonPrice = addon.price; checkbox.dataset.addonDesc = addon.desc;
            checkbox.dataset.addonPer = addon.per; checkbox.dataset.addonType = addon.type;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            let labelHTML = `<span class="addon-name">${addon.name}</span>`;
            if (typeof addon.price !== 'undefined' && addon.price !== null) {
                const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$';
                const priceDisplay = (addon.price / 100).toFixed(2);
                labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
            }
            if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
            label.innerHTML = labelHTML;
            addonItemDiv.appendChild(checkbox);
            addonItemDiv.appendChild(label);
            checkbox.addEventListener('change', handleAddonUsage3Selection); 
            addonsDisplayArea.appendChild(addonItemDiv);
        });
    }
    
    function renderGenericAddons(addonsArray, guestCount, shiftName, usagePolicy) {
        // console.log(`renderGenericAddons (fallback) for ${shiftName} ...`); // Removed
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        addonsArray.forEach(addon => { // Rest of the logic is fine
            const addonItemDiv = document.createElement('div');
            addonItemDiv.className = 'addon-item generic-addon-item'; 
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; 
            checkbox.className = 'addon-checkbox generic-addon-checkbox';
            checkbox.value = addon.uid; 
            checkbox.id = `addon-generic-${addon.uid}-${shiftName.replace(/\s+/g, '_')}`;
            checkbox.dataset.addonUid = addon.uid; checkbox.dataset.addonName = addon.name;
            checkbox.dataset.addonPrice = addon.price; checkbox.dataset.addonDesc = addon.desc;
            checkbox.dataset.addonPer = addon.per; checkbox.dataset.addonType = addon.type;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id; 
            let labelHTML = `<span class="addon-name">${addon.name}</span>`;
            if (typeof addon.price !== 'undefined' && addon.price !== null) {
                const currencySymbol = config.currSym ? config.currSym.replace(/&[^;]+;/g, '') : '$'; 
                const priceDisplay = (addon.price / 100).toFixed(2);
                labelHTML += ` <span class="addon-price">(+${currencySymbol}${priceDisplay})</span>`;
            }
            if (addon.desc) labelHTML += `<br><small class="addon-desc">${addon.desc}</small>`;
            label.innerHTML = labelHTML;
            addonItemDiv.appendChild(checkbox);
            addonItemDiv.appendChild(label);
            checkbox.addEventListener('change', handleAddonUsage3Selection); 
            addonsDisplayArea.appendChild(addonItemDiv);
        });
        if (addonsArray.length === 0 && usagePolicy) {
             addonsDisplayArea.innerHTML += `<p>No addons for generic rendering (usage ${usagePolicy}) after filtering for shift ${shiftName}.</p>`;
        }
    }

    // --- Main Addon Rendering Controller ---
    function renderAddons(originalAddonsArray, usagePolicy, guestCount, shiftName) {
        // console.log(`renderAddons called for shift: "${shiftName}" ...`); // Removed
        // console.log('Original addons received:', JSON.stringify(originalAddonsArray, null, 2)); // Removed
        const addonsDisplayArea = document.getElementById('addonsDisplayArea');
        if (!addonsDisplayArea) { console.error('Addons display area not found.'); return; }
        addonsDisplayArea.innerHTML = ''; 
        if (!originalAddonsArray || originalAddonsArray.length === 0) {
            addonsDisplayArea.innerHTML = `<p>${languageStrings.noAddonsAvailable || 'No addons available for this selection.'}</p>`;
            return;
        }
        const numericGuestCount = parseInt(guestCount);
        if (isNaN(numericGuestCount)) {
            console.error("Invalid guestCount provided to renderAddons:", guestCount); // Kept as error
            addonsDisplayArea.innerHTML = `<p class="error-message">Error: Invalid guest count for addons.</p>`;
            return;
        }
        const filteredAddons = originalAddonsArray.filter(addon => {
            const minCovers = (typeof addon.min === 'number' && !isNaN(addon.min)) ? addon.min : 1;
            const maxCovers = (typeof addon.max === 'number' && !isNaN(addon.max)) ? addon.max : Infinity;
            return numericGuestCount >= minCovers && numericGuestCount <= maxCovers;
        });
        // console.log('Filtered addons:', JSON.stringify(filteredAddons, null, 2)); // Removed
        if (filteredAddons.length === 0) {
            addonsDisplayArea.innerHTML = `<p>${languageStrings.noAddonsForGuestCount || 'No addons currently available for the selected number of guests.'}</p>`;
            return;
        }
        const title = document.createElement('h4');
        title.textContent = languageStrings.availableAddonsTitle || 'Available Addons:'; 
        addonsDisplayArea.appendChild(title);
        switch (parseInt(usagePolicy)) { 
            case 1: renderUsage1Addons(filteredAddons, numericGuestCount, shiftName); break;
            case 2: renderUsage2Addons(filteredAddons, numericGuestCount, shiftName); break;
            case 3: renderUsage3Addons(filteredAddons, numericGuestCount, shiftName); break;
            default:
                console.warn(`Unknown usagePolicy: ${usagePolicy} for shift "${shiftName}". Rendering all filtered addons generically.`); // Kept as warning
                renderGenericAddons(filteredAddons, numericGuestCount, shiftName, usagePolicy);
        }
    }

    // --- Core Logic ---
    try {
        config = await loadConfigFromServer(); 
        languageStrings = parseJsObjectString(config.lng) || {};
        if (!languageStrings.availableAddonsTitle) languageStrings.availableAddonsTitle = 'Available Addons:';
        if (!languageStrings.noAddonsAvailable) languageStrings.noAddonsAvailable = 'No addons available for this selection.';
        if (!languageStrings.noAddonsForGuestCount) languageStrings.noAddonsForGuestCount = 'No addons currently available for the selected number of guests.';
        if (!languageStrings.noAddonsAvailableTime) languageStrings.noAddonsAvailableTime = 'No addons available for this time.';

        initialShiftsConfig = parseJsObjectString(config.allShifts) || []; 
        const displayName = config.estName ? config.estName.replace(/^['"](.*)['"]$/, '$1') : currentEstName;
        if (restaurantNameSpan) restaurantNameSpan.textContent = displayName;

        if (dateSelector) {
            const todayStrForMin = getTodayDateString(); 
            dateSelector.min = todayStrForMin;
            dateSelector.value = todayStrForMin; 
            if (selectedDateValueSpan) selectedDateValueSpan.textContent = todayStrForMin; 
        } else { console.error("Date selector element not found!"); }

        const partyMin = parseInt(config.partyMin) || 1;
        const partyMax = parseInt(config.partyMax) || 10;
        if (coversSelector) {
            coversSelector.min = partyMin;
            coversSelector.max = partyMax;
            coversSelector.value = partyMin; 
            if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
        } else { console.error("Covers selector element not found!"); }

        function resetCurrentSelectedAddons() {
            currentSelectedAddons = { usage1: null, usage2: [], usage3: [] };
            const selectedAddonsValueSpan = document.getElementById('selectedAddonsValue');
            if (selectedAddonsValueSpan) selectedAddonsValueSpan.textContent = '-';

            const coversElement = document.getElementById('coversSelector');
            let currentGuestCountForReset = 0;
            if (coversElement) {
                currentGuestCountForReset = parseInt(coversElement.value) || 0;
            }
            updateAllUsage2ButtonStates(currentGuestCountForReset);
            updateNextButtonState(); // Added call
        }

        function displayTimeSlots(shiftsData) {
            // console.log('displayTimeSlots received shiftsData:', JSON.stringify(shiftsData, null, 2)); // Removed
            if (!timeSelectorContainer || !selectedTimeValueSpan) return;
            timeSelectorContainer.innerHTML = '';
            selectedTimeValueSpan.textContent = '-';
            currentShiftUsagePolicy = null; // Reset policy
            updateNextButtonState(); // Update button state

            const addonsDisplay = document.getElementById('addonsDisplayArea');
            if (addonsDisplay) addonsDisplay.innerHTML = '';
            resetCurrentSelectedAddons(); 

            if (!shiftsData || !Array.isArray(shiftsData) || shiftsData.length === 0) {
                timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
                return;
            }
            let foundAnySlotsToShow = false; 
            shiftsData.forEach(shift => { 
                // console.log('Processing shift:', JSON.stringify(shift, null, 2)); // Removed
                if (!shift || typeof shift.name !== 'string') {
                    console.warn("Invalid shift object:", shift); return; // Kept as warning
                }
                const shiftTitle = document.createElement('h3');
                shiftTitle.textContent = shift.name;
                timeSelectorContainer.appendChild(shiftTitle);
                if (shift.message && shift.message.trim() !== '') {
                    const shiftMessageDiv = document.createElement('div');
                    shiftMessageDiv.className = 'api-message shift-message';
                    shiftMessageDiv.textContent = shift.message;
                    timeSelectorContainer.appendChild(shiftMessageDiv);
                }
                const shiftButtonContainer = document.createElement('div');
                shiftButtonContainer.className = 'shift-times-wrapper';
                timeSelectorContainer.appendChild(shiftButtonContainer);
                if (Array.isArray(shift.times) && shift.times.length > 0) {
                    shift.times.forEach(timeValue => { 
                        // console.log('Attempting to process timeValue:', timeValue, 'type:', typeof timeValue); // Removed
                        if (typeof timeValue !== 'number') {
                            console.warn('Invalid time value in shift.times array:', timeValue, 'Expected a number.'); // Kept as warning
                            return; 
                        }
                        const button = document.createElement('button');
                        button.className = 'time-slot-button'; 
                        if (timeValue < 0) {
                            if (!showUnavailableSlots) return;
                            button.textContent = 'Not Available';
                            button.classList.add('time-slot-unavailable');
                            button.disabled = true;
                        } else {
                            button.classList.add('time-slot-available');
                            button.dataset.time = timeValue; 
                            button.textContent = formatTime(timeValue);
                            button.addEventListener('click', function() {
                                selectedTimeValueSpan.textContent = this.textContent;
                                timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
                                this.classList.add('time-slot-button-selected');

                                currentShiftUsagePolicy = (shift && typeof shift.usage !== 'undefined') ? shift.usage : null; // Set policy

                                const currentAddonsDisplayArea = document.getElementById('addonsDisplayArea');
                                if (currentAddonsDisplayArea) currentAddonsDisplayArea.innerHTML = ''; 
                                resetCurrentSelectedAddons(); 
                                const guestCount = parseInt(coversSelector.value); 
                                if (shift.addons && Array.isArray(shift.addons) && shift.addons.length > 0) {
                                    renderAddons(shift.addons, shift.usage, guestCount, shift.name); 
                                } else {
                                    if (currentAddonsDisplayArea) currentAddonsDisplayArea.innerHTML = `<p>${languageStrings.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
                                }
                                updateNextButtonState(); // Update button state
                            });
                        }
                        shiftButtonContainer.appendChild(button);
                        foundAnySlotsToShow = true; 
                    });
                } else { 
                    const noTimesMsg = document.createElement('p');
                    noTimesMsg.className = 'no-times-for-shift-message';
                    noTimesMsg.textContent = `No specific times listed for ${shift.name}.`;
                    shiftButtonContainer.appendChild(noTimesMsg);
                    foundAnySlotsToShow = true; 
                }
            });
            if (!foundAnySlotsToShow) {
                 timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
            }
        }

        async function handleDateOrCoversChange() {
            if (!dateSelector || !coversSelector || !selectedDateValueSpan || !selectedCoversValueSpan || !selectedTimeValueSpan || !timeSelectorContainer || !dailyRotaMessageDiv) return;
            const selectedDateStr = dateSelector.value;
            const coversValue = parseInt(coversSelector.value, 10);
            const todayComparableString = getTodayDateString();
            dailyRotaMessageDiv.textContent = '';
            dailyRotaMessageDiv.style.display = 'none';
            const addonsDisplayArea = document.getElementById('addonsDisplayArea');
            if (addonsDisplayArea) addonsDisplayArea.innerHTML = ''; 
            resetCurrentSelectedAddons(); // This already calls updateNextButtonState

            currentShiftUsagePolicy = null; // Reset policy
            // updateNextButtonState will be called by resetCurrentSelectedAddons or if time selection changes

            if (selectedDateStr < todayComparableString) {
                timeSelectorContainer.innerHTML = '<p class="error-message">Selected date is in the past. Please choose a current or future date.</p>';
                selectedDateValueSpan.textContent = '-'; 
                selectedCoversValueSpan.textContent = '-';
                selectedTimeValueSpan.textContent = '-';
                currentShiftUsagePolicy = null; updateNextButtonState(); // Explicitly update here
                return;
            }
            selectedDateValueSpan.textContent = selectedDateStr || '-';
            selectedCoversValueSpan.textContent = coversValue || '-';
            selectedTimeValueSpan.textContent = '-'; 
            currentShiftUsagePolicy = null; updateNextButtonState(); // Explicitly update here

            if (!currentEstName) { 
                console.error('Restaurant Name (est) is not set. Cannot fetch times.'); // Kept as error
                timeSelectorContainer.innerHTML = `<p class="error-message">Configuration error: Restaurant name not found.</p>`;
                return;
            }
            if (!selectedDateStr || isNaN(coversValue) || coversValue <= 0) {
                // console.log('Validation failed: Date or covers invalid.'); // Removed
                timeSelectorContainer.innerHTML = `<p class="error-message">Please select a valid date and number of guests.</p>`;
                currentShiftUsagePolicy = null; updateNextButtonState(); // Explicitly update here
                return;
            }
            // console.log(`Fetching for: est=${currentEstName}, date=${selectedDateStr}, covers=${coversValue}`); // Removed
            timeSelectorContainer.innerHTML = `<p class="loading-message">Loading times...</p>`; 
            // currentShiftUsagePolicy will be null here, button should be disabled until times load and one is selected.
            // updateNextButtonState(); // Already called above

            const availabilityData = await fetchAvailableTimes(currentEstName, selectedDateStr, coversValue);
            if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                dailyRotaMessageDiv.textContent = availabilityData.message;
                dailyRotaMessageDiv.style.display = 'block';
            } else {
                dailyRotaMessageDiv.textContent = ''; 
                dailyRotaMessageDiv.style.display = 'none';
            }
            if (availabilityData && availabilityData.shifts && availabilityData.shifts.length > 0) {
                displayTimeSlots(availabilityData.shifts);
            } else {
                timeSelectorContainer.innerHTML = ''; 
                if (!dailyRotaMessageDiv.textContent) { 
                    let messageToShow = languageStrings.noTimesAvailableDaySize || 'No time slots available for the selected date or party size.';
                    if (availabilityData && availabilityData.message && availabilityData.message.trim() !== '') {
                         messageToShow = languageStrings.noTimesAvailableDaySize || 'No time slots available for the selected date or party size.';
                    } else if (!availabilityData && !dailyRotaMessageDiv.textContent) { 
                        messageToShow = languageStrings.errorLoadingTimes || 'Could not load times. Please check connection or try again.';
                    }
                     timeSelectorContainer.innerHTML = `<p class="error-message">${messageToShow}</p>`;
                }
                selectedTimeValueSpan.textContent = '-';
                currentShiftUsagePolicy = null; // Reset policy
                updateNextButtonState(); // Update button state
            }
        }

        function setupEventListeners() {
            if (dateSelector) dateSelector.addEventListener('change', handleDateOrCoversChange);
            if (coversSelector) coversSelector.addEventListener('change', handleDateOrCoversChange);
        }
        setupEventListeners();

        // console.log(`Performing initial load for ${currentEstName}`); // Removed
        if (currentEstName && dateSelector && dateSelector.value && coversSelector && parseInt(coversSelector.value) > 0) {
            const initialDateOnLoad = dateSelector.value;
            const todayStrForInitialLoad = getTodayDateString();
            if (initialDateOnLoad >= todayStrForInitialLoad) {
                if (timeSelectorContainer) timeSelectorContainer.innerHTML = '<p class="loading-message">Loading times...</p>';
                await handleDateOrCoversChange(); 
            } else {
                if (timeSelectorContainer) timeSelectorContainer.innerHTML = '<p class="error-message">Initial date is in the past. Please select a valid date.</p>';
                if (selectedDateValueSpan) selectedDateValueSpan.textContent = initialDateOnLoad; 
                if (selectedCoversValueSpan) selectedCoversValueSpan.textContent = coversSelector.value;
                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
                currentShiftUsagePolicy = null; updateNextButtonState(); // Initial state
            }
        } else {
            let promptMessage = languageStrings.promptSelection || 'Please select date and guests for times.';
            if (!currentEstName) promptMessage = languageStrings.errorConfigMissing || 'Restaurant config missing.';
            if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p>${promptMessage}</p>`;
            // console.log('Skipping initial time slot load: conditions not met (estName, date, or covers).'); // Removed
        }
        updateNextButtonState(); // Final safety call for initial state
        // console.log('Form logic fully initialized.'); // Removed

    } catch (error) {
        console.error('Critical error during form initialization:', error); // Kept as error
        if (document.body) { 
            const errorDiv = document.createElement('div');
            errorDiv.className = 'critical-error-message'; 
            errorDiv.textContent = languageStrings.errorCriticalInit || 'Could not initialize booking form. Please try refreshing the page or contact support.';
            const formContainer = document.querySelector('.form-container');
            if (formContainer) {
                formContainer.innerHTML = ''; 
                formContainer.appendChild(errorDiv);
            } else {
                document.body.innerHTML = ''; 
                document.body.appendChild(errorDiv);
            }
        }
    }
});
