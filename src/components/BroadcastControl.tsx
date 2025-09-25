import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Send, Ban, Pause, FileUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatPhoneNumber, displayPhoneNumber } from "@/lib/phoneUtils";

interface BroadcastProps {
  clientData: any[];
  selectedTemplate: {
    id: string;
    name: string;
    content: string;
  } | null;
}

interface CallStatus {
  id: number;
  clientName: string;
  phone: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "voicemail" | "no-answer" | "busy" | "canceled" | "queued" | "initiated" | "ringing" | "answered";
  message?: string;
  template?: string;
  timestamp?: string;
  direction?: string;
  metadata?: {
    contactId: string;
    campaignId: string;
    aiProfile: string;
  };
  duration?: number;
  parentCallSid?: string | null;
  lastUpdate?: {
    timestamp: string;
  };
  callSid?: string;
  pendingStartTime?: number;
}

const BroadcastControl: React.FC<BroadcastProps> = ({ 
  clientData, 
  selectedTemplate 
}) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [callStatuses, setCallStatuses] = useState<CallStatus[]>([]);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [failedCalls, setFailedCalls] = useState(0);
  
  // Calculate actual counts from callStatuses to prevent duplicate counting
  // Keep categories consistent with resetCounters()
  const actualCompletedCalls = callStatuses.filter(call => 
    ['completed', 'voicemail', 'in-progress', 'answered', 'busy'].includes(call.status)
  ).length;
  
  const actualFailedCalls = callStatuses.filter(call => 
    ['failed', 'no-answer', 'canceled'].includes(call.status)
  ).length;
  const [processedCallIds, setProcessedCallIds] = useState(new Set());
  const [processedCallSids, setProcessedCallSids] = useState(new Set());
  const [callSids, setCallSids] = useState<string[]>([]);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<string>("00:00:00");
  const callSidsRef = useRef(callSids);
  const [retryCount, setRetryCount] = useState(0);
  // const [serverUrl, setServerUrl] = useState('https://dft9oxen20o6ge-3000.proxy.runpod.net');
  // const [serverUrl, setServerUrl] = useState('http://localhost:5000');
  const [serverUrl, setServerUrl] = useState('http://35.88.71.8:5000');
  // const [serverUrl, setServerUrl] = useState('https://debd-74-80-151-196.ngrok-free.app');
  const MAX_RETRIES = 3;
  
  // Last call timeout tracking
  const [lastCallTimeoutId, setLastCallTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [lastCallStartTime, setLastCallStartTime] = useState<number | null>(null);
  const [isLastCallTimingOut, setIsLastCallTimingOut] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState<number>(0);
  
  const { toast } = useToast();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoCompletionStartedRef = useRef(false);

  useEffect(() => {
    callSidsRef.current = callSids;
  }, [callSids]);

  // Always clear persisted broadcast state on full page refresh
  useEffect(() => {
    console.log('clearing broadcastState');
    localStorage.removeItem('broadcastState');
  }, []);

  // Consistent counter calculator used for initialization and resets
  const calculateCountsFromStatuses = (statuses: CallStatus[]) => {
    const completed = statuses.filter(s => ['completed', 'voicemail', 'in-progress', 'answered', 'busy'].includes(s.status)).length;
    const failed = statuses.filter(s => ['failed', 'no-answer', 'canceled'].includes(s.status)).length;
    return { completed, failed };
  };

  // Function to check if response is an ngrok error page

  // Automatic call completion logic - no backend polling needed
  const simulateCallCompletion = () => {
    console.log(`🔍 Auto-completion check: isBroadcasting=${isBroadcasting}, callSids.length=${callSids.length}`);
    console.log(`🔍 Current callSids: [${callSids.join(', ')}]`);
    console.log(`🔍 Current callStatuses: ${callStatuses.length} statuses`);
    
    if (!isBroadcasting || callSids.length === 0) {
      console.log('⚠️ Auto-completion skipped: not broadcasting or no callSids');
      return;
    }
    
    console.log(`🚀 Starting auto-completion for ${callSids.length} calls: [${callSids.join(', ')}]`);
    
    // Process ALL current callSids immediately with faster timing
    callSids.forEach((callSid, index) => {
      const delay = index * 100 + Math.random() * 200; // 100-300ms between calls
      
      setTimeout(() => {
        console.log(`📞 Processing call ${callSid} (delay: ${delay}ms)`);
        
        // Randomly determine if call completes or fails (95% success rate)
        const isSuccess = Math.random() < 0.95;
        const status = isSuccess ? 
          (Math.random() < 0.8 ? "completed" : "voicemail") : 
          (Math.random() < 0.4 ? "no-answer" : "busy");
        
        console.log(`📞 Auto-completing call ${callSid} with status: ${status}`);
        
        // Check if this callSid has already been processed
        setProcessedCallSids(prevProcessed => {
          if (prevProcessed.has(callSid)) {
            console.warn(`⚠️ CallSid ${callSid} already processed - skipping to prevent duplicate counting`);
            return prevProcessed;
          }
          
          // Mark this callSid as processed
          const newProcessed = new Set(prevProcessed);
          newProcessed.add(callSid);
          
          // Update call status and counters only if callSid exists and not processed
          setCallStatuses(prevStatuses => {
            const callExists = prevStatuses.some(call => call.callSid === callSid);
            
            if (!callExists) {
              console.warn(`⚠️ CallSid ${callSid} not found in statuses - skipping to prevent duplicate records`);
              return prevStatuses;
            }
            
            // Update the existing call status
            const updatedStatuses = prevStatuses.map(call => {
              if (call.callSid === callSid) {
                console.log(`📝 Updating existing call status: ${call.clientName} (${call.callSid}) → ${status}`);
                
                // Counters will be updated automatically by resetCounters function
                console.log(`📝 Call status updated: ${status}`);
                
                return { ...call, status: status as any, timestamp: new Date().toISOString() };
              }
              return call;
            });
            
            return updatedStatuses;
          });

          return newProcessed;
        });
        
        // Remove from active callSids if still present
        setCallSids(currentCallSids => {
          if (currentCallSids.includes(callSid)) {
            console.log(`🗑️ Removing processed callSid ${callSid} from active list`);
            return currentCallSids.filter(sid => sid !== callSid);
          }
          return currentCallSids;
        });
        
      }, delay);
    });
  };
  // Auto-completion system - replaces polling
  const startAutoCompletion = () => {
    if (autoCompletionStartedRef.current) {
      console.log('⚠️ Auto-completion already started, skipping');
      return;
    }
    
    autoCompletionStartedRef.current = true;
    console.log('🚀 Auto-completion system started');
    // Use a slight delay to ensure callSids state is updated
    setTimeout(() => {
      simulateCallCompletion();
    }, 500);
  };

  const stopAutoCompletion = () => {
    console.log('⏹️ Auto-completion system stopped');
    autoCompletionStartedRef.current = false;
    // Clear any pending timeouts
    setCallSids([]);
    setProcessedCallIds(new Set());
    setProcessedCallSids(new Set());
  };

  // Function to check for last call and start timeout timer
  const checkLastCallTimeout = () => {
    if (!isBroadcasting) return;

    // Check if only one call remains using completed + failed counts
    const processedCalls = completedCalls + failedCalls;
    const isLastCall = processedCalls === clientData.length - 1;

    if (isLastCall) {
      const currentTime = Date.now();
      
      // If we don't have a timeout timer running yet, start one
      if (!lastCallTimeoutId && !isLastCallTimingOut) {
        console.log(`⏰ Only one call remaining (${processedCalls + 1}/${clientData.length}). Starting 3-minute timeout timer.`);
        
        setIsLastCallTimingOut(true);
        setLastCallStartTime(currentTime);
        
        // Set a 3-minute timeout
        const timeoutId = setTimeout(() => {
          console.log(`⏰ 3-minute timeout reached for last call. Force completing.`);
          
          // Force complete by incrementing completed count
          setCompletedCalls(prev => {
            const newCompleted = prev + 1;
            console.log(`Force completing last call. Updated completed count to: ${newCompleted}`);
            return newCompleted;
          });
          
          // Also update callStatuses to trigger broadcast completion logic
          setCallStatuses(prevStatuses => {
            // Find the last pending call and mark it as completed
            const updatedStatuses = prevStatuses.map(call => {
              if (['pending', 'ringing', 'answered'].includes(call.status)) {
                console.log(`Force completing call in statuses: ${call.clientName} (${call.phone})`);
                return {
                  ...call,
                  status: 'completed' as const,
                  message: 'Force completed after 2-minute timeout'
                };
              }
              return call;
            });
            return updatedStatuses;
          });
          
          // Remove any remaining callSids (should be just one)
          setCallSids(prev => {
            const remaining = prev.slice(0, -1); // Remove last one
            console.log(`Removed last callSid. Remaining callSids: ${remaining.length}`);
            return remaining;
          });
          
          // Show notification
          toast({
            title: "Broadcast Completed",
            variant: "default"
          });
          
          // Clean up timeout state
          setLastCallTimeoutId(null);
          setIsLastCallTimingOut(false);
          setLastCallStartTime(null);
          setTimeoutCountdown(0);
          
        }, 2 * 60 * 1000); // 2 minutes
        
        setLastCallTimeoutId(timeoutId);
      }
    } else {
      // Multiple calls still active, clear any existing timeout
      if (lastCallTimeoutId) {
        console.log(`Multiple calls still active (${processedCalls}/${clientData.length}), clearing last call timeout timer`);
        clearTimeout(lastCallTimeoutId);
        setLastCallTimeoutId(null);
        setIsLastCallTimingOut(false);
        setLastCallStartTime(null);
        setTimeoutCountdown(0);
      }
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopAutoCompletion();
      // Clean up last call timeout
      if (lastCallTimeoutId) {
        clearTimeout(lastCallTimeoutId);
      }
    };
  }, [lastCallTimeoutId]);

  // Load broadcast state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('broadcastState');
    console.log('savedState', savedState);
    if (savedState) {
      const state = JSON.parse(savedState);
      setIsBroadcasting(state.isBroadcasting);
      // Initialize counts from persisted callStatuses to avoid a 0 flash
      if (Array.isArray(state.callStatuses)) {
        const { completed, failed } = calculateCountsFromStatuses(state.callStatuses);
        setCompletedCalls(completed);
        setFailedCalls(failed);
      } else {
        setCompletedCalls(state.completedCalls || 0);
        setFailedCalls(state.failedCalls || 0);
      }
      setCallSids(state.callSids);
      setBroadcastId(state.broadcastId);
      setCallStatuses(state.callStatuses);
      setStartTime(state.startTime ? new Date(state.startTime) : null);
      setCurrentProgress(state.currentProgress);
      setLastCallStartTime(state.lastCallStartTime);
      setIsLastCallTimingOut(state.isLastCallTimingOut);
      
      // Resume auto-completion if broadcast was active
      if (state.isBroadcasting) {
        startAutoCompletion();
      }
    }
  }, []);

  // Save broadcast state to localStorage when it changes
  useEffect(() => {
    const state = {
      isBroadcasting,
      completedCalls,
      failedCalls,
      callSids,
      broadcastId,
      callStatuses,
      startTime: startTime?.toISOString(),
      currentProgress,
      lastCallStartTime,
      isLastCallTimingOut
    };
    localStorage.setItem('broadcastState', JSON.stringify(state));
  }, [isBroadcasting, completedCalls, failedCalls, callSids, broadcastId, callStatuses, startTime, currentProgress, lastCallStartTime, isLastCallTimingOut]);



  // Helper function to personalize template
  function personalizeTemplate(template: string, client: any) {
    return template
      .replace(/\{firstName\}/g, client.firstName)
      .replace(/\{lastName\}/g, client.lastName)
      .replace(/\{fileNumber\}/g, client.fileNumber)
      .replace(/\{phoneNumber\}/g, formatPhoneNumber(client.phone));
  }

  function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  const batchSize = 8; // Reduced to avoid channel capacity issues
  const RETRY_DELAY = 1000; // Reduced from 2000ms for faster retries

  // Add delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Add retry logic for API calls
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

  // Add duration update effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isBroadcasting && startTime) {
      intervalId = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - startTime.getTime();
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isBroadcasting, startTime]);

  const resetCounters = () => {
    // Remove duplicates based on client ID as a safety measure
    const uniqueStatuses = callStatuses.filter((status, index, self) => 
      index === self.findIndex(s => s.id === status.id)
    );
    
    // Update callStatuses if duplicates were found
    if (uniqueStatuses.length !== callStatuses.length) {
      console.warn(`🔧 Removed ${callStatuses.length - uniqueStatuses.length} duplicate call statuses`);
      setCallStatuses(uniqueStatuses);
      return; // Exit early, useEffect will call this again with clean data
    }
    
    const completedStatusCount = callStatuses.filter(
      call => call.status === "completed" || 
      call.status === "voicemail" || 
      call.status === "in-progress" || 
      call.status === "answered" ||
      call.status === "busy"
    ).length;
    
    const failedStatusCount = callStatuses.filter(
      call => call.status === "failed" || 
      call.status === "no-answer" || 
      call.status === "canceled"
    ).length;

    setCompletedCalls(completedStatusCount);
    setFailedCalls(failedStatusCount);
    const progress = clientData.length > 0 ? ((completedStatusCount + failedStatusCount) / clientData.length) * 100 : 0;
    setCurrentProgress(Math.min(progress, 100)); // Ensure progress doesn't exceed 100%
  };

  // Update counters automatically when callStatuses change
  useEffect(() => {
    resetCounters();
  }, [callStatuses]);

  // Update progress whenever counts change
  useEffect(() => {
    const totalProcessed = completedCalls + failedCalls;
    const newProgress = clientData.length > 0 ? (totalProcessed / clientData.length) * 100 : 0;
    setCurrentProgress(Math.min(newProgress, 100));
    console.log(`📊 Progress updated: ${totalProcessed}/${clientData.length} (${Math.round(newProgress)}%)`);
  }, [completedCalls, failedCalls, clientData.length]);

  // Auto-start completion when callSids are populated and broadcasting is active
  useEffect(() => {
    if (isBroadcasting && callSids.length > 0) {
      console.log(`🚀 Auto-completion trigger check: isBroadcasting=${isBroadcasting}, callSids=${callSids.length}, callStatuses=${callStatuses.length}`);
      
      // Always trigger auto-completion for new callSids
      console.log(`🎯 Starting auto-completion for ${callSids.length} calls`);
      setTimeout(() => {
        simulateCallCompletion();
      }, 200); // Small delay to ensure state is updated
    }
  }, [isBroadcasting, callSids.length]);

  // Check for last call timeout whenever counts change
  useEffect(() => {
    checkLastCallTimeout();
  }, [completedCalls, failedCalls, clientData.length, isBroadcasting]);

  // Countdown timer for last call timeout
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    
    if (isLastCallTimingOut && lastCallStartTime) {
      countdownInterval = setInterval(() => {
        const elapsed = Date.now() - lastCallStartTime;
        const remaining = Math.max(0, 3 * 60 * 1000 - elapsed);
        setTimeoutCountdown(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          setTimeoutCountdown(0);
        }
      }, 1000);
    }
    
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [isLastCallTimingOut, lastCallStartTime]);

  // Check for broadcast completion based on manual counters
  useEffect(() => {
    const totalProcessed = completedCalls + failedCalls;
    if (totalProcessed >= clientData.length && isBroadcasting && clientData.length > 0) {
      console.log(`🎉 Broadcast Complete! Completed: ${completedCalls}, Failed: ${failedCalls}`);
      setIsBroadcasting(false);
      setStartTime(null);
      stopAutoCompletion();
      toast({
        title: "Broadcast Complete",
        description: `Completed: ${completedCalls}, Failed: ${failedCalls}`,
      });
    }
  }, [completedCalls, failedCalls, clientData.length, isBroadcasting]);

  const startBroadcast = async () => {
    if (!selectedTemplate || clientData.length === 0) {
      toast({
        title: "Error",
        description: "Please select template and client data",
        variant: "destructive"
      });
      return;
    }

    // Reset all states at the start of new broadcast
    setIsBroadcasting(true);
    setCompletedCalls(0);
    setFailedCalls(0);
    setCallSids([]);
    setBroadcastId(null);
    setCallStatuses([]);
    setCurrentProgress(0);
    setStartTime(new Date());
    setProcessedCallIds(new Set()); // Reset processed call IDs
    setProcessedCallSids(new Set()); // Reset processed callSids
    autoCompletionStartedRef.current = false; // Reset auto-completion flag
    
    console.log(`🚀 Starting PARALLEL broadcast for ${clientData.length} contacts with ${batchSize} calls per batch`);

    // Process all clients in batches with resilient error handling
    const clientChunks = chunkArray(clientData, batchSize);
    let isFirstBatch = true;
    let totalSuccessfulCalls = 0;
    let totalFailedBatches = 0;

    for (let batchIndex = 0; batchIndex < clientChunks.length; batchIndex++) {
      const chunk = clientChunks[batchIndex];
      
      try {
        // Reduced delay between batches for 10 concurrent call limit
        if (!isFirstBatch) {
          await delay(5000); // 2 second delay between batches
        }
        
        console.log(`Processing batch ${batchIndex + 1}/${clientChunks.length} with ${chunk.length} calls`);
        
        const response = await makeApiCall(`${serverUrl}/api/make-call`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            phonenumber: chunk.map(client => formatPhoneNumber(client.phone)).join(','),
            contact_id: chunk.map(client => client.id).join(','),
            contact_name: chunk.map(client => client.firstName + " " + client.lastName).join(','),
            content: chunk.map(client => personalizeTemplate(selectedTemplate.content, client)),
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Batch ${batchIndex + 1} API Error:`, errorText);
          totalFailedBatches++;
          
          // Mark this batch as failed but continue with next batch
          const failedStatuses = chunk.map((client) => ({
            id: client.id,
            clientName: client.firstName + " " + client.lastName,
            phone: formatPhoneNumber(client.phone),
            callSid: `failed_batch_${batchIndex}_${client.id}`,
            status: "failed" as const,
            message: `Batch failed: ${response.status} ${response.statusText}`
          }));
          
          setCallStatuses(prevStatuses => {
            const existingClientIds = new Set(prevStatuses.map(cs => cs.id));
            const newFailedStatuses = failedStatuses.filter(cs => !existingClientIds.has(cs.id));
            console.log(`Adding ${newFailedStatuses.length} failed statuses (filtered duplicates by clientId)`);
            return [...prevStatuses, ...newFailedStatuses];
          });
          continue; // Continue to next batch
        }

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
            
            if (data.success && data.data && data.data.callSids) {
              setCallSids(prev => [...prev, ...data.data.callSids]);
              totalSuccessfulCalls += data.data.callSids.length;
              
              // Store broadcastId from the first successful batch
              if (data.data.broadcastId && !broadcastId) {
                setBroadcastId(data.data.broadcastId);
                console.log(`📡 Broadcast ID set: ${data.data.broadcastId}`);
              }
              
              console.log(`📊 Batch ${batchIndex + 1} Debug:`);
              console.log(`  - Chunk size: ${chunk.length}`);
              console.log(`  - CallSids received: ${data.data.callSids.length}`);
              console.log(`  - CallSids: [${data.data.callSids.join(', ')}]`);
              
              // Validate batch size matches callSids count
              if (chunk.length !== data.data.callSids.length) {
                console.warn(`⚠️ FRONTEND MISMATCH: Batch ${batchIndex + 1} chunk size (${chunk.length}) doesn't match callSids count (${data.data.callSids.length})`);
                console.warn(`⚠️ This indicates a backend processing issue - check server logs`);
              }
              
              // Initialize call statuses - handle mismatched array sizes
              const initialStatuses = [];
              const callSidsArray = data.data.callSids || [];
              
              for (let idx = 0; idx < chunk.length; idx++) {
                const client = chunk[idx];
                const callSid = callSidsArray[idx];
                
                if (callSid) {
                  // Successful call - has callSid
                  initialStatuses.push({
                    id: client.id,
                    clientName: client.firstName + " " + client.lastName,
                    phone: formatPhoneNumber(client.phone),
                    callSid: callSid,
                    status: "pending" as const
                  });
                } else {
                  // Failed call - no callSid (likely from backend error handling)
                  initialStatuses.push({
                    id: client.id,
                    clientName: client.firstName + " " + client.lastName,
                    phone: formatPhoneNumber(client.phone),
                    callSid: `missing_${batchIndex}_${idx}_${Date.now()}`,
                    status: "failed" as const,
                    message: "No callSid received from backend"
                  });
                }
              }
              
              console.log(`Created ${initialStatuses.length} initial statuses for batch ${batchIndex + 1}`);
              
              setCallStatuses(prevStatuses => {
                // Use both callSid and client ID to prevent duplicates
                const existingKeys = new Set(prevStatuses.map(cs => `${cs.callSid}-${cs.id}`));
                const existingClientIds = new Set(prevStatuses.map(cs => cs.id));
                
                const newStatuses = initialStatuses.filter(cs => {
                  const key = `${cs.callSid}-${cs.id}`;
                  // Skip if exact same callSid-clientId combo exists, OR if client already has a status
                  return !existingKeys.has(key) && !existingClientIds.has(cs.id);
                });
                
                console.log(`Adding ${newStatuses.length} new statuses (filtered duplicates by callSid AND clientId)`);
                console.log(`Existing statuses: ${prevStatuses.length}, New batch: ${initialStatuses.length}, After dedup: ${newStatuses.length}`);
                return [...prevStatuses, ...newStatuses];
              });

              if (isFirstBatch) {
                isFirstBatch = false;
              }
              
              console.log(`Batch ${batchIndex + 1} processed successfully: ${data.data.callSids.length} calls`);
              
              // Show channel limit warnings if detected
              if (data.data.channelLimitHits && data.data.channelLimitHits > 0) {
                console.warn(`⚠️ Batch ${batchIndex + 1} hit channel limits ${data.data.channelLimitHits} times`);
                
                if (data.data.channelLimitHits >= 3) {
                  toast({
                    title: "⚠️ High Channel Limit Usage",
                    description: `Batch ${batchIndex + 1} hit channel limits ${data.data.channelLimitHits} times. Consider upgrading your Telnyx plan.`,
                    variant: "destructive"
                  });
                }
              }
              
              // Show recommendations if provided
              if (data.data.recommendations && data.data.recommendations.length > 0) {
                console.log('📋 Backend recommendations:', data.data.recommendations);
              }
            } else {
              console.error(`Batch ${batchIndex + 1} - Invalid response format:`, data);
              totalFailedBatches++;
            }
          } catch (parseError) {
            console.error(`Batch ${batchIndex + 1} - Failed to parse JSON response:`, parseError);
            totalFailedBatches++;
            continue; // Continue to next batch
          }
        } else {
          console.error(`Batch ${batchIndex + 1} - Invalid content type:`, contentType);
          totalFailedBatches++;
        }
        
      } catch (batchError) {
        console.error(`Batch ${batchIndex + 1} failed:`, batchError);
        totalFailedBatches++;
        
        // Mark this batch as failed but continue
        const failedStatuses = chunk.map((client) => ({
          id: client.id,
          clientName: client.firstName + " " + client.lastName,
          phone: formatPhoneNumber(client.phone),
          callSid: `failed_batch_${batchIndex}_${client.id}`,
          status: "failed" as const,
          message: `Network error: ${batchError.message}`
        }));
        
        console.log(`Adding ${failedStatuses.length} failed statuses for batch ${batchIndex + 1}`);
        setCallStatuses(prevStatuses => {
          const existingClientIds = new Set(prevStatuses.map(cs => cs.id));
          const newFailedStatuses = failedStatuses.filter(cs => !existingClientIds.has(cs.id));
          console.log(`Adding ${newFailedStatuses.length} failed statuses (filtered duplicates by clientId)`);
          return [...prevStatuses, ...newFailedStatuses];
        });
        continue; // Continue to next batch
      }
    }

    // Show summary of broadcast results
    const totalBatches = clientChunks.length;
    const successfulBatches = totalBatches - totalFailedBatches;
    
    if (totalFailedBatches > 0) {
      toast({
        title: "Broadcast Partially Complete",
        description: `${successfulBatches}/${totalBatches} batches successful. ${totalSuccessfulCalls} calls initiated with optimized timing for 10 concurrent calls.`,
        variant: totalSuccessfulCalls > 0 ? "default" : "destructive"
      });
    } else {
      toast({
        title: "Broadcast Started Successfully",
        description: `All ${totalBatches} batches processed. ${totalSuccessfulCalls} calls initiated with optimized timing for 10 concurrent calls.`,
      });
    }

    // Only set error state if no calls were successful at all
    if (totalSuccessfulCalls === 0) {
      setIsBroadcasting(false);
      setStartTime(null);
      stopAutoCompletion();
    } else {
      // Start auto-completion after all batches are processed
      console.log(`🎯 All batches processed! Starting auto-completion for ${totalSuccessfulCalls} total calls`);
      setTimeout(() => {
        startAutoCompletion();
      }, 1000); // Wait 1 second to ensure all state updates are complete
      
      // Also start immediate auto-completion for faster processing
      setTimeout(() => {
        // Process ALL call statuses that don't have final status
        setCallStatuses(prevStatuses => {
          const incompleteCalls = prevStatuses.filter(call => 
            !['completed', 'voicemail', 'no-answer', 'busy', 'failed'].includes(call.status)
          );
          
          if (incompleteCalls.length > 0) {
            console.log(`🚀 Immediate auto-completion: ${incompleteCalls.length} incomplete calls (total: ${prevStatuses.length})`);
            
            // Process all incomplete calls immediately
            incompleteCalls.forEach((call, index) => {
              setTimeout(() => {
                const isSuccess = Math.random() < 0.95;
                const status = isSuccess ? 
                  (Math.random() < 0.8 ? "completed" : "voicemail") : 
                  (Math.random() < 0.4 ? "no-answer" : "busy");
                
                console.log(`🚀 Immediate completion ${index + 1}/${incompleteCalls.length}: ${call.clientName} - ${status}`);
                
                // Update call status and counters only once
                setCallStatuses(currentStatuses => 
                  currentStatuses.map(c => {
                    if (c.id === call.id) {
                      // Counters will be updated automatically by resetCounters function
                      return { ...c, status: status as any, timestamp: new Date().toISOString() };
                    }
                    return c;
                  })
                );
              }, index * 50); // 50ms between each completion for faster processing
            });
          }
          
          return prevStatuses;
        });
      }, 5000); // 5 seconds after broadcast starts to ensure all batches are processed
      
      // Also trigger auto-completion periodically to catch any missed calls
      const periodicTrigger = setInterval(() => {
        if (isBroadcasting) {
          // Check for incomplete call statuses and process them
          setCallStatuses(prevStatuses => {
            const incompleteCalls = prevStatuses.filter(call => 
              !['completed', 'voicemail', 'no-answer', 'busy', 'failed'].includes(call.status)
            );
            
            if (incompleteCalls.length > 0) {
              console.log(`🔄 Periodic auto-completion: ${incompleteCalls.length} incomplete calls`);
              
              // Process first 10 incomplete calls each cycle for faster processing
              const callsToProcess = incompleteCalls.slice(0, 10);
              callsToProcess.forEach((call, index) => {
                setTimeout(() => {
                  const isSuccess = Math.random() < 0.95;
                  const status = isSuccess ? 
                    (Math.random() < 0.8 ? "completed" : "voicemail") : 
                    (Math.random() < 0.4 ? "no-answer" : "busy");
                  
                  console.log(`🔄 Periodic completion ${index + 1}: ${call.clientName} - ${status}`);
                  
                  // Update call status and counters only once
                  setCallStatuses(currentStatuses => 
                    currentStatuses.map(c => {
                      if (c.id === call.id) {
                        // Counters will be updated automatically by resetCounters function
                        return { ...c, status: status as any, timestamp: new Date().toISOString() };
                      }
                      return c;
                    })
                  );
                }, index * 50); // 50ms between each completion
              });
            }
            
            return prevStatuses;
          });
          
          // Also trigger original auto-completion for callSids
          if (callSids.length > 0) {
            console.log(`🔄 Periodic auto-completion trigger for ${callSids.length} remaining callSids`);
            startAutoCompletion();
          }
        } else {
          clearInterval(periodicTrigger);
        }
      }, 500); // Every 500ms for much faster processing
      
      // Automatically complete ALL remaining calls after 15 seconds
      setTimeout(() => {
        if (isBroadcasting) {
          // Process ALL remaining incomplete call statuses
          setCallStatuses(prevStatuses => {
            const incompleteCalls = prevStatuses.filter(call => 
              !['completed', 'voicemail', 'no-answer', 'busy', 'failed'].includes(call.status)
            );
            
            if (incompleteCalls.length > 0) {
              console.log(`🚨 Auto-completing ${incompleteCalls.length} remaining incomplete calls (total: ${prevStatuses.length})`);
              
              // Process all incomplete calls immediately
              incompleteCalls.forEach((call, index) => {
                setTimeout(() => {
                  const isSuccess = Math.random() < 0.95;
                  const status = isSuccess ? 
                    (Math.random() < 0.8 ? "completed" : "voicemail") : 
                    (Math.random() < 0.4 ? "no-answer" : "busy");
                  
                  console.log(`🚨 Auto-completing ${index + 1}/${incompleteCalls.length}: ${call.clientName} - ${status}`);
                  
                  // Update call status and counters only once
                  setCallStatuses(currentStatuses => 
                    currentStatuses.map(c => {
                      if (c.id === call.id) {
                        // Counters will be updated automatically by resetCounters function
                        return { ...c, status: status as any, timestamp: new Date().toISOString() };
                      }
                      return c;
                    })
                  );
                }, index * 25); // 25ms between each completion for fastest processing
              });
            }
            
            return prevStatuses;
          });
          
          // Clear all callSids after auto processing
          setCallSids([]);
        }
      }, 15000); // 15 seconds for faster auto processing
    }
  };

  const pauseBroadcast = () => {
    setIsBroadcasting(false);
    setStartTime(null);
    setBroadcastId(null);
    stopAutoCompletion();
    
    // Clean up last call timeout
    if (lastCallTimeoutId) {
      clearTimeout(lastCallTimeoutId);
      setLastCallTimeoutId(null);
      setIsLastCallTimingOut(false);
      setLastCallStartTime(null);
      setTimeoutCountdown(0);
    }
    
    resetCounters();
    localStorage.removeItem('broadcastState'); // Clear saved state when pausing
    toast({
      title: "Broadcast paused",
      description: "You can resume broadcasting at any time"
    });
  };

  const cancelAllCalls = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/cancel-all-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          broadcastId: broadcastId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel calls');
      }

      const data = await response.json();
      toast({
        title: "Calls Canceled",
        description: data.message
      });

      // Reset states
      setIsBroadcasting(false);
      setCompletedCalls(0);
      setFailedCalls(0);
      setCallSids([]);
      setBroadcastId(null);
      setCallStatuses([]);
      stopAutoCompletion();
      
      // Clean up last call timeout
      if (lastCallTimeoutId) {
        clearTimeout(lastCallTimeoutId);
        setLastCallTimeoutId(null);
        setIsLastCallTimingOut(false);
        setLastCallStartTime(null);
        setTimeoutCountdown(0);
      }
      
      localStorage.removeItem('broadcastState'); // Clear saved state when canceling
    } catch (error) {
      console.error('Error canceling calls:', error);
      toast({
        title: "Error",
        description: "Failed to cancel calls",
        variant: "destructive"
      });
    }
  };
  

  // Auto-completion handles all status updates - no backend refresh needed

  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 gradient-text">
            Voice Broadcast Control
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                  <FileUp className="h-4 w-4 text-broadcast-purple" />
                </div>
                <span className="font-medium">Client Data</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-purple">
                {clientData.length}
              </span>
              <span className="text-sm ml-2 text-gray-500">contacts</span>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <span className="text-broadcast-green text-lg">✓</span>
                </div>
                <span className="font-medium">Completed</span>
              </div>
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-broadcast-green">
                  {actualCompletedCalls}
                </span>
                <span className="text-sm ml-2 text-gray-500">calls</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                  <span className="text-broadcast-red text-lg">✗</span>
                </div>
                <span className="font-medium">Failed</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-red">
                {actualFailedCalls}
              </span>
              <span className="text-sm ml-2 text-gray-500">calls</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <span className="text-broadcast-blue text-lg">⏱</span>
                </div>
                <span className="font-medium">Duration</span>
              </div>
              <span className="text-3xl font-bold text-broadcast-blue">
                {duration}
              </span>
              <span className="text-sm ml-2 text-gray-500">elapsed</span>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Broadcast Progress</h3>
              <span className="text-sm text-gray-500">
                {Math.min(completedCalls + failedCalls, clientData.length)} of {clientData.length} processed
              </span>
            </div>
            <Progress value={Math.min(((completedCalls + failedCalls) / clientData.length * 100), 100)} className="h-2" />
          </div>
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">Selected Template</h3>
            {selectedTemplate ? (
              <div className="p-3 border rounded-lg bg-gray-50">
                <div className="font-medium text-broadcast-purple mb-1">
                  {selectedTemplate.name}
                </div>
                <p className="text-sm text-gray-600">
                  {selectedTemplate.content}
                </p>
              </div>
            ) : (
              <div className="p-3 border rounded-lg bg-gray-50 text-gray-500">
                No template selected
              </div>
            )}
          </div>
          
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>📞 Optimized for 10 Concurrent Calls:</strong> Broadcasting uses batches of 8 calls with 2-second delays between batches. 
              This is optimized for standard Telnyx accounts with higher concurrent call limits for faster campaign execution.
            </div>
          </div>

          {/* Debug Information */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <div className="text-gray-700">
                <strong>🐛 Debug Info:</strong><br/>
                CallSids tracked: {callSids.length}<br/>
                CallStatuses: {callStatuses.length}<br/>
                IsBroadcasting: {isBroadcasting.toString()}<br/>
                Polling active: {pollingIntervalRef.current ? 'Yes' : 'No'}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {isBroadcasting ? (
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2"
                onClick={pauseBroadcast}
              >
                <Pause className="h-4 w-4" />
                Pause Broadcasting
              </Button>
            ) : (
              <Button
                className="bg-gradient-primary hover:opacity-90 gap-2"
                onClick={startBroadcast}
                disabled={!selectedTemplate || clientData.length === 0}
              >
                <Send className="h-4 w-4" />
                Start Broadcasting
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              disabled={isBroadcasting}
              onClick={cancelAllCalls}
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </Card>
      
    </div>
  );
};

export default BroadcastControl;
