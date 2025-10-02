import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, AlertCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { balanceService, BalanceData } from '@/services/balanceService';
import ApiKeySettings from './ApiKeySettings';

interface BalanceDisplayProps {
  collapsed?: boolean;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ collapsed = false }) => {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBalance = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      // Try to get real balance first
      const balanceData = await balanceService.getBalance();
      setBalance(balanceData);
      setLastRefresh(new Date());
      setError(null); // Clear any previous errors
    } catch (err) {
      console.warn('Failed to fetch real balance, using mock data:', err);
      // Fallback to mock data for development
      const mockBalance = balanceService.getMockBalance();
      setBalance(mockBalance);
      setLastRefresh(new Date());
      setError('Using mock data - API key not configured or connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBalance();
    
    // Set up automatic refresh every 10 minutes (600,000 ms)
    intervalRef.current = setInterval(() => {
      console.log('🔄 Auto-refreshing balance (10 minutes interval)');
      fetchBalance(false); // Don't show loading spinner for auto-refresh
    }, 30 * 60 * 1000);
    
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getBalanceStatus = (amount: number) => {
    if (amount < 10) return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Low' };
    if (amount < 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Medium' };
    return { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Good' };
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent">
          <DollarSign className="h-4 w-4 text-sidebar-foreground" />
        </div>
        {loading && !balance && (
          <div className="w-6 h-6 border-2 border-sidebar-foreground/30 border-t-sidebar-foreground rounded-full animate-spin" />
        )}
        {error && (
          <div className="w-2 h-2 rounded-full bg-yellow-400" title="API key not configured" />
        )}
      </div>
    );
  }

  const status = balance ? getBalanceStatus(balance.balance) : null;

  return (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-sidebar-foreground">Account Balance</h3>
        {error && (
          <ApiKeySettings>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-sidebar-accent/50"
              title="Configure API Key"
            >
              <Settings className="h-3 w-3 text-yellow-400" />
            </Button>
          </ApiKeySettings>
        )}
      </div>

      {loading && !balance ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-sidebar-foreground/30 border-t-sidebar-foreground rounded-full animate-spin" />
        </div>
      ) : balance ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-white">
              {formatBalance(balance.balance)}
            </span>
            {/* {status && (
              <Badge 
                variant="secondary" 
                className={cn("text-xs", status.color, status.bg)}
              >
                {status.label}
              </Badge>
            )} */}
          </div>
          
          {lastRefresh && (
            <p className="text-xs text-sidebar-foreground/60">
              Updated {lastRefresh.toLocaleTimeString()} • Auto-refresh every 30 min
            </p>
          )}
          
          {error && (
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-sidebar-foreground/60">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Unable to load balance</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceDisplay;
