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

export const CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Nellore",
    "Kurnool",
    "Rajahmundry",
    "Tirupati",
    "Kadapa",
    "Kakinada",
    "Anantapur",
    "Vizianagaram",
    "Eluru",
    "Ongole",
    "Nandyal",
    "Machilipatnam",
  ],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"],
  Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
  Bihar: [
    "Patna",
    "Gaya",
    "Bhagalpur",
    "Muzaffarpur",
    "Purnia",
    "Darbhanga",
    "Bihar Sharif",
    "Arrah",
    "Begusarai",
    "Katihar",
  ],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Durg", "Jagdalpur"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Bicholim", "Curchorem"],
  Gujarat: [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Bhavnagar",
    "Jamnagar",
    "Gandhinagar",
    "Junagadh",
    "Anand",
    "Navsari",
    "Morbi",
  ],
  Haryana: [
    "Gurugram",
    "Faridabad",
    "Panipat",
    "Ambala",
    "Yamunanagar",
    "Rohtak",
    "Hisar",
    "Karnal",
    "Sonipat",
    "Panchkula",
  ],
  "Himachal Pradesh": [
    "Shimla",
    "Dharamshala",
    "Solan",
    "Mandi",
    "Kullu",
    "Manali",
    "Baddi",
    "Palampur",
  ],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh"],
  Karnataka: [
    "Bengaluru",
    "Mysuru",
    "Mangaluru",
    "Hubballi",
    "Belagavi",
    "Shivamogga",
    "Ballari",
    "Tumakuru",
    "Davanagere",
    "Kalaburagi",
    "Udupi",
  ],
  Kerala: [
    "Thiruvananthapuram",
    "Kochi",
    "Kozhikode",
    "Kollam",
    "Thrissur",
    "Kannur",
    "Alappuzha",
    "Palakkad",
    "Kottayam",
  ],
  "Madhya Pradesh": [
    "Indore",
    "Bhopal",
    "Jabalpur",
    "Gwalior",
    "Ujjain",
    "Sagar",
    "Dewas",
    "Satna",
    "Ratlam",
  ],
  Maharashtra: [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Thane",
    "Nashik",
    "Chhatrapati Sambhajinagar",
    "Solapur",
    "Navi Mumbai",
    "Kolhapur",
    "Amravati",
    "Nanded",
  ],
  Manipur: ["Imphal", "Thoubal", "Bishnupur", "Churachandpur"],
  Meghalaya: ["Shillong", "Tura", "Jowai", "Nongpoh"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai", "Serchhip"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung", "Tuensang"],
  Odisha: [
    "Bhubaneswar",
    "Cuttack",
    "Rourkela",
    "Berhampur",
    "Sambalpur",
    "Puri",
    "Balasore",
    "Bhadrak",
  ],
  Punjab: [
    "Ludhiana",
    "Amritsar",
    "Jalandhar",
    "Patiala",
    "Bathinda",
    "Mohali",
    "Hoshiarpur",
    "Pathankot",
  ],
  Rajasthan: [
    "Jaipur",
    "Jodhpur",
    "Kota",
    "Bikaner",
    "Ajmer",
    "Udaipur",
    "Bhilwara",
    "Alwar",
    "Bharatpur",
    "Sikar",
  ],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing", "Mangan"],
  "Tamil Nadu": [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruchirappalli",
    "Salem",
    "Tirunelveli",
    "Tiruppur",
    "Vellore",
    "Erode",
    "Thoothukudi",
    "Dindigul",
  ],
  Telangana: [
    "Hyderabad",
    "Warangal",
    "Nizamabad",
    "Karimnagar",
    "Khammam",
    "Ramagundam",
    "Mahbubnagar",
    "Nalgonda",
  ],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar"],
  "Uttar Pradesh": [
    "Lucknow",
    "Kanpur",
    "Ghaziabad",
    "Agra",
    "Varanasi",
    "Meerut",
    "Prayagraj",
    "Noida",
    "Greater Noida",
    "Bareilly",
    "Aligarh",
    "Moradabad",
    "Gorakhpur",
  ],
  Uttarakhand: [
    "Dehradun",
    "Haridwar",
    "Roorkee",
    "Haldwani",
    "Rudrapur",
    "Kashipur",
    "Rishikesh",
    "Nainital",
  ],
  "West Bengal": [
    "Kolkata",
    "Howrah",
    "Durgapur",
    "Asansol",
    "Siliguri",
    "Kharagpur",
    "Bardhaman",
    "New Town",
  ],
  "Andaman and Nicobar Islands": ["Port Blair"],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: [
    "New Delhi",
    "North Delhi",
    "South Delhi",
    "West Delhi",
    "East Delhi",
    "Dwarka",
    "Rohini",
  ],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti"],
  Puducherry: ["Puducherry", "Karaikal", "Ozhukarai", "Yanam", "Mahe"],
};

export const POPULAR_CITIES_BY_STATE = CITIES_BY_STATE;

/**
 * Return the list of cities for a given state, or empty array if state not found.
 */
export function getCitiesForState(state: string): string[] {
  if (!state) return [];
  return CITIES_BY_STATE[state.trim()] || [];
}

/**
 * Find which state a given city belongs to in the database.
 */
export function findStateForCity(city: string): string | null {
  const normCity = city.trim().toLowerCase();
  for (const [state, cities] of Object.entries(CITIES_BY_STATE)) {
    if (cities.some((c) => c.toLowerCase() === normCity)) {
      return state;
    }
  }
  return null;
}

/**
 * Validate that a city belongs to the selected state.
 * If city belongs to a known different state, returns an error message.
 */
export function validateCityForState(city: string, state: string): string | null {
  const trimmedCity = city.trim();
  const trimmedState = state.trim();
  if (!trimmedCity || !trimmedState) return null;

  const validCities = CITIES_BY_STATE[trimmedState];
  if (!validCities) return null;

  // Check if it's directly in the state's list (case-insensitive)
  const isCityInState = validCities.some((c) => c.toLowerCase() === trimmedCity.toLowerCase());
  if (isCityInState) return null;

  // Check if it belongs to another state
  const actualState = findStateForCity(trimmedCity);
  if (actualState && actualState.toLowerCase() !== trimmedState.toLowerCase()) {
    return `"${trimmedCity}" is in ${actualState}, not ${trimmedState}. Please select a city located in ${trimmedState}.`;
  }

  return null;
}

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

export { isValidPersonName } from "@/lib/utils";

/**
 * Validate that a state name is a recognized Indian state or valid alphabetic state.
 */
export function isValidStateName(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  return /^[a-zA-Z\s]+$/.test(trimmed);
}
