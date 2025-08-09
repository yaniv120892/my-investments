"use client";

import { useState, useEffect } from "react";
import { InvestmentType } from "@/types";
import type { Investment } from "@prisma/client";
import { useUpdateInvestment, useDeleteInvestment } from "@/lib/hooks";

interface EditInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment: Investment | null;
}

export default function EditInvestmentModal({
  isOpen,
  onClose,
  investment,
}: EditInvestmentModalProps) {
  const [type, setType] = useState<InvestmentType>(InvestmentType.STOCK);
  const [assetName, setAssetName] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");

  const updateInvestmentMutation = useUpdateInvestment();
  const deleteInvestmentMutation = useDeleteInvestment();

  useEffect(() => {
    if (investment) {
      setType(investment.type as InvestmentType);
      setAssetName(investment.assetName);
      setTicker(investment.ticker || "");
      setQuantity(investment.quantity.toString());
      setError("");
    }
  }, [investment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!investment) return;

    if (!assetName || !quantity) {
      setError("Asset name and quantity are required");
      return;
    }

    try {
      await updateInvestmentMutation.mutateAsync({
        id: investment.id,
        data: {
          type: type,
          assetName,
          ticker: ticker || undefined,
          quantity: parseFloat(quantity),
        },
      });

      onClose();
      setAssetName("");
      setTicker("");
      setQuantity("");
    } catch (error) {
      console.error("Update investment error:", error);
      setError("Error updating investment");
    }
  };

  const handleDelete = async () => {
    if (!investment) return;

    if (confirm("Are you sure you want to delete this investment?")) {
      try {
        await deleteInvestmentMutation.mutateAsync(investment.id);
        onClose();
      } catch (error) {
        console.error("Delete investment error:", error);
        setError("Error deleting investment");
      }
    }
  };

  if (!isOpen || !investment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Edit Investment
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
              onClick={handleDelete}
              disabled={deleteInvestmentMutation.isPending}
              className="flex-1 px-4 py-2 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {deleteInvestmentMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateInvestmentMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateInvestmentMutation.isPending ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
