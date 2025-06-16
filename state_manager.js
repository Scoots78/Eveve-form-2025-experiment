// --- State Manager ---

let state = {
    currentShiftUsagePolicy: null,
    currentSelectedAreaUID: null,
    currentAvailabilityData: null,
    isInitialRenderCycle: true,
    currentSelectedDecimalTime: null,
    currentSelectedShiftName: null, // Added
    currentSelectedAddons: {
        usage1: null,
        usage2: [],
        usage3: []
    },
    showUnavailableSlots: true, // Default value
    currentBookingUid: null, // Added for booking UID
    estForConfirmation: null,
    lngForConfirmation: null,
    restaurantFullNameFromHold: null,
    selectedDateForSummary: null,
    selectedCoversForSummary: null,
    selectedAreaNameForSummary: null,
    selectedAddonsForContext: null
};

// --- Getter and Setter Functions ---

export function getCurrentShiftUsagePolicy() {
    return state.currentShiftUsagePolicy;
}
export function setCurrentShiftUsagePolicy(policy) {
    state.currentShiftUsagePolicy = policy;
}

export function getCurrentSelectedAreaUID() {
    return state.currentSelectedAreaUID;
}
export function setCurrentSelectedAreaUID(uid) {
    state.currentSelectedAreaUID = uid;
}

export function getCurrentAvailabilityData() {
    return state.currentAvailabilityData;
}
export function setCurrentAvailabilityData(data) {
    state.currentAvailabilityData = data;
}

export function getIsInitialRenderCycle() {
    return state.isInitialRenderCycle;
}
export function setIsInitialRenderCycle(flag) {
    state.isInitialRenderCycle = flag;
}

export function getCurrentSelectedDecimalTime() {
    return state.currentSelectedDecimalTime;
}
export function getCurrentSelectedShiftName() { // Added
    return state.currentSelectedShiftName;
}

export function setCurrentSelectedDecimalTime(time, shiftName = null) { // Modified signature
    state.currentSelectedDecimalTime = time;
    state.currentSelectedShiftName = time === null ? null : shiftName; // Reset shiftName if time is reset
}

export function getSelectedAddons() {
    return JSON.parse(JSON.stringify(state.currentSelectedAddons)); // Return a deep copy to prevent direct modification
}

export function setSelectedAddons(newAddons) {
    // Expects a complete addons object, or can be extended for partial updates
    state.currentSelectedAddons = JSON.parse(JSON.stringify(newAddons));
}

export function resetSelectedAddons() {
    state.currentSelectedAddons = {
        usage1: null,
        usage2: [],
        usage3: []
    };
}

// Example of more granular update, if needed in the future.
// For now, form_logic.js seems to replace parts of the object directly or resets it.
/*
export function updateSelectedAddonItem(usageType, item, quantity = null) {
    if (usageType === 'usage1') {
        state.currentSelectedAddons.usage1 = item ? { ...item } : null;
    } else if (usageType === 'usage2') {
        if (item && quantity !== null && quantity > 0) {
            const existingIndex = state.currentSelectedAddons.usage2.findIndex(a => a.uid === item.uid);
            if (existingIndex > -1) {
                state.currentSelectedAddons.usage2[existingIndex] = { ...item, quantity };
            } else {
                state.currentSelectedAddons.usage2.push({ ...item, quantity });
            }
        } else if (item && quantity === 0) { // Remove item
            state.currentSelectedAddons.usage2 = state.currentSelectedAddons.usage2.filter(a => a.uid !== item.uid);
        }
    } else if (usageType === 'usage3') {
        if (item) { // Assuming item has a 'checked' like property or just needs to be added/removed
            const existingIndex = state.currentSelectedAddons.usage3.findIndex(a => a.uid === item.uid);
            if (item.checked && existingIndex === -1) { // Add if checked and not present
                state.currentSelectedAddons.usage3.push({ ...item });
            } else if (!item.checked && existingIndex > -1) { // Remove if unchecked and present
                state.currentSelectedAddons.usage3.splice(existingIndex, 1);
            }
        }
    }
}
*/

export function getShowUnavailableSlots() {
    return state.showUnavailableSlots;
}

export function setShowUnavailableSlots(flag) {
    state.showUnavailableSlots = flag;
}

export function getCurrentBookingUid() {
    return state.currentBookingUid;
}
export function setCurrentBookingUid(uid) {
    state.currentBookingUid = uid;
}

export function getEstForConfirmation() {
    return state.estForConfirmation;
}
export function setEstForConfirmation(est) {
    state.estForConfirmation = est;
}

export function getLngForConfirmation() {
    return state.lngForConfirmation;
}
export function setLngForConfirmation(lng) {
    state.lngForConfirmation = lng;
}

export function getRestaurantFullNameFromHold() {
    return state.restaurantFullNameFromHold;
}
export function setRestaurantFullNameFromHold(name) {
    state.restaurantFullNameFromHold = name;
}

export function clearConfirmationContext() {
    state.currentBookingUid = null;
    state.estForConfirmation = null;
    state.lngForConfirmation = null;
    state.restaurantFullNameFromHold = null;
    state.selectedDateForSummary = null;
    state.selectedCoversForSummary = null;
    state.selectedAreaNameForSummary = null;
    state.selectedAddonsForContext = null;
}

export function getSelectedAddonsForContext() {
    return state.selectedAddonsForContext; // Can be a deep copy if addons structure is complex and mutable
}
export function setSelectedAddonsForContext(addons) {
    // Assuming addons is an object/array, store a deep copy if it might be mutated elsewhere
    state.selectedAddonsForContext = addons ? JSON.parse(JSON.stringify(addons)) : null;
}

export function getSelectedDateForSummary() {
    return state.selectedDateForSummary;
}
export function setSelectedDateForSummary(dateStr) {
    state.selectedDateForSummary = dateStr;
}

export function getSelectedCoversForSummary() {
    return state.selectedCoversForSummary;
}
export function setSelectedCoversForSummary(covers) {
    state.selectedCoversForSummary = covers;
}

export function getSelectedAreaNameForSummary() {
    return state.selectedAreaNameForSummary;
}
export function setSelectedAreaNameForSummary(areaName) {
    state.selectedAreaNameForSummary = areaName;
}

// Function to get a snapshot of the entire state, primarily for debugging
export function _getFullStateSnapshot() {
    return JSON.parse(JSON.stringify(state));
}
