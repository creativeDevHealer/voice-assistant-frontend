import React from "react";
import StatusCard from "./StatusCard";
import { Card } from "@/components/ui/card";
import { Phone, CheckCircle2, AlertTriangle, Clock, FileUp, FileText } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DashboardProps {
  clientData: any[];
  completedCalls: number;
  failedCalls: number;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  clientData,
  completedCalls,
  failedCalls
}) => {
  // Sample data for charts
  const callData = [
    { name: "Mon", completed: 65, failed: 12 },
    { name: "Tue", completed: 59, failed: 10 },
    { name: "Wed", completed: 80, failed: 23 },
    { name: "Thu", completed: 81, failed: 19 },
    { name: "Fri", completed: 56, failed: 15 },
    { name: "Sat", completed: 55, failed: 18 },
    { name: "Sun", completed: 40, failed: 8 }
  ];
  
  const hourlyData = [
    { hour: "9AM", calls: 20 },
    { hour: "10AM", calls: 35 },
    { hour: "11AM", calls: 50 },
    { hour: "12PM", calls: 40 },
    { hour: "1PM", calls: 30 },
    { hour: "2PM", calls: 45 },
    { hour: "3PM", calls: 55 },
    { hour: "4PM", calls: 35 },
    { hour: "5PM", calls: 25 }
  ];

  const pendingCalls = clientData.length - (completedCalls + failedCalls);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard 
          title="Total Clients" 
          value={clientData.length}
          icon={<FileUp className="h-5 w-5 text-broadcast-purple" />}
          color="#8B5CF6"
          bgColor="#EDE9FE"
          subtext="Available for broadcasting"
        />
        
        <StatusCard 
          title="Completed Calls" 
          value={completedCalls}
          total={clientData.length > 0 ? clientData.length : undefined}
          icon={<CheckCircle2 className="h-5 w-5 text-broadcast-green" />}
          color="#10B981"
          bgColor="#D1FAE5"
          subtext="Successfully delivered"
        />
        
        <StatusCard 
          title="Failed Calls" 
          value={failedCalls}
          total={clientData.length > 0 ? clientData.length : undefined}
          icon={<AlertTriangle className="h-5 w-5 text-broadcast-red" />}
          color="#EF4444"
          bgColor="#FEE2E2"
          subtext="No answer or error"
        />
        
        <StatusCard 
          title="Pending" 
          value={pendingCalls}
          total={clientData.length > 0 ? clientData.length : undefined}
          icon={<Clock className="h-5 w-5 text-broadcast-blue" />}
          color="#0EA5E9"
          bgColor="#E0F2FE"
          subtext="Waiting to be processed"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dashboard-card">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Weekly Call Performance</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={callData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    name="Completed Calls" 
                    stroke="#10B981" 
                    activeDot={{ r: 8 }} 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failed" 
                    name="Failed Calls" 
                    stroke="#EF4444" 
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
        
        <Card className="dashboard-card">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Hourly Distribution</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourlyData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="calls" 
                    name="Total Calls" 
                    fill="#8B5CF6" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
      
      <Card className="dashboard-card">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
          
          <div className="space-y-4">
            {[
              { id: 1, type: "success", time: "2 minutes ago", message: "Successfully broadcasted to 25 clients" },
              { id: 2, type: "upload", time: "1 hour ago", message: "New client data uploaded (45 contacts)" },
              { id: 3, type: "template", time: "3 hours ago", message: "New message template created: 'Payment Reminder'" },
              { id: 4, type: "error", time: "5 hours ago", message: "Failed to reach 8 clients due to invalid phone numbers" }
            ].map(activity => (
              <div key={activity.id} className="flex items-start p-3 rounded-md border border-gray-100 hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                  activity.type === "success" ? "bg-green-100" : 
                  activity.type === "error" ? "bg-red-100" :
                  activity.type === "upload" ? "bg-blue-100" : "bg-purple-100"
                }`}>
                  {activity.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-broadcast-green" />
                  ) : activity.type === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-broadcast-red" />
                  ) : activity.type === "upload" ? (
                    <FileUp className="h-4 w-4 text-broadcast-blue" />
                  ) : (
                    <FileText className="h-4 w-4 text-broadcast-purple" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
