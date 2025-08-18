interface CallParams {
  phonenumber: string;
  contact_id: string;
  contact_name: string;
  email: string;
  contact_company: string;
  contact_position: string;
  empresa: string;
  voiceId: string;
  stability: number;
  similarity_boost: number;
  style_exaggeration: number;
  content: string;
  todo: string;
  notodo: string;
  campaign_id: string;
  ai_profile_name: string;
}
const serverUrl = 'https://dft9oxen20o6ge-3000.proxy.runpod.net';
export const makeCall = async (params: CallParams) => {
  try {
    const response = await fetch(`${serverUrl}/api/make-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`Failed to make call: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      return result;
    }
    
    throw new Error('Invalid response format from server');
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
}; 