"use client";

import { useState } from "react";
import { InvestmentType } from "@/types";
import { useCreateInvestment } from "@/lib/hooks";

interface AddInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddInvestmentModal({
  isOpen,
  onClose,
}: AddInvestmentModalProps) {
  const [type, setType] = useState<InvestmentType>(InvestmentType.STOCK);
  const [assetName, setAssetName] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");

  const createInvestmentMutation = useCreateInvestment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!assetName || !quantity) {
      setError("Asset name and quantity are required");
      return;
    }

    try {
      await createInvestmentMutation.mutateAsync({
        type,
        assetName,
        ticker: ticker || undefined,
        quantity: parseFloat(quantity),
      });

      onClose();
      setAssetName("");
      setTicker("");
      setQuantity("");
    } catch (error) {
      console.error("Create investment error:", error);
      setError("Error creating investment");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add New Investment
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Investment Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InvestmentType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={InvestmentType.STOCK}>Stocks</option>
              <option value={InvestmentType.CRYPTO}>Cryptocurrency</option>
              <option value={InvestmentType.PENSION}>Pension Fund</option>
              <option value={InvestmentType.EDUCATION_FUND}>
                Education Fund
              </option>
              <option value={InvestmentType.INVESTMENT_FUND}>
                Investment Fund
              </option>
              <option value={InvestmentType.MONEY_MARKET}>Money Market</option>
              <option value={InvestmentType.FOREIGN_CURRENCY}>
                Foreign Currency
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asset Name
            </label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Apple Inc."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ticker (Optional)
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., AAPL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInvestmentMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createInvestmentMutation.isPending
                ? "Creating..."
                : "Create Investment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
