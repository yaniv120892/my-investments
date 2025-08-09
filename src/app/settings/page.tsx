"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import { formatCurrency } from "@/utils/format";
import { useUserSettings, useUpdateSettings } from "@/lib/hooks";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("NIS");
  const [userEmail, setUserEmail] = useState("");

  const { data: settingsData, isLoading } = useUserSettings();
  const updateSettingsMutation = useUpdateSettings();

  if (settingsData?.data) {
    if (darkMode !== settingsData.data.darkMode) {
      setDarkMode(settingsData.data.darkMode);
    }
    if (baseCurrency !== settingsData.data.baseCurrency) {
      setBaseCurrency(settingsData.data.baseCurrency);
    }
    if (userEmail !== settingsData.data.email) {
      setUserEmail(settingsData.data.email);
    }
  }

  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ darkMode, baseCurrency });
      alert("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error saving settings");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Dark Mode
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable dark mode for the interface
                </p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  darkMode ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Base Currency
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select the main currency for displaying values
              </p>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="NIS">New Shekel (₪)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Preview
              </h4>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {formatCurrency(1234567.89, baseCurrency)}
              </p>
            </div>

            <div className="pt-6">
              <button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                {updateSettingsMutation.isPending
                  ? "Saving..."
                  : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
