// FAQ copy for the /faqs page.
//
// Every answer below describes behaviour that is actually wired up today, so
// this file doubles as a record of what the product does. Two deliberate rules:
//
//   1. No claims the app cannot back. There is no SMS/mobile verification step
//      at registration, latitude/longitude are read-only and always follow the
//      map pin, the address is typed rather than reverse-geocoded, and there is
//      no payment-processor integration -- so nothing here promises a
//      verification code, a manual coordinate edit, autofilled addresses, or a
//      specific card-network security standard.
//   2. Plain English, no jargon. "Pin", "address" and "plan" instead of
//      coordinates, reverse geocoding and tier.
//
// The questions and answers are English-only for now. Page chrome (title,
// intro, category headings) is localised through the `faq` i18n namespace, so
// only these strings need translating when the copy is localised. They live
// here rather than in the locale JSON because 51 answers x 11 locales would be
// ~560 new keys, which the locale-parity ratchet
// (src/__tests__/i18n/locale-parity.test.js) would fail on every untranslated
// locale. Keep them out of the locale files until the full set is translated.
//
// The category `id` maps to `faq.categories.<id>` for the visible heading.

export const FAQ_CATEGORIES = [
  {
    id: 'general',
    items: [
      {
        q: 'What is CyraCode?',
        a: 'CyraCode gives any place a short, shareable digital address. You pick a name, drop a pin on the map, add the address, and get a code you can share and look up again later.',
      },
      {
        q: 'How do I get started?',
        a: 'Create a free account, then choose how you want to register: a name of your own, names suggested for you, or straight to your dashboard. Registering a free code needs no payment.',
      },
      {
        q: 'Is CyraCode free to use?',
        a: 'Yes. The Sandbox plan is free and includes 1,000 requests a month. Paid plans start at $29 a month on Developer.',
      },
      {
        q: 'Do I need an account to use CyraCode?',
        a: 'You need an account to register a code and to manage or look up the codes you own. The pricing page and these FAQs are open to everyone without signing in.',
      },
    ],
  },
  {
    id: 'registration',
    items: [
      {
        q: 'How do I register a new CyraCode?',
        a: 'Sign in and choose Custom Name on the mode chooser, or choose Auto-Generate if you would rather pick from suggestions. Custom Name takes two steps: Location & Name, then Address.',
      },
      {
        q: 'What information do I need to register a CyraCode?',
        a: 'A name of your choice, a point on the map for the place, and the address itself. CyraCode does not ask for a mobile number or a verification code.',
      },
      {
        q: 'Can I choose my own CyraCode name?',
        a: 'Yes. Use between 3 and 50 characters made up of letters, numbers, or spaces. Letters from any language are fine.',
      },
      {
        q: 'What if the name I want is already taken?',
        a: 'Every name is unique. If the name you entered is taken you will see five suggested alternatives to choose from, and you can enter a different name yourself.',
      },
      {
        q: 'What is the difference between Custom Name and Auto-Generate?',
        a: 'Custom Name lets you type the exact name you want. Auto-Generate gives you 10 name ideas based on the location, and you pick the one you like best.',
      },
      {
        q: 'Can I change my CyraCode name after registering?',
        a: 'No. The name is fixed once the code is created, so a code always refers to the same name. You can still update the address from Manage CyraCodes.',
      },
    ],
  },
  {
    id: 'location',
    items: [
      {
        q: 'How is my current location detected?',
        a: 'When you open the map, your browser asks whether CyraCode may use your location. If you allow it, the map centres on you. You can also press Locate at any time to re-centre.',
      },
      {
        q: 'Can I select a location on the map myself?',
        a: 'Yes. Click or tap anywhere on the map to move the pin there. Use this when the automatic position is not quite right.',
      },
      {
        q: 'What happens if I deny location permission?',
        a: 'If you would rather not share your location, choose Not now. You can still place the pin yourself and finish registering.',
      },
      {
        q: 'How are latitude and longitude captured?',
        a: 'They come from the pin you place on the map, which fills in the Latitude and Longitude fields for you. Set the pin first and both values follow it.',
      },
      {
        q: 'Can I edit latitude and longitude manually?',
        a: 'No. They are read-only and always match wherever you put the pin. Move the pin instead and the coordinates update to match.',
      },
      {
        q: 'Does CyraCode fill in my address for me?',
        a: 'No. The map gives you the pin and the coordinates, but you type the address yourself on the Address step. This keeps the address written the way the place is known locally.',
      },
      {
        q: 'Why do I see a warning about the address and the pin?',
        a: 'The address you typed and the point you dropped can sit in different places, especially with long or rural addresses. CyraCode warns you so you can check the two match before you finish.',
      },
    ],
  },
  {
    id: 'manage',
    items: [
      {
        q: 'Where can I see all my registered CyraCodes?',
        a: 'Open Manage CyraCodes from your account. Every code you have registered appears in one list, whether you named it yourself or picked a suggestion.',
      },
      {
        q: 'How do I see the details of a single CyraCode?',
        a: 'Open the code from your list to see its name, address, and location, along with a QR code you can scan.',
      },
      {
        q: 'Can I share a CyraCode with someone else?',
        a: 'Yes. Each code has a QR code you can download or copy, so anyone you share it with can open the same code you see.',
      },
      {
        q: 'Can I edit an existing CyraCode?',
        a: 'You can change the address, including the country, state, city, street, and postal code. The name cannot be changed.',
      },
      {
        q: 'What happens if I remove a CyraCode?',
        a: 'It is taken off your list and stops appearing in your lookups. The name stays reserved to your account, so nobody else can claim it. Contact support if you need it restored.',
      },
    ],
  },
  {
    id: 'account',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Choose Sign Up on the home page and enter your name, email address, and a password. Your password needs at least 8 characters, including an uppercase letter, a number, and a special character.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Open Forgot Password and enter the email on your account. If the address matches an account, a reset link is sent to your inbox. The link is valid for 24 hours and opens a page where you set a new password.',
      },
      {
        q: 'Why can I not sign in?',
        a: 'Check your password first. If you used Reset Password recently, remember it asks for at least 8 characters with an uppercase letter, a number, and a special character. If your account has been disabled, please contact support.',
      },
      {
        q: 'Does CyraCode sign me out automatically?',
        a: 'Yes. After 15 minutes with no clicking, typing, or scrolling, you are signed out and returned to the home page with a short message explaining why.',
      },
      {
        q: 'Can I change the name or email on my account?',
        a: 'Not in the app. Your full name and email are shown in the profile menu and are read-only. Contact support to have them changed.',
      },
    ],
  },
  {
    id: 'pricing',
    items: [
      {
        q: 'What plans are available?',
        a: 'Sandbox is free, Developer is $29 a month, Growth is $99 a month, Scale is $349 a month, and Enterprise is priced to suit you. Growth is the most popular.',
      },
      {
        q: 'What is the difference between monthly and annual billing?',
        a: 'Annual billing saves about 20%. The price card shows the reduced monthly rate along with the total charged once for the year.',
      },
      {
        q: 'How many requests does each plan include?',
        a: 'Sandbox includes 1,000 requests a month, Developer 100,000, Growth 1 million, and Scale 10 million. Enterprise is unlimited.',
      },
      {
        q: 'What happens if I go over my monthly allowance?',
        a: 'Developer, Growth, and Scale add a small overage rate for each extra 1,000 requests. Sandbox does not include overage.',
      },
      {
        q: 'How do I work out which plan I need?',
        a: 'Use the slider on the pricing page and move it to your expected monthly volume, from 100,000 up to 50 million requests. CyraCode recommends the plan that matches.',
      },
      {
        q: 'How do I start on a free plan?',
        a: 'Choose Start free on the Sandbox card. It takes you straight to registration, with nothing to pay and no card needed.',
      },
      {
        q: 'How do I get a plan for my organisation?',
        a: 'Choose Contact sales on the Enterprise card and we will price it around your volume and requirements.',
      },
    ],
  },
  {
    id: 'payments',
    items: [
      {
        q: 'Which payment methods can I use?',
        a: 'Credit Card, Debit Card, Net Banking, and UPI.',
      },
      {
        q: 'Can I pay with UPI?',
        a: 'Yes. Enter your UPI ID in the form name@bank along with your 10-digit mobile number, and a UPI QR code appears to scan and pay.',
      },
      {
        q: 'Can I pay through my bank?',
        a: 'Yes. Choose Net Banking and pick your bank from the list to pay through your bank\'s own payment flow.',
      },
      {
        q: 'How do I know my card details are entered correctly?',
        a: 'Details are checked as you type. The number must be 15 to 19 digits, the expiry must be a future date in MM/YY format, and the CVV is 3 digits, or 4 on an American Express card.',
      },
      {
        q: 'Is my payment processed securely?',
        a: 'You always see the amount due before you confirm, itemised as the plan price, the billing period, and an estimated tax line. Enter your card details only on the checkout page.',
      },
      {
        q: 'What is the total I will pay today?',
        a: 'The order summary shows the plan price, the billing period, an estimated tax, and the total due today. All amounts are in US dollars.',
      },
      {
        q: 'Why did my payment fail?',
        a: 'Check the card number, expiry, and CVV first, and try a different payment method if the problem continues.',
      },
      {
        q: 'How many times can I retry a failed payment?',
        a: 'After 3 failed attempts, payments are locked for one minute. Wait for the message to clear, then try again.',
      },
      {
        q: 'I have a promo code. How do I use it?',
        a: 'Enter it in the promo code box on the payment page and choose Apply. The code is recorded on your order and our team will honour eligible discounts.',
      },
      {
        q: 'What happens after I pay?',
        a: 'You reach a confirmation showing your order number, the amount charged, your plan and billing period, and your API key. Your receipt and order details are sent to your inbox.',
      },
    ],
  },
  {
    id: 'billing',
    items: [
      {
        q: 'How do I see my subscription and invoices?',
        a: 'Open My orders while you are signed in. We look up the orders on the email address belonging to your account, so your history stays private to you.',
      },
      {
        q: 'When does my subscription renew?',
        a: 'The renewal date is shown on your active subscription. It is counted from the date of your order: one month for monthly billing, twelve months for annual billing.',
      },
      {
        q: 'Can I turn auto-renew on or off?',
        a: 'Yes. Find Auto-renew on the order and switch it on or off. It is turned on by default.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'Open My orders, find the order, and choose Cancel. The subscription closes straight away and the order stays in your history as cancelled.',
      },
      {
        q: 'Can I move to a different plan?',
        a: 'There is no direct switch. Choose a different plan on the pricing page and check out, which creates a new subscription with its own API key. Cancel the old one from My orders so you are not paying for both.',
      },
      {
        q: 'Can I download an invoice?',
        a: 'Yes. Every order in My orders has a Download invoice button that saves a copy to your device.',
      },
      {
        q: 'I cannot find my orders. What should I check?',
        a: 'Check you are signed in to the same account you used at checkout. Orders placed under a different email address are not listed here — contact support and we will help track them down.',
      },
    ],
  },
]
