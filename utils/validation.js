// Shared by the React forms (instant feedback) AND the serverless API (the
// real check, because anyone can call an API without using our forms).

export const CATEGORIES = [
  'Electronics', 'Wallet / Purse', 'Bags', 'Keys', 'ID Cards / Documents',
  'Clothing', 'Books / Stationery', 'Jewellery / Accessories',
  'Sports Equipment', 'Water Bottle / Lunch Box', 'Other',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_IMAGE_CHARS = 40000;
const MAX = {
  itemName: 100, description: 1000, location: 150, color: 50, brand: 50,
  identifyingFeatures: 500, userName: 100, additionalInfo: 500,
};

export function validateReportInput(input = {}) {
  const text = (key) => (typeof input[key] === 'string' ? input[key].trim() : '');
  const data = {
    type: text('type'),
    itemName: text('itemName'),
    category: text('category'),
    description: text('description'),
    location: text('location'),
    date: text('date'),
    time: text('time'),
    color: text('color'),
    brand: text('brand'),
    identifyingFeatures: text('identifyingFeatures'),
    imageUrl: text('imageUrl') || null,
    userName: text('userName'),
    userEmail: text('userEmail').toLowerCase(),
    userPhone: text('userPhone'),
    additionalInfo: text('additionalInfo'),
  };

  const errors = {};
  if (!['lost', 'found'].includes(data.type)) errors.type = 'Type must be "lost" or "found".';
  if (!data.itemName) errors.itemName = 'Item name is required.';
  if (!CATEGORIES.includes(data.category)) errors.category = 'Please choose a category.';
  if (data.description.length < 15) errors.description = 'Describe the item in at least 15 characters. More detail means better matches.';
  if (!data.location) errors.location = 'Location is required.';
  if (!data.userName) errors.userName = 'Your name is required.';
  if (!EMAIL_RE.test(data.userEmail)) errors.userEmail = 'Enter a valid email address.';
  if (data.userPhone && !PHONE_RE.test(data.userPhone)) errors.userPhone = 'Enter a valid phone number.';
  if (data.time && !TIME_RE.test(data.time)) errors.time = 'Use the format HH:MM.';

  if (!DATE_RE.test(data.date) || Number.isNaN(Date.parse(data.date))) {
    errors.date = 'Choose a valid date.';
  } else if (Date.parse(data.date) > Date.now() + 24 * 60 * 60 * 1000) {
    // one day of slack so time zones never block a legitimate "today"
    errors.date = 'The date cannot be in the future.';
  }

  for (const [key, max] of Object.entries(MAX)) {
    if (data[key].length > max) errors[key] = `Keep this under ${max} characters.`;
  }

   if (data.imageUrl) {
    if (!data.imageUrl.startsWith('data:image/jpeg;base64,')) errors.imageUrl = 'Photo must be uploaded through the app.';
    else if (data.imageUrl.length > MAX_IMAGE_CHARS) errors.imageUrl = 'That photo is too large. Try a smaller one.';
  }

  return { valid: Object.keys(errors).length === 0, errors, data };
}
