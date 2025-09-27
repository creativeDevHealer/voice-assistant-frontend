import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CalendarClock, Plus, Trash2, X, Upload, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import TemplateManager from "./TemplateManager";
import { db } from "@/firebase/firebaseConfig"
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc, getDocs, deleteDoc, query, onSnapshot } from "firebase/firestore";
import BroadcastScheduler from "./BroadcastScheduler";

interface DataSet {
  id: string;
  name: string;
  data: any[];
  fileName: string;
  uploadDate: Date;
}

interface ScheduledBroadcast {
  id: string;
  date: Date;
  time: string;
  template: string;
  templateName?: string;
  status: "scheduled" | "completed" | "cancelled" | "in-progress";
  clientCount: number;
  dataSetId: string;
  callSids?: string[];
  completedCalls?: number;
  failedCalls?: number;
  lastUpdated?: Date;
  completedAt?: Date;
  startedAt?: Date; // Actual start time when broadcast begins
  createdAt: Date;
}

interface BroadcastScheduleItem {
  id: string;
  date: Date | undefined;
  time: string;
  selectedDataSetId: string | null;
  selectedTemplate: Template | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  isDefault?: boolean;
}

const ScheduleBroadcasts: React.FC = () => {
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [scheduleItems, setScheduleItems] = useState<BroadcastScheduleItem[]>(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Round up to next 5-minute interval
    const roundedMinute = Math.ceil(currentMinute / 5) * 5;
    let timeString;
    
    if (roundedMinute >= 60) {
      // If rounded minute is 60 or more, move to next hour
      timeString = `${(currentHour + 1).toString().padStart(2, '0')}:00`;
    } else {
      timeString = `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
    }
    
    return [{
      id: '1',
      date: new Date(),
      time: timeString,
      selectedDataSetId: null,
      selectedTemplate: null
    }];
  });
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<ScheduledBroadcast[]>(() => {
    const saved = localStorage.getItem('scheduledBroadcasts');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  const serverUrl = 'http://35.88.71.8:5000';

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Save scheduledBroadcasts to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('scheduledBroadcasts', JSON.stringify(scheduledBroadcasts));
  }, [scheduledBroadcasts]);

  // Load dataSets from localStorage on mount
  useEffect(() => {
    const savedDataSets = localStorage.getItem('dataSets');
    if (savedDataSets) {
      setDataSets(JSON.parse(savedDataSets));
    }
  }, []);

  // Save dataSets to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dataSets', JSON.stringify(dataSets));
  }, [dataSets]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newDataSet: DataSet = {
          id: Date.now().toString(),
          name: file.name.split('.')[0],
          data: jsonData,
          fileName: file.name,
          uploadDate: new Date()
        };

        setDataSets(prev => [...prev, newDataSet]);
        toast({
          title: "Dataset Uploaded",
          description: `Successfully uploaded ${file.name} with ${jsonData.length} records`
        });
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    }
  };

  // Generate time slots for the select component
  const generateTimeSlots = (selectedDate?: Date) => {
    const slots = [];
    const now = new Date();
    const isToday = selectedDate && 
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();
    
    // Generate all time slots in chronological order with 5-minute precision
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        // Skip past time slots if it's today
        if (isToday) {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          if (hour < currentHour || (hour === currentHour && minute <= currentMinute)) {
            continue; // Skip past time slots
          }
        }
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }

    return slots; // Return in chronological order, excluding past times for today
  };

  const getClosestTimeSlot = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Round up to next 5-minute interval
    const roundedMinute = Math.ceil(currentMinute / 5) * 5;
    
    if (roundedMinute >= 60) {
      // If rounded minute is 60 or more, move to next hour
      return `${(currentHour + 1).toString().padStart(2, '0')}:00`;
    }
    
    return `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
  };

  const handleAddScheduleItem = () => {
    setScheduleItems(prev => [...prev, {
      id: Date.now().toString(),
      date: new Date(),
      time: getClosestTimeSlot(),
      selectedDataSetId: null,
      selectedTemplate: null
    }]);
  };

  // Initial schedule item now uses current time from state initialization

  const handleRemoveScheduleItem = (id: string) => {
    setScheduleItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateScheduleItem = (id: string, updates: Partial<BroadcastScheduleItem>) => {
    setScheduleItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updatedItem = { ...item, ...updates };
      
      // If date is being updated to today, check if selected time is in the past
      if (updates.date) {
        const now = new Date();
        const isToday = updates.date.getDate() === now.getDate() &&
          updates.date.getMonth() === now.getMonth() &&
          updates.date.getFullYear() === now.getFullYear();
        
        if (isToday && updatedItem.time) {
          const [hour, minute] = updatedItem.time.split(':').map(Number);
          const selectedTime = hour * 60 + minute;
          const currentTime = now.getHours() * 60 + now.getMinutes();
          
          // If selected time is in the past, update to next available time
          if (selectedTime <= currentTime) {
            updatedItem.time = getClosestTimeSlot();
          }
        }
      }
      
      return updatedItem;
    }));
  };

  const handleScheduleBroadcast = async () => {
    const invalidItems = scheduleItems.filter(item => 
      !item.date || !item.time || !item.selectedTemplate || !item.selectedDataSetId
    );

    if (invalidItems.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields for each schedule",
        variant: "destructive"
      });
      return;
    }

    try {
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      
      // Save each schedule to Firebase
      for (const item of scheduleItems) {
        const dataSet = dataSets.find(d => d.id === item.selectedDataSetId);
        
        const docRef = await addDoc(broadcastsRef, {
          date: Timestamp.fromDate(item.date!),
          time: item.time,
          template: item.selectedTemplate?.content,
          templateName: item.selectedTemplate?.name || "Unknown",
          status: "scheduled",
          clientCount: dataSet?.data.length || 0,
          dataSetId: item.selectedDataSetId,
          createdAt: Timestamp.now()
        });

        console.log(`✅ Broadcast scheduled with ID: ${docRef.id}`);
      }

      // Don't manually update local state - let the real-time listener handle it
      toast({
        title: "Broadcasts Scheduled",
        description: `Successfully scheduled ${scheduleItems.length} broadcasts`
      });

      // Reset form
      setScheduleItems([{
        id: Date.now().toString(),
        date: new Date(),
        time: getClosestTimeSlot(),
        selectedDataSetId: null,
        selectedTemplate: null
      }]);
    } catch (error) {
      console.error('Error scheduling broadcasts:', error);
      toast({
        title: "Error",
        description: "Failed to schedule broadcasts. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load scheduled broadcasts on component mount
  useEffect(() => {
    const broadcastsRef = collection(db, 'scheduledBroadcasts');
    const q = query(broadcastsRef);

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Create a Map to handle duplicates (keep the latest version)
      const broadcastMap = new Map();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.date instanceof Date ? data.date : data.date.toDate();
        broadcastMap.set(doc.id, {
          id: doc.id,
          date: date,
          time: data.time,
          template: data.template || data.templateName || "Unknown Template", // Use template content for display
          status: data.status,
          clientCount: data.clientCount,
          dataSetId: data.dataSetId,
          callSids: data.callSids,
          completedCalls: data.completedCalls,
          failedCalls: data.failedCalls,
          startedAt: data.startedAt, // Include startedAt field
          lastUpdated: data.lastUpdated?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });

      // Convert Map to array and sort by date and time
      const broadcasts = Array.from(broadcastMap.values()).sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        if (dateA.getTime() === dateB.getTime()) {
          return a.time.localeCompare(b.time);
        }
        return dateA.getTime() - dateB.getTime();
      });

      setScheduledBroadcasts(broadcasts);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const handleCancelSchedule = async (id: string) => {
    try {
      // First check if the document exists
      const broadcastRef = doc(db, 'scheduledBroadcasts', id);
      const broadcastDoc = await getDoc(broadcastRef);
      
      if (!broadcastDoc.exists()) {
        toast({
          title: "Error",
          description: "Broadcast not found. It may have been already cancelled or deleted.",
          variant: "destructive"
        });
        return;
      }

      await updateDoc(broadcastRef, {
        status: "cancelled",
        cancelledAt: Timestamp.now()
      });

      setScheduledBroadcasts(prev =>
        prev.map(schedule =>
          schedule.id === id ? { ...schedule, status: "cancelled" } : schedule
        )
      );

      toast({
        title: "Schedule Cancelled",
        description: "The scheduled broadcast has been cancelled"
      });
    } catch (error) {
      console.error('Error cancelling broadcast:', error);
      toast({
        title: "Error",
        description: "Failed to cancel broadcast. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Add function to remove all scheduled broadcasts
  const handleRemoveAllSchedules = async () => {
    try {
      const broadcastsRef = collection(db, 'scheduledBroadcasts');
      const querySnapshot = await getDocs(broadcastsRef);
      
      // Delete all documents
      const deletePromises = querySnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);

      // Clear local state
      setScheduledBroadcasts([]);

      toast({
        title: "All Schedules Removed",
        description: "All broadcasts have been removed from the dashboard"
      });
    } catch (error) {
      console.error('Error removing all broadcasts:', error);
      toast({
        title: "Error",
        description: "Failed to remove broadcasts. Please try again.",
        variant: "destructive"
      });
    }
  };


  const handleRemoveDataset = (datasetId: string) => {
    // Remove from state
    setDataSets(prev => prev.filter(ds => ds.id !== datasetId));
    
    // Remove from localStorage
    const savedDataSets = localStorage.getItem('dataSets');
    if (savedDataSets) {
      const dataSets = JSON.parse(savedDataSets);
      const updatedDataSets = dataSets.filter((ds: DataSet) => ds.id !== datasetId);
      localStorage.setItem('dataSets', JSON.stringify(updatedDataSets));
    }

    localStorage.removeItem('dataSets');

    // Remove from scheduledBroadcasts
    localStorage.removeItem('scheduledBroadcasts');
    toast({
      title: "Dataset Removed",
      description: "The dataset has been removed successfully"
    });
  };

  return (
    <>
      <BroadcastScheduler />
      <Card className="dashboard-card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold gradient-text">
              Schedule Multiple Broadcasts
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-lg font-medium text-gray-600">
                Current Time: {currentTime.toLocaleTimeString('en-US', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
              {scheduledBroadcasts.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveAllSchedules}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove All Schedules
                </Button>
              )}
            </div>
          </div>

          {/* Dataset Upload Section */}
          <div className="mb-8">
            <h3 className="font-medium mb-4">Upload Client Datasets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload dataset</span>
                  <span className="text-xs text-gray-400 mt-1">Excel or CSV files</span>
                </label>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Uploaded Datasets</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dataSets.map(dataset => (
                    <div key={dataset.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center">
                        <FileSpreadsheet className="w-4 h-4 text-gray-500 mr-2" />
                        <div>
                          <p className="text-sm font-medium">{dataset.name}</p>
                          <p className="text-xs text-gray-500">{dataset.data.length} records</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {format(dataset.uploadDate, 'PP')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDataset(dataset.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {dataSets.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No datasets uploaded yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Items */}
          <div className="space-y-6 mb-6">
            {scheduleItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4 relative">
                {scheduleItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleRemoveScheduleItem(item.id)}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-3">Schedule {index + 1}</h3>
                    <div className="space-y-4">
                      <div className="border rounded-lg p-3 bg-white shadow-sm flex justify-center">
                        <Calendar
                          mode="single"
                          selected={item.date}
                          onSelect={(date) => handleUpdateScheduleItem(item.id, { date })}
                          className="w-fit mx-auto"
                          classNames={{
                            months: "flex flex-col space-y-3",
                            month: "space-y-3",
                            caption: "flex justify-center relative items-center pb-2",
                            caption_label: "text-base font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-gray-100 rounded-md",
                            nav_button_previous: "absolute left-0",
                            nav_button_next: "absolute right-0",
                            table: "w-full border-collapse",
                            head_row: "flex mb-1",
                            head_cell: "text-gray-500 rounded-md w-8 h-8 font-medium text-xs flex items-center justify-center",
                            row: "flex w-full",
                            cell: "h-8 w-8 text-center text-sm p-0 relative hover:bg-gray-50 rounded-md",
                            day: "h-8 w-8 p-0 font-normal hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center text-sm",
                            day_selected: "bg-blue-600 text-white hover:bg-blue-700 font-medium",
                            day_today: "bg-gray-100 font-medium",
                            day_outside: "text-gray-300",
                            day_disabled: "text-gray-300 cursor-not-allowed",
                          }}
                          disabled={(date) => {
                            const now = new Date();
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            return date < today;
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="space-y-2">
                          <Select
                            value={item.time}
                            onValueChange={(time) => handleUpdateScheduleItem(item.id, { time })}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[400px] w-[240px]">
                              <div className="p-2">
                                <div className="text-xs text-gray-500 mb-2 font-medium">Select Time (24-hour format)</div>
                                <div className="max-h-[320px] overflow-y-auto">
                                  {generateTimeSlots(item.date).map((time) => (
                                    <SelectItem 
                                      key={time} 
                                      value={time}
                                      className="text-sm py-1.5 px-2 hover:bg-gray-100 rounded cursor-pointer"
                                    >
                                      <span className="font-mono">{time}</span>
                                    </SelectItem>
                                  ))}
                                </div>
                              </div>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Select Dataset</h4>
                      <Select
                        value={item.selectedDataSetId || ""}
                        onValueChange={(dataSetId) => handleUpdateScheduleItem(item.id, { selectedDataSetId: dataSetId })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a dataset" />
                        </SelectTrigger>
                        <SelectContent>
                          {dataSets.map((dataset) => (
                            <SelectItem key={dataset.id} value={dataset.id}>
                              {dataset.name} ({dataset.data.length} contacts)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Select Template</h4>
                      <TemplateManager
                        selectedTemplate={item.selectedTemplate}
                        onTemplateSelected={(template) => handleUpdateScheduleItem(item.id, { selectedTemplate: template })}
                      />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Selected Details:</h4>
                      <div className="text-sm text-gray-600">
                        <p>Date: {item.date ? format(item.date, 'PPP') : 'Not selected'}</p>
                        <p>Time: {item.time}</p>
                        <p>Dataset: {dataSets.find(d => d.id === item.selectedDataSetId)?.name || 'Not selected'}</p>
                        <p>Template: {item.selectedTemplate?.name || 'Not selected'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddScheduleItem}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Schedule
            </Button>
          </div>

          <div className="flex gap-4 mb-6">
            <Button
              className="flex-1 md:flex-none"
              onClick={handleScheduleBroadcast}
              disabled={scheduleItems.length === 0 || dataSets.length === 0}
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              Schedule All Broadcasts
            </Button>
          </div>

          {/* Scheduled Broadcasts Table */}
          <div>
            <h3 className="font-medium mb-3">Scheduled Broadcasts</h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledBroadcasts.length > 0 ? (
                    scheduledBroadcasts.map((schedule) => {
                      const date = schedule.date instanceof Date ? schedule.date : new Date(schedule.date);
                      const createdAt = schedule.createdAt instanceof Date ? schedule.createdAt : new Date();
                      return (
                        <TableRow key={`${schedule.id}-${date.getTime()}-${schedule.time}-${createdAt.getTime()}`}>
                          <TableCell>
                            <div className="font-medium">
                              {format(date, 'PPP')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(date, 'EEEE')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-lg font-semibold text-blue-600">
                              {schedule.time}
                            </div>
                            <div className="text-sm text-gray-500">
                              {schedule.time && schedule.time.includes(':') ? 
                                (() => {
                                  const [hours, minutes] = schedule.time.split(':').map(Number);
                                  const dateTime = new Date(date);
                                  dateTime.setHours(hours, minutes, 0);
                                  const now = currentTime;
                                  const diff = dateTime.getTime() - now.getTime();
                                  if (diff > 0) {
                                    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
                                    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    if (hoursLeft > 0) {
                                      return `${hoursLeft}h ${minutesLeft}m left`;
                                    } else {
                                      return `${minutesLeft}m left`;
                                    }
                                  } else {
                                    return 'Past due';
                                  }
                                })() : ''
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {dataSets.find(d => d.id === schedule.dataSetId)?.name || 'Unknown Dataset'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {schedule.dataSetId}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={schedule.template}>
                              <div className="font-medium text-sm">
                                {schedule.templateName || 'Template'}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {schedule.template}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-lg">
                              {schedule.clientCount}
                            </div>
                            <div className="text-sm text-gray-500">
                              contacts
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              schedule.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                              schedule.status === "completed" ? "bg-green-100 text-green-800" :
                              schedule.status === "in-progress" ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-green-600 font-medium">
                                ✓ {schedule.completedCalls || 0}
                              </div>
                              <div className="text-red-600 font-medium">
                                ✗ {schedule.failedCalls || 0}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              // Calculate duration based on status
                              if (schedule.status === 'completed') {
                                // For completed broadcasts, try multiple timestamp sources
                                let endTime = null;
                                
                                // Try completedAt first
                                if (schedule.completedAt) {
                                  endTime = schedule.completedAt instanceof Date ? schedule.completedAt : new Date(schedule.completedAt);
                                }
                                
                                // Fall back to lastUpdated if completedAt is not available or invalid
                                if (!endTime || endTime.getTime() <= 0) {
                                  if (schedule.lastUpdated) {
                                    endTime = schedule.lastUpdated instanceof Date ? schedule.lastUpdated : new Date(schedule.lastUpdated);
                                  }
                                }
                                
                                // Fall back to createdAt if nothing else works
                                if (!endTime || endTime.getTime() <= 0) {
                                  if (schedule.createdAt) {
                                    endTime = schedule.createdAt instanceof Date ? schedule.createdAt : new Date(schedule.createdAt);
                                    // Add a small duration (30 seconds) as fallback
                                    endTime = new Date(endTime.getTime() + 30000);
                                  }
                                }
                                
                                if (endTime && endTime.getTime() > 0) {
                                  // Calculate start time (use actual start time if available, otherwise scheduled time)
                                  let startTime = null;
                                  
                                  // Use startedAt if available (actual start time)
                                  if (schedule.startedAt) {
                                    // Handle Firebase Timestamp properly
                                    if (schedule.startedAt && typeof schedule.startedAt.toDate === 'function') {
                                      startTime = schedule.startedAt.toDate();
                                    } else if (schedule.startedAt instanceof Date) {
                                      startTime = schedule.startedAt;
                                    } else {
                                      startTime = new Date(schedule.startedAt);
                                    }
                                  } else {
                                    // Fall back to scheduled time if startedAt is not available
                                    const [hours, minutes] = schedule.time.split(':').map(Number);
                                    startTime = new Date(date);
                                    startTime.setHours(hours, minutes, 0);
                                  }
                                  
                                  const durationMs = endTime.getTime() - startTime.getTime();
                                  
                                  if (durationMs > 0) {
                                    const totalSeconds = Math.floor(durationMs / 1000);
                                    const hours = Math.floor(totalSeconds / 3600);
                                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                                    const seconds = totalSeconds % 60;
                                    
                                    if (hours > 0) {
                                      return `${hours}h ${minutes}m ${seconds}s`;
                                    } else if (minutes > 0) {
                                      return `${minutes}m ${seconds}s`;
                                    } else {
                                      return `${seconds}s`;
                                    }
                                  } else {
                                    return '0s';
                                  }
                                } else {
                                  return 'Completed (no timestamp)';
                                }
                              } else if (schedule.status === 'in-progress') {
                                // Calculate elapsed time for in-progress broadcasts using actual start time
                                let startTime = null;
                                
                                // Use startedAt if available (actual start time)
                                if (schedule.startedAt) {
                                  // Handle Firebase Timestamp properly
                                  if (schedule.startedAt && typeof schedule.startedAt.toDate === 'function') {
                                    startTime = schedule.startedAt.toDate();
                                    console.log(`🔍 DEBUG: Using startedAt.toDate(): ${startTime.toISOString()}`);
                                  } else if (schedule.startedAt instanceof Date) {
                                    startTime = schedule.startedAt;
                                    console.log(`🔍 DEBUG: Using startedAt as Date: ${startTime.toISOString()}`);
                                  } else {
                                    startTime = new Date(schedule.startedAt);
                                    console.log(`🔍 DEBUG: Using new Date(startedAt): ${startTime.toISOString()}`);
                                  }
                                } else {
                                  // Fall back to scheduled time if startedAt is not available
                                  const [hours, minutes] = schedule.time.split(':').map(Number);
                                  startTime = new Date(date);
                                  startTime.setHours(hours, minutes, 0);
                                  console.log(`🔍 DEBUG: Using scheduled time (no startedAt): ${startTime.toISOString()}`);
                                }
                                
                                const now = currentTime;
                                const elapsedMs = now.getTime() - startTime.getTime();
                                
                                console.log(`🔍 DEBUG: Current time: ${now.toISOString()}, Start time: ${startTime.toISOString()}, Elapsed: ${elapsedMs}ms`);
                                
                                if (elapsedMs > 0) {
                                  const totalSeconds = Math.floor(elapsedMs / 1000);
                                  const hours = Math.floor(totalSeconds / 3600);
                                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                                  const seconds = totalSeconds % 60;
                                  
                                  if (hours > 0) {
                                    return `${hours}h ${minutes}m ${seconds}s (running)`;
                                  } else if (minutes > 0) {
                                    return `${minutes}m ${seconds}s (running)`;
                                  } else {
                                    return `${seconds}s (running)`;
                                  }
                                }
                              }
                              
                              return schedule.status === 'scheduled' ? 'Not started' : 'Unknown';
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {schedule.status === "scheduled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelSchedule(schedule.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-gray-500 py-4">
                        No scheduled broadcasts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default ScheduleBroadcasts;
