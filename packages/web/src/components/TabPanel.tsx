"use client";

import React, { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabPanelProps {
  tabs: Tab[];
  defaultTab?: string;
  orientation?: "horizontal" | "vertical" | "boxed";
  size?: "xs" | "sm" | "md" | "lg";
  onChange?: (tabId: string) => void;
}

export default function TabPanel({
  tabs,
  defaultTab,
  orientation = "horizontal",
  size = "md",
  onChange,
}: TabPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onChange) onChange(tabId);
  };

  // Determine tab role class based on orientation
  const roleClass = {
    horizontal: "tabs-bordered",
    vertical: "tabs-vertical",
    boxed: "tabs-boxed",
  }[orientation];

  // Determine tab size class
  const sizeClass = {
    xs: "tabs-xs",
    sm: "tabs-sm",
    md: "",
    lg: "tabs-lg",
  }[size];

  return (
    <div className="w-full">
      <div className={`tabs ${roleClass} ${sizeClass}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "tab-active" : ""} ${
              tab.disabled ? "tab-disabled" : ""
            }`}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
            disabled={tab.disabled}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
