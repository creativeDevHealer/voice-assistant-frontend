import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, Key, CheckCircle } from 'lucide-react';
import { balanceService } from '@/services/balanceService';

interface ApiKeySettingsProps {
  children?: React.ReactNode;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ children }) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('telnyx_api_key') || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [open, setOpen] = useState(false);

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setTestResult('error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test the API key by making a direct call to the backend
      const response = await fetch('http://35.88.71.8:5000/api/telnyx-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey
        }),
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'API key test failed');
      }

      setTestResult('success');
    } catch (error) {
      console.error('API key test failed:', error);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveApiKey = () => {
    if (testResult === 'success') {
      balanceService.setApiKey(apiKey);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <Key className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Telnyx API Key</DialogTitle>
          <DialogDescription>
            Enter your Telnyx API key to fetch real-time balance information.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">API Key Configuration</CardTitle>
            <CardDescription className="text-xs">
              Your API key is stored locally and used to authenticate with Telnyx services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Telnyx API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your Telnyx API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleTestApiKey}
                disabled={testing || !apiKey.trim()}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>

            {testResult === 'success' && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>API key is valid and working!</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Invalid API key or connection failed</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSaveApiKey}
                disabled={testResult !== 'success'}
                size="sm"
                className="flex-1"
              >
                Save API Key
              </Button>
              <Button
                onClick={() => setOpen(false)}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-gray-500 mt-4">
          <p><strong>Note:</strong> API keys are stored in your browser's local storage.</p>
          <p>Find your API key in your <a href="https://portal.telnyx.com/#/app/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Telnyx Portal</a>.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeySettings;
