/**
 * Utility functions for phone number formatting
 */

/**
 * Format phone number with +1 prefix for US/Canada numbers
 * @param phone - Raw phone number string
 * @returns Formatted phone number with +1 prefix
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove any existing formatting
  const cleanPhone = phone.replace(/\D/g, '');
  
  // If phone number already starts with 1 and has 11 digits, add +
  if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
    return '+' + cleanPhone;
  }
  
  // If phone number has 10 digits, add +1
  if (cleanPhone.length === 10) {
    return '+1' + cleanPhone;
  }
  
  // If already has + sign, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For other cases, add +1 prefix
  return '+1' + cleanPhone;
}

/**
 * Display formatted phone number for UI
 * Adds visual formatting like (xxx) xxx-xxxx
 * @param phone - Raw phone number string
 * @returns Display-formatted phone number
 */
export function displayPhoneNumber(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  
  // Extract digits for display formatting
  const cleanPhone = formatted.replace(/\D/g, '');
  
  if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
    // Format as +1 (xxx) xxx-xxxx
    return `+1 (${cleanPhone.slice(1, 4)}) ${cleanPhone.slice(4, 7)}-${cleanPhone.slice(7)}`;
  }
  
  return formatted;
}

/**
 * Get clean phone number for API calls (with +1 prefix but no formatting)
 * @param phone - Raw phone number string
 * @returns Clean phone number for API calls
 */
export function getApiPhoneNumber(phone: string): string {
  return formatPhoneNumber(phone);
}
