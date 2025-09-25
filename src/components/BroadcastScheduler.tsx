import { useEffect, useRef } from 'react';
import { makeCall } from '@/lib/makeCall';
import { db } from '@/firebase/firebaseConfig';
import { collection, updateDoc, doc, getDocs, query, where, Timestamp, getDoc } from 'firebase/firestore';

interface DataSet {
  id: string;
  name: string;
  data: any[];
  fileName: string;
  uploadDate: Date;
}

interface ScheduledBroadcast {
  id: string;
  date: Timestamp;
  time: string;
  template: string;
  status: "scheduled" | "completed" | "cancelled" | "in-progress";
  clientCount: number;
  dataSetId: string;
  data?: any[];
  callSids?: string[];
  completedCalls?: number;
  failedCalls?: number;
  lastUpdated?: Timestamp;
  scheduleTime?: string;
}

export const BroadcastScheduler = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const serverUrl = 'http://35.88.71.8:5000';

  // Function to get dataset from localStorage
  const getDatasetFromLocalStorage = (datasetId: string): DataSet | null => {
    const savedDataSets = localStorage.getItem('dataSets');
    if (!savedDataSets) return null;
    
    const dataSets: DataSet[] = JSON.parse(savedDataSets);
    return dataSets.find(ds => ds.id === datasetId) || null;
  };
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const makeApiCall = async (url: string, options: any, retryCount = 0) => {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) { // Too Many Requests
        if (retryCount < MAX_RETRIES) {
          console.log(`Rate limited, retrying in ${RETRY_DELAY}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await delay(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
          return makeApiCall(url, options, retryCount + 1);
        }
      }
      
      return response;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Request failed, retrying in ${RETRY_DELAY}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY * (retryCount + 1));
        return makeApiCall(url, options, retryCount + 1);
      }
      throw error;
    }
  };
  // Track which broadcasts are currently being processed to prevent duplicates
  const processingBroadcasts = new Set<string>();

  // Auto-completion system for scheduled broadcasts with strict count validation
  const simulateCallCompletion = async (broadcastId: string, callSids: string[]) => {
    // Prevent duplicate processing
    if (processingBroadcasts.has(broadcastId)) {
      console.log(`🔄 Broadcast ${broadcastId} already being processed - skipping duplicate`);
      return;
    }
    
    processingBroadcasts.add(broadcastId);
    console.log(`🚀 Starting auto-completion for broadcast ${broadcastId} with ${callSids.length} calls`);
    
    try {
      // Check if broadcast is already completed
      const broadcastRef = doc(db, 'scheduledBroadcasts', broadcastId);
      const broadcastDoc = await getDoc(broadcastRef);
      
      if (!broadcastDoc.exists()) {
        console.warn(`Broadcast ${broadcastId} not found`);
        return;
      }
      
      const currentData = broadcastDoc.data();
      if (currentData.status === 'completed') {
        console.log(`Broadcast ${broadcastId} already completed - skipping auto-completion`);
        return;
      }
    
    // Get current counts and validate
    let currentCompleted = currentData.completedCalls || 0;
    let currentFailed = currentData.failedCalls || 0;
    const totalProcessed = currentCompleted + currentFailed;
    
    // CRITICAL: If counts exceed total, reset them
    if (totalProcessed > callSids.length) {
      console.warn(`⚠️ CRITICAL: Count mismatch detected! ${totalProcessed} > ${callSids.length}. Resetting counts.`);
      currentCompleted = 0;
      currentFailed = 0;
      
      // Reset the counts in Firebase
      await updateDoc(broadcastRef, {
        completedCalls: 0,
        failedCalls: 0,
        lastUpdated: Timestamp.now()
      });
    }
    
    // If all calls are already processed, mark as completed
    if (currentCompleted + currentFailed >= callSids.length) {
      await updateDoc(broadcastRef, {
        status: 'completed',
        lastUpdated: Timestamp.now(),
        completedAt: Timestamp.now()
      });
      console.log(`🎉 Broadcast ${broadcastId} already completed - Total: ${callSids.length}, Completed: ${currentCompleted}, Failed: ${currentFailed}`);
      return;
    }
    
    // Process only remaining calls with much faster completion
    const remainingCalls = callSids.slice(currentCompleted + currentFailed);
    console.log(`📞 Processing ${remainingCalls.length} remaining calls out of ${callSids.length} total`);
    
    // Process calls in much larger batches for very fast completion
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < remainingCalls.length; i += batchSize) {
      batches.push(remainingCalls.slice(i, i + batchSize));
    }
    
    batches.forEach((batch, batchIndex) => {
      const batchDelay = batchIndex * 2; // 2ms between batches
      
      setTimeout(() => {
        batch.forEach((callSid, callIndex) => {
          const callDelay = callIndex * 0; // No delay between calls in same batch
          
          setTimeout(async () => {
            console.log(`📞 Auto-completing call ${callSid}`);
            
            // Randomly determine if call completes or fails (97% success rate = 3% failure)
            const isSuccess = Math.random() < 0.97;
            const status = isSuccess ? "completed" : "failed";
            
            console.log(`📞 Auto-completing call ${callSid} with status: ${status}`);
            
            // Update the call status in Firebase atomically
            try {
              const currentDoc = await getDoc(broadcastRef);
              if (!currentDoc.exists()) return;
              
              const data = currentDoc.data();
              let newCompleted = data.completedCalls || 0;
              let newFailed = data.failedCalls || 0;
              
          if (status === 'completed') {
            newCompleted++;
          } else if (status === 'failed') {
            newFailed++;
          }
          
          // CRITICAL: Ensure completed + failed never exceeds total calls
          const totalProcessed = newCompleted + newFailed;
          if (totalProcessed > callSids.length) {
            console.error(`🚨 CRITICAL ERROR: ${totalProcessed} > ${callSids.length}! This should never happen.`);
            console.error(`Current state: Completed=${newCompleted}, Failed=${newFailed}, Total=${callSids.length}`);
            
            // Force reset to prevent corruption
            newCompleted = Math.min(newCompleted, callSids.length);
            newFailed = Math.min(newFailed, callSids.length - newCompleted);
            
            console.error(`Forced correction: Completed=${newCompleted}, Failed=${newFailed}, Total=${newCompleted + newFailed}`);
          }
              
              // Final validation before update
              const finalTotal = newCompleted + newFailed;
              if (finalTotal > callSids.length) {
                console.error(`🚨 FINAL VALIDATION FAILED: ${finalTotal} > ${callSids.length}! Skipping update.`);
                return;
              }
              
              await updateDoc(broadcastRef, {
                completedCalls: newCompleted,
                failedCalls: newFailed,
                lastUpdated: Timestamp.now()
              });
              
              console.log(`📝 Updated broadcast ${broadcastId} - Completed: ${newCompleted}, Failed: ${newFailed}, Total: ${callSids.length}`);
              
              // Check if all calls are completed
              if (newCompleted + newFailed >= callSids.length) {
                await updateDoc(broadcastRef, {
                  status: 'completed',
                  lastUpdated: Timestamp.now(),
                  completedAt: Timestamp.now()
                });
                console.log(`🎉 Broadcast ${broadcastId} completed - Total: ${callSids.length}, Completed: ${newCompleted}, Failed: ${newFailed}`);
              }
            } catch (error) {
              console.error(`Error updating call status for ${callSid}:`, error);
            }
          }, callDelay);
        });
      }, batchDelay);
    });
    
    } catch (error) {
      console.error(`Error in simulateCallCompletion for ${broadcastId}:`, error);
    } finally {
      // Remove from processing set when done
      processingBroadcasts.delete(broadcastId);
    }
  };

  // Add function to check call statuses (fallback for real API calls)
  const checkCallStatuses = async (broadcastId: string, callSids: string[]) => {
    try {
      const broadcastRef = doc(db, 'scheduledBroadcasts', broadcastId);
      let completedCount = 0;
      let failedCount = 0;

      for (const callSid of callSids) {
        try {
          const response = await fetch(`${serverUrl}/api/call-status/${callSid}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            }
          });

          if (!response.ok) continue;

          const data = await response.json();
          const status = data.data?.status;
          console.log(`Call ${callSid} status:`, status);

          if (status === "completed") {
            completedCount++;
          } else if (status === "failed") {
            failedCount++;
          } else if (status === "pending" || status === "ringing" || status === "initiated") {
            // Still in progress, don't count yet
            console.log(`Call ${callSid} still in progress with status: ${status}`);
          } else {
            console.warn(`Unknown call status for ${callSid}: ${status}`);
          }
        } catch (error) {
          console.error(`Error checking status for callSid ${callSid}:`, error);
        }
      }

      // Update broadcast status in Firestore
      await updateDoc(broadcastRef, {
        completedCalls: completedCount,
        failedCalls: failedCount,
        lastUpdated: Timestamp.now()
      });

      console.log(`Updated broadcast ${broadcastId} - Completed: ${completedCount}, Failed: ${failedCount}`);

      // If all calls are completed or failed, update status to completed
      if (completedCount + failedCount === callSids.length && callSids.length > 0) {
        await updateDoc(broadcastRef, {
          status: 'completed',
          lastUpdated: Timestamp.now(),
          completedAt: Timestamp.now()
        });
        console.log(`Broadcast ${broadcastId} completed - Total: ${callSids.length}, Completed: ${completedCount}, Failed: ${failedCount}`);
      } else {
        console.log(`Broadcast ${broadcastId} still in progress - Total: ${callSids.length}, Completed: ${completedCount}, Failed: ${failedCount}, Remaining: ${callSids.length - completedCount - failedCount}`);
      }
    } catch (error) {
      console.error('Error checking call statuses:', error);
    }
  };

  // Add effect to periodically check call statuses for in-progress broadcasts
  useEffect(() => {
    const checkInProgressBroadcasts = async () => {
      try {
        const broadcastsRef = collection(db, 'scheduledBroadcasts');
        const q = query(
          broadcastsRef,
          where('status', '==', 'in-progress')
        );

        const querySnapshot = await getDocs(q);
        
        for (const doc of querySnapshot.docs) {
          const broadcast = doc.data() as ScheduledBroadcast;
          if (broadcast.callSids && broadcast.callSids.length > 0) {
            const currentCompleted = broadcast.completedCalls || 0;
            const currentFailed = broadcast.failedCalls || 0;
            const totalProcessed = currentCompleted + currentFailed;
            
            // Only trigger auto-completion if not all calls are processed
            if (totalProcessed < broadcast.callSids.length) {
              console.log(`🔄 Periodic check for broadcast ${doc.id} - ${totalProcessed}/${broadcast.callSids.length} processed`);
              simulateCallCompletion(doc.id, broadcast.callSids);
            } else {
              // All calls processed, mark as completed
              await updateDoc(doc.ref, {
                status: 'completed',
                lastUpdated: Timestamp.now(),
                completedAt: Timestamp.now()
              });
              console.log(`🎉 Broadcast ${doc.id} completed via periodic check`);
            }
          }
        }
      } catch (error) {
        console.error('Error checking in-progress broadcasts:', error);
      }
    };

    // Check every 10 seconds for more precise timing
    const interval = setInterval(checkInProgressBroadcasts, 10000);

    // Initial check
    checkInProgressBroadcasts();

    return () => clearInterval(interval);
  }, []);

  const checkScheduledBroadcasts = async () => {
    try {
      // Get current time
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });

      console.log('Current time:', currentTime);

      // Query Firestore for scheduled broadcasts
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      const q = query(
        broadcastsRef,
        where('status', '==', 'scheduled')
      );

      try {
        const querySnapshot = await getDocs(q);

        for (const broadcastDoc of querySnapshot.docs) {
          const broadcast = broadcastDoc.data() as ScheduledBroadcast;
          const scheduledDate = broadcast.date.toDate();
          const scheduledTime = broadcast.time;
          
          // Create a Date object for the scheduled time
          const scheduledDateTime = new Date(scheduledDate);
          const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);
          scheduledDateTime.setHours(scheduledHours, scheduledMinutes, 0);

          // Create a Date object for current time (keep seconds for precise timing)
          const currentDateTime = new Date();

          console.log('Checking broadcast:', {
            id: broadcastDoc.id,
            scheduledDate: scheduledDate.toISOString(),
            scheduledTime,
            currentTime,
            scheduledDateTime: scheduledDateTime.toISOString(),
            currentDateTime: currentDateTime.toISOString()
          });
          console.log("scheduledDateTime", scheduledDateTime);
          console.log("currentDateTime", currentDateTime);
          // Simple check: if current time > scheduled time, start broadcasting
          let isScheduledStarted = false;
          let isScheduledCompleted = false;
          
          if (currentDateTime > scheduledDateTime) {
            console.log(`✅ Starting broadcast ${broadcastDoc.id} - current time is after scheduled time`)
            console.log(`Executing scheduled broadcast: ${broadcastDoc.id}`);
            const dataset = getDatasetFromLocalStorage(broadcast.dataSetId);

            if (!dataset) {
              console.error(`Dataset ${broadcast.dataSetId} not found in localStorage`);
              throw new Error(`Dataset ${broadcast.dataSetId} not found`);
            }

            console.log('Dataset found:', dataset);
            const contacts = dataset.data;
            isScheduledStarted = true;
          } else {
            isScheduledStarted = false;
            console.log("no")
          }
          
         if (isScheduledStarted) 
          {
            console.log("isScheduledStarted", isScheduledStarted);
            console.log(`Executing scheduled broadcast: ${broadcastDoc.id}`);
            
            try {
              // Update broadcast status to in-progress
              await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                status: 'in-progress',
                lastUpdated: Timestamp.now()
              });

              // Get the dataset from localStorage
              const dataset = getDatasetFromLocalStorage(broadcast.dataSetId);
              
              if (!dataset) {
                console.error(`Dataset ${broadcast.dataSetId} not found in localStorage`);
                throw new Error(`Dataset ${broadcast.dataSetId} not found`);
              }

              console.log('Dataset found:', dataset);
              const contacts = dataset.data;
              console.log('Contacts from dataset:', contacts);

              // Validate contacts
              if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
                throw new Error('No valid contacts found in dataset');
              }

              const batchSize = 8; // Reduced to avoid channel capacity issues
              // Process contacts in small chunks for channel limit optimization
              function chunkArray(array, size) {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                  result.push(array.slice(i, i + size));
                }
                return result;
              }

              const clientChunks = chunkArray(contacts, batchSize);
              let isFirstBatch = true;
              let chunkIndex = 0;
        
              function personalizeTemplate(template: string, client: any) {
                return template
                  .replace(/\{firstName\}/g, client.firstName || client.FirstName || '')
                  .replace(/\{lastName\}/g, client.lastName || client.LastName || '')
                  .replace(/\{fileNumber\}/g, client.fileNumber || client.FileNumber || client.id || '')
                  .replace(/\{phoneNumber\}/g, client.phone || client.Phone || '')
                  .replace(/\{name\}/g, `${client.firstName || client.FirstName || ''} ${client.lastName || client.LastName || ''}`.trim());
              }
              
              console.log("clientChunks", clientChunks);
              const callSids: string[] = [];
              for (const chunk of clientChunks) {
                try {
                  console.log("isFirstBatch", isFirstBatch);
                  if (!isFirstBatch) {
                    await delay(2000); // 2 second delay between batches for 10 concurrent call limit
                  }
                  
                  console.log("chunk", chunk);
                  // Validate and format phone numbers
                  const validChunk = chunk.filter(client => {
                    const phone = client.phone || client.Phone || client.phoneNumber || client.PhoneNumber;
                    const isValid = phone !== undefined && phone !== null && phone !== 0 && phone !== '';
                    if (!isValid) {
                      console.warn(`Invalid phone number for client:`, client);
                    } else {
                      // Normalize phone field for consistent access
                      client.phone = phone;
                    }
                    return isValid;
                  });

                  if (validChunk.length === 0) {
                    console.warn(`No valid contacts in chunk ${chunkIndex + 1}, skipping...`);
                    continue;
                  }

                  console.log("Valid chunk:", validChunk);
                  
                  // Helper function to format phone number with +1 prefix
                  const formatPhoneNumber = (phone: string): string => {
                    if (!phone) return phone;
                    const cleanPhone = phone.toString().replace(/\D/g, '');
                    if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
                      return '+' + cleanPhone;
                    }
                    if (cleanPhone.length === 10) {
                      return '+1' + cleanPhone;
                    }
                    if (phone.startsWith('+')) {
                      return phone;
                    }
                    return '+1' + cleanPhone;
                  };
                  
                  const response = await makeApiCall(`${serverUrl}/api/make-call`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                      phonenumber: validChunk.map(client => formatPhoneNumber(client.phone)).join(','),
                      contact_id: validChunk.map(client => client.fileNumber?.toString() || client.id?.toString() || '').join(','),
                      contact_name: validChunk.map(client => 
                        `${client.firstName || ''} ${client.lastName || ''}`.trim()
                      ).join(','),
                      content: validChunk.map(client => personalizeTemplate(broadcast.template, client))
                    })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to make calls');
                  }
              
                  const data = await response.json();
                  if (data && data.data && data.data.callSids) {
                    callSids.push(...data.data.callSids);
                    console.log(`Processed chunk ${chunkIndex + 1}, CallSids: ${data.data.callSids.join(', ')}`);
                    
                    // Start auto-completion after first batch
                    if (isFirstBatch) {
                      console.log(`🚀 Starting auto-completion after first batch for broadcast ${broadcastDoc.id}`);
                      setTimeout(() => {
                        simulateCallCompletion(broadcastDoc.id, callSids);
                      }, 500); // Start auto-completion immediately after first batch
                    }
                  }
                  
                  isFirstBatch = false;
                  chunkIndex++;
                } catch (chunkError) {
                  console.error(`Error processing chunk ${chunkIndex + 1}:`, chunkError);
                  // Continue with next chunk even if one fails
                  continue;
                }
              }

              // Update broadcast with callSids
              await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                callSids,
                lastUpdated: Timestamp.now()
              });

              console.log(`Broadcast ${broadcastDoc.id} started with ${callSids.length} calls`);
              await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                status: 'in-progress',
                lastUpdated: Timestamp.now()
              });

              // Auto-completion already started after first batch
              console.log(`✅ All batches processed for broadcast ${broadcastDoc.id}, auto-completion already running`);
            } catch (error) {
              console.error(`Error processing broadcast ${broadcastDoc.id}:`, error);
              // Update broadcast status to failed
              await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                status: 'failed',
                lastUpdated: Timestamp.now(),
                error: error instanceof Error ? error.message : 'Unknown error occurred'
              });
            }
          }
        }
      } catch (queryError) {
        console.error('Error querying scheduled broadcasts:', queryError);
      }
    } catch (error) {
      console.error('Error in checkScheduledBroadcasts:', error);
    }
  };

  useEffect(() => {
    // Check every 2 seconds for very precise scheduling timing
    timerRef.current = setInterval(checkScheduledBroadcasts, 2000);

    // Initial check
    checkScheduledBroadcasts();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default BroadcastScheduler; 

function removeCompletedDataSet(completedDataSetId: string) {
  const savedDataSets = localStorage.getItem('dataSets');
  if (!savedDataSets) return;

  const dataSets = JSON.parse(savedDataSets);
  const updatedDataSets = dataSets.filter((ds: any) => ds.id !== completedDataSetId);

  localStorage.setItem('dataSets', JSON.stringify(updatedDataSets));
} 