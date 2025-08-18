// const fetch from 'node-fetch';

async function getCallStatus(callSid) {
    try {
        const response = await fetch(`https://536a-74-80-187-81.ngrok-free.app/api/call-status/${callSid}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Call Status:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error fetching call status:', error);
        throw error;
    }
}

// Example usage
const callSid = 'CAc0aa4d05d8c89ba81a50f7418f4f77fd';
getCallStatus(callSid)
    .then(data => {
        console.log('Successfully retrieved call status');
    })
    .catch(error => {
        console.error('Failed to get call status:', error);
    }); 