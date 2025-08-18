
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { FileText, Plus, Pen, Clock } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  isDefault?: boolean;
}

interface TemplateManagerProps {
  selectedTemplate: Template | null;
  onTemplateSelected: (template: Template) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  selectedTemplate,
  onTemplateSelected
}) => {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: "1",
      name: "Default Message",
      content: "Hello {firstName} {lastName}, this is a final procedural reminder regarding file number {fileNumber}. Action is required without delay. Contact 531-215-7299 immediately — that’s 531-215-7299. Reference file number {fileNumber}, again — file number {fileNumber}.",
      createdAt: new Date(2023, 6, 15),
      isDefault: true
    }
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", content: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const handleCreateNew = () => {
    setFormData({ name: "", content: "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };
  
  const handleEdit = (template: Template) => {
    setFormData({ name: template.name, content: template.content });
    setEditingId(template.id);
    setIsDialogOpen(true);
  };
  
  const handleSaveTemplate = () => {
    if (!formData.name || !formData.content) {
      toast({
        title: "Error",
        description: "Name and content are required",
        variant: "destructive"
      });
      return;
    }

    if (editingId) {
      // Edit existing template
      setTemplates(templates.map(t => 
        t.id === editingId 
          ? { ...t, name: formData.name, content: formData.content } 
          : t
      ));
      toast({
        title: "Success",
        description: "Template updated successfully"
      });
    } else {
      // Create new template
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: formData.name,
        content: formData.content,
        createdAt: new Date()
      };
      
      setTemplates([...templates, newTemplate]);
      toast({
        title: "Success",
        description: "New template created successfully"
      });
    }
    
    setIsDialogOpen(false);
  };

  const handleSelectTemplate = (template: Template) => {
    onTemplateSelected(template);
    toast({
      title: "Template Selected",
      description: `Template "${template.name}" has been selected for broadcasting`
    });
  };
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };
  
  return (
    <Card className="dashboard-card">
      <Tabs defaultValue="all">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gradient-text">Message Templates</h2>
            <Button 
              className="bg-gradient-primary" 
              onClick={handleCreateNew}
            >
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </div>
          
          <TabsList className="mb-6">
            <TabsTrigger value="all">All Templates</TabsTrigger>
            <TabsTrigger value="recent">Recently Used</TabsTrigger>
            <TabsTrigger value="default">Default Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {templates.map(template => (
              <div 
                key={template.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-broadcast-purple hover:shadow-md ${
                  selectedTemplate?.id === template.id 
                    ? "border-broadcast-purple bg-purple-50" 
                    : "border-gray-200"
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-broadcast-purple" />
                    <h3 className="font-medium">{template.name}</h3>
                    {template.isDefault && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-broadcast-purple"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(template);
                      }}
                    >
                      <Pen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {template.content}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="h-3 w-3 mr-1" />
                    Created on {formatDate(template.createdAt)}
                  </div>
                  
                  {selectedTemplate?.id === template.id && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="recent">
            <div className="text-center py-6 text-gray-500">
              No recently used templates
            </div>
          </TabsContent>
          
          <TabsContent value="default">
            {templates
              .filter(t => t.isDefault)
              .map(template => (
                <div 
                  key={template.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-broadcast-purple hover:shadow-md mb-4 ${
                    selectedTemplate?.id === template.id 
                      ? "border-broadcast-purple bg-purple-50" 
                      : "border-gray-200"
                  }`}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-broadcast-purple" />
                      <h3 className="font-medium">{template.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    </div>
                    
                    {selectedTemplate?.id === template.id && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    {template.content}
                  </p>
                </div>
              ))
            }
          </TabsContent>
        </div>
      </Tabs>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Template" : "Create New Template"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input 
                id="template-name" 
                placeholder="Enter template name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template-content">Message Content</Label>
              <Textarea 
                id="template-content" 
                placeholder="Enter message content. Use {name} and {fileNumber} as placeholders."
                rows={6}
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
              />
              <p className="text-xs text-gray-500">
                You can use the following variables: {"{name}"}, {"{fileNumber}"}, {"{phone}"}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary"
              onClick={handleSaveTemplate}
            >
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TemplateManager;
