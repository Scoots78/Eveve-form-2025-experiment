// Version: 20240507-140000
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global variables for the module scope ---
    let config = {};
    let languageStrings = {};
    let initialShiftsConfig = []; 
    let currentEstName = '';
    let currentShiftUsagePolicy = null; // Added for Next button logic
    let currentSelectedAreaUID = null; // Added for area selection state
    let currentAvailabilityData = null; // To store fetched availability data
    let isInitialRenderCycle = true; // Flag for initial load special behavior
    let currentSelectedDecimalTime = null; // To store the selected time as a decimal value
    // desiredStickyAreaUID has been removed
    // desiredStickyTime has been removed
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
    const areaSelectorContainer = document.getElementById('areaSelectorContainer');
    // areaSelector is now areaRadioGroupContainer; the actual radio inputs will be dynamic
    const areaRadioGroupContainer = document.getElementById('areaRadioGroupContainer');
    const areaAvailabilityMessage = document.getElementById('areaAvailabilityMessage');
    const selectedAreaValueSpan = document.getElementById('selectedAreaValue');

    // --- Helper Functions ---
    function getSelectedRadioValue(groupName) {
        const checkedRadio = document.querySelector(`input[name="${groupName}"]:checked`);
        return checkedRadio ? checkedRadio.value : null;
    }

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

    function formatSelectedAddons(selectedAddons) {
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
                if (addon.uid) {
                    addonParts.push(`${addon.uid}:1`);
                }
            });
        }
        return addonParts.join(',');
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

    // Fetches general availability, not area-specific
    async function fetchAvailableTimes(estNameForApi, date, covers) {
        const apiUrl = `https://nz.eveve.com/web/day-avail?est=${estNameForApi}&covers=${covers}&date=${date}`;
        // console.log(`Fetching available times from: ${apiUrl}`);
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

        // Area selector visibility logic
        if (areaSelectorContainer) {
            if (config.arSelect === "true") {
                areaSelectorContainer.style.display = 'block';
            } else {
                areaSelectorContainer.style.display = 'none';
            }
        }
        if (areaAvailabilityMessage && (config.arSelect !== "true" || !areaSelectorContainer || areaSelectorContainer.style.display === 'none')) {
            areaAvailabilityMessage.style.display = 'none';
        }
        updateSelectedAreaDisplay(); // Initial update after config load

        languageStrings = parseJsObjectString(config.lng) || {};
        if (!languageStrings.availableAddonsTitle) languageStrings.availableAddonsTitle = 'Available Addons:';
        if (!languageStrings.noAddonsAvailable) languageStrings.noAddonsAvailable = 'No addons available for this selection.';
        if (!languageStrings.noAddonsForGuestCount) languageStrings.noAddonsForGuestCount = 'No addons currently available for the selected number of guests.';
        if (!languageStrings.noAddonsAvailableTime) languageStrings.noAddonsAvailableTime = 'No addons available for this time.';
        if (!languageStrings.anyAreaText) languageStrings.anyAreaText = "Any Area";
        if (!languageStrings.noAreasAvailable) languageStrings.noAreasAvailable = "No specific areas available for this date/time.";
        if (!languageStrings.selectAreaPrompt) languageStrings.selectAreaPrompt = "Please select an area first.";
        if (!languageStrings.loadingTimes) languageStrings.loadingTimes = "Loading times...";
        if (!languageStrings.noTimesForArea) languageStrings.noTimesForArea = "This area is not available at this time. Please choose another area.";
        if (!languageStrings.notAvailableText) languageStrings.notAvailableText = "Not Available";
        if (!languageStrings.errorGeneric) languageStrings.errorGeneric = "An error occurred. Please try again.";
        // languageStrings.areaNotAvailableForSession has been removed.
        // languageStrings.noAreaTimesForAnySession has been removed.
        if (!languageStrings.noAreasDefined) languageStrings.noAreasDefined = "No areas are defined for selection.";


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

        function updateSelectedAreaDisplay() {
            if (selectedAreaValueSpan) {
                if (config.arSelect === "true" && areaRadioGroupContainer && areaRadioGroupContainer.style.display !== 'none') {
                    const checkedRadio = areaRadioGroupContainer.querySelector('input[name="areaSelection"]:checked');
                    if (checkedRadio) {
                        if (checkedRadio.value === "any") {
                            selectedAreaValueSpan.textContent = languageStrings.anyAreaSelectedText || "Any";
                        } else {
                            // Attempt to get the label text associated with the checked radio
                            const label = areaRadioGroupContainer.querySelector(`label[for="${checkedRadio.id}"]`);
                            selectedAreaValueSpan.textContent = label ? label.textContent : checkedRadio.value; // Fallback to value if label not found
                        }
                    } else {
                        selectedAreaValueSpan.textContent = '-'; // No radio button selected
                    }
                } else {
                    selectedAreaValueSpan.textContent = '-'; // Area selection not active
                }
            }
        }

        function createTimeSlotButton(timeValue, shiftObject, isActive = true) {
            const button = document.createElement('button');
            button.className = 'time-slot-button';

            let effectiveIsActive = isActive;

            if (timeValue < 0) { // API-defined unavailable slot
                if (!showUnavailableSlots) return null;
                button.textContent = languageStrings.notAvailableText || 'Not Available';
                button.classList.add('time-slot-unavailable');
                button.disabled = true;
                // No click listener for API-defined unavailable slots
            } else { // Potentially bookable slot (timeValue is positive)
                button.textContent = formatTime(timeValue); // Always show the formatted time
                button.dataset.time = timeValue;

                if (effectiveIsActive) {
                    button.classList.add('time-slot-available');
                    button.disabled = false;
                    // Add click listener ONLY for truly active buttons
                    button.addEventListener('click', function() {
                        selectedTimeValueSpan.textContent = this.textContent;
                        currentSelectedDecimalTime = parseFloat(this.dataset.time); // Store decimal time
                        timeSelectorContainer.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('time-slot-button-selected'));
                        this.classList.add('time-slot-button-selected');

                        currentShiftUsagePolicy = (shiftObject && typeof shiftObject.usage !== 'undefined') ? shiftObject.usage : null;

                        const currentAddonsDisplayArea = document.getElementById('addonsDisplayArea');
                        if (currentAddonsDisplayArea) currentAddonsDisplayArea.innerHTML = '';
                        resetCurrentSelectedAddons();
                        const guestCount = parseInt(coversSelector.value);
                        if (shiftObject.addons && Array.isArray(shiftObject.addons) && shiftObject.addons.length > 0) {
                            renderAddons(shiftObject.addons, shiftObject.usage, guestCount, shiftObject.name);
                        } else {
                            if (currentAddonsDisplayArea) currentAddonsDisplayArea.innerHTML = `<p>${languageStrings.noAddonsAvailableTime || 'No addons available for this time.'}</p>`;
                        }
                        updateNextButtonState();
                    });
                } else { // Not active due to other logic (e.g. area/session mismatch, isActive was passed as false)
                    button.classList.add('time-slot-inactive'); // New class for styling
                    button.disabled = true;
                    // No click listener for inactive slots
                }
            }
            return button;
        }

        function displayTimeSlots(availabilityData, stickyTimeAttempt = null) {
            if (!timeSelectorContainer || !selectedTimeValueSpan) return;

            // Centralized visibility for areaSelectorContainer based on config
            if (areaSelectorContainer) {
                if (config.arSelect === "true") {
                    areaSelectorContainer.style.display = 'block'; // Or appropriate visible style
                } else {
                    areaSelectorContainer.style.display = 'none';
                    if (areaRadioGroupContainer) areaRadioGroupContainer.innerHTML = ''; // Clear radios if section is hidden
                    if (areaAvailabilityMessage) {
                        areaAvailabilityMessage.textContent = '';
                        areaAvailabilityMessage.style.display = 'none';
                    }
                }
            }

            timeSelectorContainer.innerHTML = '';
            selectedTimeValueSpan.textContent = '-';
            currentSelectedDecimalTime = null; // Reset stored decimal time
            currentShiftUsagePolicy = null;
            updateNextButtonState();

            const addonsDisplay = document.getElementById('addonsDisplayArea');
            if (addonsDisplay) addonsDisplay.innerHTML = '';
            resetCurrentSelectedAddons();

            // Populate Area Selector with Radio Buttons
            if (areaAvailabilityMessage) { // Clear any previous global area messages
                areaAvailabilityMessage.textContent = '';
                areaAvailabilityMessage.style.display = 'none';
            }

            if (config.arSelect === "true" && areaRadioGroupContainer) {
                areaRadioGroupContainer.innerHTML = '';

                const areas = availabilityData.areas;
                let radiosPopulated = false;

                // Determine uidToSelect:
                // Start with current module-scoped currentSelectedAreaUID (which would be the sticky one if called from handleDateOrCoversChange)
                let uidToSelect = currentSelectedAreaUID;

                // Validate uidToSelect against the new availabilityData.areas
                let SPUIDIsValidInNewData = false;
                if (uidToSelect) {
                    if (uidToSelect === "any" && config.areaAny === "true") {
                        SPUIDIsValidInNewData = true;
                    } else if (uidToSelect !== "any" && areas && Array.isArray(areas)) {
                        SPUIDIsValidInNewData = areas.some(area => area.uid.toString() === uidToSelect);
                    }
                }

                if (!SPUIDIsValidInNewData) { // If no valid current/sticky selection, apply defaults
                    if (config.areaAny === "true") {
                        uidToSelect = "any";
                    } else if (areas && Array.isArray(areas) && areas.length > 0) {
                        uidToSelect = areas[0].uid.toString();
                    } else {
                        uidToSelect = null; // No possible selection
                    }
                }
                // 'uidToSelect' now holds the definitive UID that should be checked, or null.

                // Build "Any Area" radio button
                if (config.areaAny === "true") {
                    const radioId = "area-any";
                    const radioItemContainer = document.createElement('div');
                    radioItemContainer.className = 'area-radio-item';
                    const radio = document.createElement('input');
                    radio.type = 'radio'; radio.name = 'areaSelection'; radio.id = radioId; radio.value = 'any';
                    radio.checked = (uidToSelect === 'any');
                    const label = document.createElement('label');
                    label.htmlFor = radioId; label.textContent = languageStrings.anyAreaText || "Any Area";
                    radioItemContainer.appendChild(radio); radioItemContainer.appendChild(label);
                    areaRadioGroupContainer.appendChild(radioItemContainer);
                    radiosPopulated = true;
                }

                // Build specific area radio buttons
                if (areas && Array.isArray(areas) && areas.length > 0) {
                    areas.forEach((area) => {
                        const radioId = `area-${area.uid}`;
                        const radioItemContainer = document.createElement('div');
                        radioItemContainer.className = 'area-radio-item';
                        const radio = document.createElement('input');
                        radio.type = 'radio'; radio.name = 'areaSelection'; radio.id = radioId; radio.value = area.uid.toString();
                        radio.checked = (uidToSelect === area.uid.toString());
                        const label = document.createElement('label');
                        label.htmlFor = radioId; label.textContent = area.name;
                        radioItemContainer.appendChild(radio); radioItemContainer.appendChild(label);
                        areaRadioGroupContainer.appendChild(radioItemContainer);
                        radiosPopulated = true;
                    });
                }

                // 2. If no radio was checked based on currentSelectedAreaUID, apply defaults
                if (radiosPopulated && !getSelectedRadioValue("areaSelection")) {
                    let defaultRadioToSelect = null;
                    if (config.areaAny === "true") {
                        defaultRadioToSelect = areaRadioGroupContainer.querySelector('input[type="radio"][value="any"]');
                    }
                    if (!defaultRadioToSelect && areas && Array.isArray(areas) && areas.length > 0) {
                        const firstSpecificAreaValue = areas[0].uid.toString();
                        defaultRadioToSelect = areaRadioGroupContainer.querySelector(`input[type="radio"][value="${firstSpecificAreaValue}"]`);
                    }
                    if (defaultRadioToSelect) {
                        defaultRadioToSelect.checked = true;
                    }
                }

                if (!radiosPopulated) {
                    currentSelectedAreaUID = null;
                }
                // currentSelectedAreaUID will be updated after this block by getSelectedRadioValue
                // The duplicated block that referenced targetSelectedUID and radioToActuallyCheck has been removed.
                // The logic above this (starting with let uidToSelect = currentSelectedAreaUID;)
                // now correctly determines which radio button is checked.
            }
            // If config.arSelect is false, areaSelectorContainer and its contents are handled at the start of displayTimeSlots

            currentSelectedAreaUID = getSelectedRadioValue("areaSelection");
            updateSelectedAreaDisplay(); // Update after area radio group is populated/changed

            const allShifts = availabilityData.shifts;
            let foundAnySlotsToShowOverall = false;

            if (!allShifts || !Array.isArray(allShifts) || allShifts.length === 0) {
                // This message applies if no shifts returned at all, regardless of area selection
                timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No time slots available.'}</p>`;
                if (config.arSelect === "true" && currentSelectedAreaUID && currentSelectedAreaUID !== "any" && areaAvailabilityMessage) {
                    // If a specific area was selected and no shifts came back, it's effectively no times for area
                     areaAvailabilityMessage.textContent = languageStrings.noTimesForArea || "This area is not available at this time. Please choose another area.";
                     areaAvailabilityMessage.style.display = 'block';
                }
                updateNextButtonState();
                return;
            }

            // Logic for displaying times based on selected area
            if (config.arSelect === "true" && currentSelectedAreaUID && currentSelectedAreaUID !== "any") {
                const selectedAreaObject = availabilityData.areas?.find(a => a.uid.toString() === currentSelectedAreaUID);

                if (!selectedAreaObject) {
                    console.error(`Selected area UID ${currentSelectedAreaUID} not found in availabilityData.areas.`);
                    timeSelectorContainer.innerHTML = `<p class="error-message">${languageStrings.errorGeneric || "An error occurred displaying area times."}</p>`;
                    updateNextButtonState();
                    return;
                }

                const selectedAreaGeneralTimes = selectedAreaObject.times;
                if (!selectedAreaGeneralTimes || selectedAreaGeneralTimes.length === 0) {
                    if (areaAvailabilityMessage) {
                         areaAvailabilityMessage.textContent = (languageStrings.noTimesForArea || "This area has no available times on this date.").replace('{areaName}', selectedAreaObject.name);
                         areaAvailabilityMessage.style.display = 'block';
                    }
                    timeSelectorContainer.innerHTML = '';
                    updateNextButtonState();
                    return;
                }

                allShifts.forEach(shift => {
                    if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }

                    const shiftTitle = document.createElement('h3');
                    shiftTitle.textContent = shift.name;
                    timeSelectorContainer.appendChild(shiftTitle);

                    if (shift.message && shift.message.trim() !== '') {
                        const shiftMessageDiv = document.createElement('div');
                        shiftMessageDiv.className = 'api-message shift-message';
                        shiftMessageDiv.textContent = shift.message;
                        timeSelectorContainer.appendChild(shiftMessageDiv);
                    }

                    // const sessionMessageDiv = document.createElement('div'); // REMOVED
                    // sessionMessageDiv.className = 'session-area-availability-message'; // REMOVED

                    const shiftButtonContainer = document.createElement('div');
                    shiftButtonContainer.className = 'shift-times-wrapper';

                    const currentShiftSessionTimes = shift.times;

                    if (!currentShiftSessionTimes || !Array.isArray(currentShiftSessionTimes)) {
                        console.warn(`Shift '${shift.name}' (UID: ${shift.uid}) is missing 'times' (session times) data or it's not an array, for area '${selectedAreaObject.name}'.`);
                    }

                    // Determine actual bookable times for messaging (true intersection)
                    const actualBookableTimesForShiftInArea = selectedAreaGeneralTimes.filter(
                        areaTime => currentShiftSessionTimes && currentShiftSessionTimes.includes(areaTime) && areaTime >= 0
                    );

                    if (actualBookableTimesForShiftInArea.length > 0) {
                        // sessionMessageDiv.textContent = ''; // REMOVED
                        // sessionMessageDiv.style.display = 'none'; // REMOVED
                        // Iterate over all of the shift's defined times to show all potential slots
                        currentShiftSessionTimes.forEach(timeValueFromShift => {
                            if (timeValueFromShift < 0 && !showUnavailableSlots) return; // Skip negative times if not showing unavailable

                            let buttonIsActive;
                            if (isInitialRenderCycle && config.areaAny === "false") {
                                // On initial load where an area is auto-selected because areaAny is false, show all its shift's times as active
                                buttonIsActive = true;
                            } else {
                                // Normal operation: active only if the time is in the selected area's general times
                                buttonIsActive = selectedAreaGeneralTimes.includes(timeValueFromShift);
                            }
                            // However, if the time itself is negative (API unavailable), it's never active for clicking.
                            // createTimeSlotButton handles the display for timeValue < 0.
                            // We only pass isActive based on area/session matching for positive times.
                            if (timeValueFromShift < 0) buttonIsActive = false;

                            const button = createTimeSlotButton(timeValueFromShift, shift, buttonIsActive);
                            if (button) {
                                shiftButtonContainer.appendChild(button);
                                foundAnySlotsToShowOverall = true;
                            }
                        });
                    } else {
                        // let msg = languageStrings.areaNotAvailableForSession || "{areaName} is not available for the {shiftName} session."; // REMOVED
                        // msg = msg.replace('{areaName}', selectedAreaObject.name).replace('{shiftName}', shift.name); // REMOVED
                        // sessionAreaMessageDiv.textContent = msg; // REMOVED - This was likely a typo for sessionMessageDiv
                        // sessionMessageDiv.textContent = msg; // REMOVED
                        // sessionMessageDiv.style.display = 'block'; // REMOVED
                        // No buttons in shiftButtonContainer as it's empty by default
                    }
                    // Insert the button container for this shift. The session message div is no longer appended.
                    // timeSelectorContainer.appendChild(sessionAreaMessageDiv); // REMOVED - This was sessionMessageDiv before, also removed.
                    timeSelectorContainer.appendChild(shiftButtonContainer);
                });

                // If after checking all shifts, no times were found for this specific area in any valid session.
                // This message is less critical now as per-shift messages are more specific.
                // The global areaAvailabilityMessage is better used if areaSpecificTimes itself is empty.
                // Consider removing this 'noAreaTimesForAnySession' or making it a fallback for timeSelectorContainer.
                // For now, let's rely on the per-session messages and the final check on foundAnySlotsToShowOverall for timeSelectorContainer.
                // The previous logic for 'noAreaTimesForAnySession' in areaAvailabilityMessage is removed.

            } else { // "Any Area" selected or area selection not active
                allShifts.forEach(shift => {
                    if (!shift || typeof shift.name !== 'string') { console.warn("Invalid shift object:", shift); return; }
                    const shiftTitle = document.createElement('h3');
                    shiftTitle.textContent = shift.name;
                    timeSelectorContainer.appendChild(shiftTitle);
                     if (shift.message && shift.message.trim() !== '') {
                        const shiftMessageDiv = document.createElement('div');
                        shiftMessageDiv.className = 'api-message shift-message';
                        shiftMessageDiv.textContent = shift.message;
                        timeSelectorContainer.appendChild(shiftMessageDiv);
                    }
                    // sessionMessageDiv should not be created or managed here for "Any Area"
                    const shiftButtonContainer = document.createElement('div');
                    shiftButtonContainer.className = 'shift-times-wrapper';
                    timeSelectorContainer.appendChild(shiftButtonContainer);

                    if (Array.isArray(shift.times) && shift.times.length > 0) {
                        shift.times.forEach(timeValue => {
                            // For "Any Area" or when area selection is off, all defined shift times are active (unless < 0)
                            const button = createTimeSlotButton(timeValue, shift, true);
                            if (button) {
                                shiftButtonContainer.appendChild(button);
                                foundAnySlotsToShowOverall = true;
                            }
                        });
                    } else {
                        const noTimesMsg = document.createElement('p');
                        noTimesMsg.className = 'no-times-for-shift-message';
                        noTimesMsg.textContent = `No specific times listed for ${shift.name}.`;
                        shiftButtonContainer.appendChild(noTimesMsg);
                         // foundAnySlotsToShowOverall = true; // Technically true, we showed *something* for the shift
                    }
                });
            }

            if (!foundAnySlotsToShowOverall) {
                 timeSelectorContainer.innerHTML = `<p class="no-times-message">${languageStrings.noTimesAvailable || 'No specific time slots found for available shifts.'}</p>`;
                 // No specific area message needed here, as it's "Any Area" or area selection is off
            }
            updateNextButtonState(); // Update button state based on what was actually rendered and selected

            // Attempt to re-select a sticky time if one was desired and is available
            if (stickyTimeAttempt !== null) {
                const allTimeSlotButtons = timeSelectorContainer.querySelectorAll('.time-slot-button');
                let foundAndClickedStickyTime = false;
                allTimeSlotButtons.forEach(button => {
                    if (!button.disabled && parseFloat(button.dataset.time) === stickyTimeAttempt && !foundAndClickedStickyTime) {
                        button.click();
                        foundAndClickedStickyTime = true;
                    }
                });
            }
            // The stickyTimeAttempt is a local parameter, so it's naturally "reset" on the next call.
        }

        async function handleDateOrCoversChange() {
            // const previouslySelectedAreaOnEntry = currentSelectedAreaUID; // REMOVED - Area stickiness simplified
            const previouslySelectedTimeOnEntry = currentSelectedDecimalTime; // Preserve time intent

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
                if (selectedAreaValueSpan) selectedAreaValueSpan.textContent = '-';
                currentShiftUsagePolicy = null; updateNextButtonState(); // Explicitly update here
                return;
            }
            selectedDateValueSpan.textContent = selectedDateStr || '-';
            selectedCoversValueSpan.textContent = coversValue || '-';
            selectedTimeValueSpan.textContent = '-'; // Visual reset for time display
            currentSelectedDecimalTime = null; // Reset actual stored decimal time; displayTimeSlots will attempt re-selection based on previouslySelectedTimeOnEntry

            currentSelectedAreaUID = null; // Reset area selection; displayTimeSlots will apply defaults
            if (selectedAreaValueSpan) {
                 selectedAreaValueSpan.textContent = '-'; // Temporarily clear display; will be updated by displayTimeSlots
            }
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

            try {
                // currentSelectedAreaUID is used directly by fetchAvailableTimes.
                // It's updated by handleAreaChange or by displayTimeSlots after initial load.
                // The initial currentSelectedAreaUID on page load will be null, which is fine.
                // fetchAvailableTimes handles null as default/any.
                // displayTimeSlots then populates areaSelector and updates currentSelectedAreaUID.

                const availabilityData = await fetchAvailableTimes(currentEstName, selectedDateStr, coversValue);
                currentAvailabilityData = availabilityData; // Store globally
                isInitialRenderCycle = true; // Reset flag for the new data

                // The area population and currentSelectedAreaUID update happens in displayTimeSlots using the *returned* availabilityData.
                // So, the call to displayTimeSlots below will handle it.

                if (currentAvailabilityData && currentAvailabilityData.message && currentAvailabilityData.message.trim() !== '') {
                    dailyRotaMessageDiv.textContent = availabilityData.message;
                    dailyRotaMessageDiv.style.display = 'block';
                } else {
                    dailyRotaMessageDiv.textContent = '';
                    dailyRotaMessageDiv.style.display = 'none';
                }

                // Pass the whole availabilityData to displayTimeSlots
                if (currentAvailabilityData) { // Ensure currentAvailabilityData is not null
                    displayTimeSlots(currentAvailabilityData, previouslySelectedTimeOnEntry); // Pass sticky time attempt
                } else {
                    // Handle case where fetchAvailableTimes returned null (e.g., network error through its own catch)
                    // This specific 'else' might be hit if fetchAvailableTimes returns null without throwing an error that the outer try/catch would get.
                    if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">${languageStrings.errorLoadingTimes || 'Could not load times. Please try again.'}</p>`;
                    if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
                    // Do not hide areaSelectorContainer here if config.arSelect is true
                    if (areaAvailabilityMessage) {
                        areaAvailabilityMessage.textContent = '';
                        areaAvailabilityMessage.style.display = 'none';
                    }
                    currentShiftUsagePolicy = null;
                    updateNextButtonState();
                }
            } catch (error) {
                console.error('Error during availability fetch/processing in handleDateOrCoversChange:', error);
                if (timeSelectorContainer) timeSelectorContainer.innerHTML = `<p class="error-message">${languageStrings.errorLoadingTimes || 'Could not load times. Please try again.'}</p>`;
                if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
                // Do not hide areaSelectorContainer here if config.arSelect is true
                if (areaAvailabilityMessage) {
                    areaAvailabilityMessage.textContent = '';
                    areaAvailabilityMessage.style.display = 'none';
                }
                currentShiftUsagePolicy = null;
                updateNextButtonState();
            }
        }


        async function handleAreaChange(event) { // Added event parameter
            // desiredStickyTime (module-scoped) has been removed.
            // When an area is explicitly changed, any time stickiness is implicitly cleared
            // because currentSelectedDecimalTime is reset below, and displayTimeSlots is called without a stickyTimeAttempt.

            // Ensure the event target is an input element, part of the radio group
            if (!event || !event.target || event.target.name !== 'areaSelection') {
                return;
            }
            isInitialRenderCycle = false; // User has interacted with area selection
            currentSelectedAreaUID = event.target.value;
            updateSelectedAreaDisplay(); // Update display when area changes

            if (timeSelectorContainer) {
                timeSelectorContainer.innerHTML = `<p class="loading-message">${languageStrings.loadingTimes || 'Loading times...'}</p>`;
            }
            const addonsDisplay = document.getElementById('addonsDisplayArea');
            if (addonsDisplay) addonsDisplay.innerHTML = '';
            resetCurrentSelectedAddons();

            if (selectedTimeValueSpan) selectedTimeValueSpan.textContent = '-';
            currentSelectedDecimalTime = null; // Reset stored decimal time

            if (areaAvailabilityMessage) {
                areaAvailabilityMessage.textContent = '';
                areaAvailabilityMessage.style.display = 'none';
            }
            // Instead of re-fetching, use the stored global availability data
            if (currentAvailabilityData) {
                displayTimeSlots(currentAvailabilityData);
            } else {
                // Fallback if data hasn't been fetched yet (e.g. initial load error or race condition)
                console.warn("handleAreaChange called but currentAvailabilityData is null. Attempting to fetch.");
                // Display a general loading/error or try to trigger a full fetch if appropriate
                // For now, just indicate that times can't be displayed without data.
                if (timeSelectorContainer) {
                     timeSelectorContainer.innerHTML = `<p class="error-message">${languageStrings.errorLoadingTimes || 'Data not loaded. Please select date/covers again.'}</p>`;
                }
                // Optionally, could call: await handleDateOrCoversChange();
                // But the instruction is client-side re-render. If data isn't there, nothing to render for area change.
            }
        }

        function setupEventListeners() {
            if (dateSelector) dateSelector.addEventListener('change', handleDateOrCoversChange);
            if (coversSelector) coversSelector.addEventListener('change', handleDateOrCoversChange);
            if (areaRadioGroupContainer) areaRadioGroupContainer.addEventListener('change', handleAreaChange); // Changed to areaRadioGroupContainer

            const nextButton = document.getElementById('nextButton');
            if (nextButton) {
                nextButton.addEventListener('click', handleNextButtonClick);
            }
        }
        setupEventListeners();

        async function handleNextButtonClick() {
            const est = currentEstName;
            const language = (config && config.usrLang) ? config.usrLang.replace(/['"]/g, '') : 'en'; // Remove potential quotes
            const numCovers = coversSelector ? coversSelector.value : null;
            const selectedDate = dateSelector ? dateSelector.value : null;
            const decimalTime = currentSelectedDecimalTime; // Already a float or null

            let areaToSubmit = null;
            if (config.arSelect === "true" && currentSelectedAreaUID && currentSelectedAreaUID !== "any") {
                areaToSubmit = currentSelectedAreaUID;
            }

            const addonsString = formatSelectedAddons(currentSelectedAddons);

            if (!selectedDate || decimalTime === null || !numCovers || !est) { // Check decimalTime against null explicitly
                console.error("Missing required data for hold call:", { selectedDate, decimalTime, numCovers, est });
                // Optionally, display a user-friendly message to the user here
                return;
            }

            const holdApiData = {
                est: est,
                lng: language,
                covers: parseInt(numCovers, 10), // Ensure covers is an integer
                date: selectedDate,
                time: decimalTime,
                area: areaToSubmit, // Will be null if not applicable
                addons: addonsString // Add formatted addons string
            };
            console.log("Hold API Call Data:", holdApiData);

            // Construct the example URL for logging (filtering out null/undefined params)
            let holdUrl = `https://nz.eveve.com/web/hold?est=${holdApiData.est}&lng=${holdApiData.lng}&covers=${holdApiData.covers}&date=${holdApiData.date}&time=${holdApiData.time}`;
            if (holdApiData.area) { // Only add area if it's not null
                holdUrl += `&area=${holdApiData.area}`;
            }
            if (holdApiData.addons && holdApiData.addons !== "") { // Check if addons string is not empty
                holdUrl += `&addons=${holdApiData.addons}`;
            }
            console.log("Example Hold API URL:", holdUrl);

            // Actual fetch call will be added in a subsequent step.
        }

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
