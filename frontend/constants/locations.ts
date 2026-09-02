/**
 * Indian States, Union Territories and Major Cities for Location Validations
 */

export const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const POPULAR_CITIES_BY_STATE: Record<string, string[]> = {
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Shivamogga", "Ballari", "Tumakuru"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Navi Mumbai"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kurnool"],
  Delhi: ["New Delhi", "North Delhi", "South Delhi", "West Delhi", "East Delhi", "Dwarka"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar"],
  "Uttar Pradesh": ["Noida", "Greater Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol", "New Town"],
  Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Kannur"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Panchkula"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer"],
  Punjab: ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Mohali"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain"],
};

/**
 * Validate that a community name contains valid alphanumeric characters, spaces, and punctuation (e.g. Cloud 9, Palm Meadows).
 */
export function isValidCommunityName(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return /^[a-zA-Z0-9\s\-',.()]+$/.test(trimmed);
}

/**
 * Validate that a city name contains only alphabetic characters and spaces.
 */
export function isValidCityName(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  return /^[a-zA-Z\s]+$/.test(trimmed);
}

/**
 * Validate that a state name is a recognized Indian state or valid alphabetic state.
 */
export function isValidStateName(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  return /^[a-zA-Z\s]+$/.test(trimmed);
}
