export const eventsB = [
  {
    uid: 1000,
    name: "Feast Mataka - 5 Course Degustation Menu $119 p/p",
    early: 18.00,
    late: 18.00,
    desc: "<p>Indulge in a culinary journey with our exclusive 5-course degustation menu, Feast Mataka. Curated by our head chef, this menu showcases the best of seasonal and local produce, offering a unique dining experience. Priced at $119 per person.</p><p><strong>Menu Highlights:</strong></p><ul><li>Amuse-bouche: Chef's daily creation</li><li>First Course: Seared Scallops with Lemon Myrtle Beurre Blanc</li><li>Second Course: Slow-cooked Lamb Rump with Root Vegetable Medley</li><li>Third Course: Palate Cleanser - Native Lime Sorbet</li><li>Fourth Course: Pan-fried Barramundi with Saffron Risotto</li><li>Fifth Course: Deconstructed Pavlova with Berry Coulis</li></ul><p><em>Please note: Menu items are subject to change based on seasonal availability. We can cater to most dietary requirements with advance notice.</em></p>",
    card: 2, // Assuming card relates to addon types or similar
    // Potentially add date constraints if events are not daily
    // e.g., specificDate: "2024-07-20", or dateRange: { start: "2024-08-01", end: "2024-08-07" }
    // For now, assuming events are potentially available daily unless filtered otherwise
  },
  {
    uid: 1001,
    name: "Sunday Brunch Special - $45 p/p",
    early: 10.00,
    late: 14.00, // Available from 10 AM to 2 PM
    desc: "<p>Join us for our delightful Sunday Brunch! Enjoy a selection of brunch classics, fresh juices, and a complimentary mimosa or mocktail upon arrival. All for just $45 per person.</p><p><strong>Menu Includes (choose one main):</strong></p><ul><li>Eggs Benedict with Smoked Salmon or Bacon</li><li>Avocado Toast with Poached Eggs and Feta</li><li>Buttermilk Pancakes with Berry Compote and Maple Syrup</li><li>Big Breakfast Platter (Sausages, Bacon, Eggs, Mushrooms, Tomato, Toast)</li></ul><p><em>Coffee, tea, and fresh juices included.</em></p>",
    card: 1,
    // Example: This event is only on Sundays. Filtering logic will need to handle this.
    dayOfWeek: 0, // 0 for Sunday, 1 for Monday, etc.
  },
  {
    uid: 1002,
    name: "Exclusive Wine Pairing Dinner - $150 p/p",
    early: 19.00,
    late: 19.30, // Two sittings
    desc: "<p>Experience an unforgettable evening with our Exclusive Wine Pairing Dinner. Our sommelier has expertly matched a selection of fine wines with a bespoke 4-course menu created by our chef. Limited seats available. $150 per person.</p>",
    card: 3,
    specificDate: "2024-12-15", // Example of a one-off event
  }
];

// Example structure for eventMessages, if needed separately.
// For now, descriptions are within eventsB.
// export const eventMessages = {
//   1000: {
//     "Date/covers": "This is a special fixed time event. Please select number of guests.",
//     "Confirmation": "You have booked the Feast Mataka."
//   },
//   1001: {
//     "Date/covers": "Our Sunday Brunch is popular! Book your spot now.",
//     "Confirmation": "Enjoy your Sunday Brunch!"
//   }
// };

// This flag could be part of general booking config if events are optional globally
export const showEventsFeature = true; // Master switch for the events feature

// This would be dynamically set based on user selection
// export let selectedEventNameForBooking = ""; // Example, will be managed in state_manager
