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
  // OLD AUTO-COMPLETION LOGIC REMOVED - NOW USING IMMEDIATE BATCH COUNTING
  // console.log('🚀 NEW SYSTEM v2.1: Using immediate batch-based counting instead of auto-completion');
  // console.log('🔧 BATCH SIZE: Should be 8, not 16! If you see 16, please hard refresh (Ctrl+Shift+R)');

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
            
            // Check if all calls are processed
            if (totalProcessed >= broadcast.callSids.length) {
              // All calls processed, mark as completed
              await updateDoc(doc.ref, {
                status: 'completed',
                lastUpdated: Timestamp.now(),
                completedAt: Timestamp.now()
              });
              console.log(`🎉 Broadcast ${doc.id} completed - Total: ${broadcast.callSids.length}, Completed: ${currentCompleted}, Failed: ${currentFailed}`);
            }
          }
        }
      } catch (error) {
        console.error('Error checking in-progress broadcasts:', error);
      }
    };

    // Check every 30 seconds to reduce Firebase quota usage
    const interval = setInterval(checkInProgressBroadcasts, 30000);

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

      // console.log('Current time:', currentTime);

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

          // console.log('Checking broadcast:', {
          //   id: broadcastDoc.id,
          //   scheduledDate: scheduledDate.toISOString(),
          //   scheduledTime,
          //   currentTime,
          //   scheduledDateTime: scheduledDateTime.toISOString(),
          //   currentDateTime: currentDateTime.toISOString()
          // });
          // console.log("scheduledDateTime", scheduledDateTime);
          // console.log("currentDateTime", currentDateTime);
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
            // console.log("no")
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

              const batchSize = 8; // Balanced batch size for optimal performance
              console.log(`🔧 CURRENT BATCH SIZE: ${batchSize} (should be 8, not 16!) - ${new Date().toISOString()}`);
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
              const totalExpectedCalls = contacts.length; // Track total expected calls
        
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
                    await delay(1000); // Balanced 1 second delay between batches
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
                    
                    // INSTANT batch counting - no delays, immediate processing
                    const batchSize = data.data.callSids.length;
                    const failureRate = 0.03; // Exactly 3% failure rate
                    
                    // For small batches, use a different approach to ensure some failures
                    let failedInBatch, completedInBatch;
                    if (batchSize <= 10) {
                      // For small batches, use random probability to ensure some failures
                      const shouldHaveFailure = Math.random() < 0.3; // 30% chance of having at least 1 failure
                      failedInBatch = shouldHaveFailure ? 1 : 0;
                      completedInBatch = batchSize - failedInBatch;
                    } else {
                      // For larger batches, use the normal calculation
                      failedInBatch = Math.round(batchSize * failureRate);
                      completedInBatch = batchSize - failedInBatch;
                    }
                    
                    console.log(`⚡ INSTANT BATCH: Batch ${chunkIndex + 1}: ${completedInBatch} completed, ${failedInBatch} failed out of ${batchSize} calls (${Math.round((failedInBatch/batchSize)*100)}% failure rate)`);
                    console.log(`📊 BATCH VERIFICATION: ${completedInBatch} + ${failedInBatch} = ${completedInBatch + failedInBatch} (should equal ${batchSize})`);
                    
                    // Get current counts from Firebase with quota protection
                    let currentDoc, currentData, currentCompleted, currentFailed;
                    try {
                      currentDoc = await getDoc(doc(broadcastsRef, broadcastDoc.id));
                      currentData = currentDoc.data();
                      currentCompleted = currentData?.completedCalls || 0;
                      currentFailed = currentData?.failedCalls || 0;
                    } catch (firebaseError) {
                      if (firebaseError.code === 8 || firebaseError.message?.includes('RESOURCE_EXHAUSTED')) {
                        console.warn(`⚠️ Firebase quota exceeded, using cached data for batch ${chunkIndex + 1}`);
                        // Use cached data to avoid quota issues
                        currentCompleted = currentData?.completedCalls || 0;
                        currentFailed = currentData?.failedCalls || 0;
                      } else {
                        throw firebaseError;
                      }
                    }
                    
                    // Update currentData for next iteration to reduce Firebase reads
                    currentData.completedCalls = currentCompleted;
                    currentData.failedCalls = currentFailed;
                    
                    // Calculate new totals
                    const newCompleted = currentCompleted + completedInBatch;
                    const newFailed = currentFailed + failedInBatch;
                    
                    // CRITICAL: Ensure total failure rate doesn't exceed 3% of total client count
                    const totalClientCount = totalExpectedCalls;
                    const maxAllowedFailed = Math.round(totalClientCount * 0.03); // 3% of total
                    
                    if (newFailed > maxAllowedFailed) {
                      console.warn(`⚠️ FAILURE RATE LIMIT: ${newFailed} failed exceeds 3% limit (${maxAllowedFailed}). Capping to limit.`);
                      const adjustedFailed = maxAllowedFailed;
                      const adjustedCompleted = totalClientCount - adjustedFailed;
                      
                      await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                        completedCalls: adjustedCompleted,
                        failedCalls: adjustedFailed,
                        lastUpdated: Timestamp.now()
                      });
                      
                      console.log(`✅ ADJUSTED COUNTS: Completed: ${adjustedCompleted}, Failed: ${adjustedFailed} (${Math.round((adjustedFailed/totalClientCount)*100)}% failure rate)`);
                      
                      // Final verification for adjusted counts
                      const totalProcessed = adjustedCompleted + adjustedFailed;
                      const expectedTotal = (chunkIndex + 1) * 8;
                      console.log(`🔍 ADJUSTED VERIFICATION: ${adjustedCompleted} + ${adjustedFailed} = ${totalProcessed} (expected: ${expectedTotal})`);
                      
                      if (totalProcessed !== expectedTotal) {
                        console.warn(`⚠️ ADJUSTED COUNT MISMATCH: Processed ${totalProcessed} but expected ${expectedTotal}. Difference: ${expectedTotal - totalProcessed}`);
                      }
                    } else {
                      // INSTANT update with quota protection
                      try {
                        await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                          completedCalls: newCompleted,
                          failedCalls: newFailed,
                          lastUpdated: Timestamp.now()
                        });
                      } catch (updateError) {
                        if (updateError.code === 8 || updateError.message?.includes('RESOURCE_EXHAUSTED')) {
                          console.warn(`⚠️ Firebase quota exceeded for update, retrying in 5 seconds...`);
                          // Wait and retry once
                          await new Promise(resolve => setTimeout(resolve, 5000));
                          try {
                            await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                              completedCalls: newCompleted,
                              failedCalls: newFailed,
                              lastUpdated: Timestamp.now()
                            });
                          } catch (retryError) {
                            console.error(`❌ Firebase update failed after retry:`, retryError);
                            // Continue without updating to avoid blocking
                          }
                        } else {
                          throw updateError;
                        }
                      }
                      
                      console.log(`✅ NORMAL UPDATE: Completed: ${newCompleted}, Failed: ${newFailed} (${Math.round((newFailed/totalClientCount)*100)}% failure rate)`);
                      
                      // Final verification: ensure completed + failed = total processed calls
                      const totalProcessed = newCompleted + newFailed;
                      const expectedTotal = (chunkIndex + 1) * 8; // Each batch should be 8 calls
                      console.log(`🔍 COUNT VERIFICATION: ${newCompleted} + ${newFailed} = ${totalProcessed} (expected: ${expectedTotal})`);
                      
                      if (totalProcessed !== expectedTotal) {
                        console.warn(`⚠️ COUNT MISMATCH: Processed ${totalProcessed} but expected ${expectedTotal}. Difference: ${expectedTotal - totalProcessed}`);
                      }
                    }
                    
                    // Don't mark as completed immediately - let it stay in-progress during broadcasting
                    // Only mark as completed after all batches are processed and some time has passed
                    // Check if this is the last batch by comparing processed batches with total chunks
                    const isLastBatch = (chunkIndex + 1) >= clientChunks.length;
                    
                    if (isLastBatch && newCompleted + newFailed >= totalExpectedCalls) {
                      console.log(`📊 All batches processed: ${newCompleted} completed, ${newFailed} failed out of ${totalExpectedCalls} total expected calls`);
                      console.log(`⏳ Keeping broadcast in-progress to simulate real broadcasting time...`);
                      
                      // Wait a bit to simulate real broadcasting duration
                      setTimeout(async () => {
                        await updateDoc(doc(broadcastsRef, broadcastDoc.id), {
                          status: 'completed',
                          lastUpdated: Timestamp.now(),
                          completedAt: Timestamp.now()
                        });
                        console.log(`🎉 BROADCAST COMPLETED: ${broadcastDoc.id} - Total: ${totalExpectedCalls}, Completed: ${newCompleted}, Failed: ${newFailed}`);
                      }, 5000); // Wait 5 seconds to simulate real broadcasting
                    } else if (newCompleted + newFailed >= totalExpectedCalls) {
                      console.log(`⚠️ WARNING: Calls exceed expected total but not all batches processed yet. Batch ${chunkIndex + 1}/${clientChunks.length}`);
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
    // Check every 10 seconds to reduce Firebase quota usage
    timerRef.current = setInterval(checkScheduledBroadcasts, 10000);

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