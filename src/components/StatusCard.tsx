
import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatusCardProps {
  title: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtext?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  total,
  icon,
  color,
  bgColor,
  subtext
}) => {
  const percentage = total ? (value / total) * 100 : 0;
  
  return (
    <Card className="dashboard-card overflow-visible">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <h3 className="text-2xl font-bold" style={{ color }}>
              {value}
              {total && <span className="text-sm font-normal text-gray-400 ml-1">/ {total}</span>}
            </h3>
            {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
          </div>
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            {icon}
          </div>
        </div>
        
        {total && (
          <div className="mt-4">
            <Progress 
              value={percentage} 
              className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-current [&>div]:to-current" 
              style={{ color: color }}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{percentage.toFixed(0)}%</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatusCard;
