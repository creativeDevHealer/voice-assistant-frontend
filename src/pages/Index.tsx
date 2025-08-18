
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import FileUpload from "@/components/FileUpload";
import TemplateManager from "@/components/TemplateManager";
import BroadcastControl from "@/components/BroadcastControl";
import ClientTable from "@/components/ClientTable";
import Dashboard from "@/components/Dashboard";
import ScheduleBroadcasts from "@/components/ScheduleBroadcasts"

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clientData, setClientData] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [failedCalls, setFailedCalls] = useState(0);

  const handleFileUploaded = (data: any[]) => {
    setClientData(data);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleTemplateSelected = (template: any) => {
    setSelectedTemplate(template);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            clientData={clientData}
            completedCalls={completedCalls}
            failedCalls={failedCalls}
          />
        );
      case "upload":
        return <FileUpload onFileUploaded={handleFileUploaded} />;
      case "templates":
        return <TemplateManager onTemplateSelected={handleTemplateSelected} selectedTemplate={selectedTemplate} />;
      case "broadcast":
        return (
          <BroadcastControl
            clientData={clientData}
            selectedTemplate={selectedTemplate}
          />
        );
      case "clients":
        return <ClientTable data={clientData} />;
      case "schedule":
        return <ScheduleBroadcasts />;
      default:
        return (
          <div className="text-center py-10 text-gray-500">
            This section is coming soon.
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {activeTab === "dashboard" && "VoiceCast Dashboard"}
              {activeTab === "upload" && "Upload Client Data"}
              {activeTab === "templates" && "Message Templates"}
              {activeTab === "broadcast" && "Broadcast Control"}
              {activeTab === "clients" && "Client Management"}
              {activeTab === "schedule" && "Schedule Broadcasts"}
              {activeTab === "settings" && "System Settings"}
            </h1>
            <p className="text-gray-500 mt-1">
              {activeTab === "dashboard" && "Overview of your broadcasting system"}
              {activeTab === "upload" && "Upload and manage client information"}
              {activeTab === "templates" && "Create and edit message templates"}
              {activeTab === "broadcast" && "Start and monitor voice broadcasts"}
              {activeTab === "clients" && "View and manage client database"}
              {activeTab === "schedule" && "Schedule future broadcasts"}
              {activeTab === "settings" && "Configure system settings"}
            </p>
          </header>
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Index;
