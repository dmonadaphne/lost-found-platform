// Seed / test examples from the project brief.
export const lostPhone = {
  type: 'lost', itemName: 'Black Samsung Galaxy S23', category: 'Electronics',
  description: 'I lost my black Samsung Galaxy S23 near the central library. It has a cracked screen and a blue transparent case.',
  location: 'Central Library', color: 'Black', brand: 'Samsung', identifyingFeatures: 'Cracked screen, blue transparent case',
  date: new Date().toISOString().slice(0, 10), userName: 'Asha Owner', userEmail: 'asha.owner@example.com', userPhone: '9876543210',
};
export const foundPhone = {
  type: 'found', itemName: 'Samsung Mobile Phone', category: 'Electronics',
  description: 'Found a black Samsung phone outside the central library. The screen has a crack and it has a blue transparent cover.',
  location: 'Central Library', color: 'Black', brand: 'Samsung', identifyingFeatures: '',
  date: new Date().toISOString().slice(0, 10), userName: 'Ravi Finder', userEmail: 'ravi.finder@example.com', userPhone: '9123456780',
};
export const foundWallet = {
  type: 'found', itemName: 'Brown leather wallet', category: 'Wallet / Purse',
  description: 'Brown leather wallet found in the cafeteria.',
  location: 'Cafeteria', color: 'Brown', brand: '',
  date: new Date().toISOString().slice(0, 10), userName: 'Meena Finder', userEmail: 'meena.finder@example.com', userPhone: '',
};
// Plain-description pairs used by scripts/testSimilarity.js
export const positivePair = [
  'I lost my black Samsung mobile near the library. It has a cracked screen and a blue phone case.',
  'Black Samsung phone discovered outside the central library. Screen has a crack and blue cover.',
];
export const negativePair = ['Black Samsung phone with cracked screen', 'Brown leather wallet found in cafeteria'];
