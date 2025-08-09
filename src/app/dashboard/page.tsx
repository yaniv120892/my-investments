"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import type { Investment } from "@prisma/client";
import type { PortfolioResponse } from "@/lib/api";
import {
  formatCurrency,
  formatNumber,
  getInvestmentTypeLabel,
} from "@/utils/format";
import { usePortfolio, useDeleteInvestment } from "@/lib/hooks";
import AddInvestmentModal from "@/components/AddInvestmentModal";
import EditInvestmentModal from "@/components/EditInvestmentModal";
import AssetAllocation from "@/components/AssetAllocation";
import PortfolioChart from "@/components/PortfolioChart";

export default function DashboardPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] =
    useState<Investment | null>(null);

  const {
    data: portfolioData,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = usePortfolio();
  const deleteInvestmentMutation = useDeleteInvestment();

  const portfolioResponse = portfolioData as PortfolioResponse | undefined;
  const investments = portfolioResponse?.investments || [];
  const portfolioSummary = portfolioResponse?.summary;
  const pricesMap = portfolioResponse?.prices || {};

  const groupedInvestments = investments.reduce(
    (acc: Record<string, Investment[]>, investment: Investment) => {
      const type = investment.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(investment);
      return acc;
    },
    {} as Record<string, Investment[]>
  );

  const isLoading = portfolioLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (portfolioError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
            Error loading portfolio data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {portfolioSummary && (
          <div className="mb-8">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Investment Portfolio Overview
              </h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Total Value
                </h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(portfolioSummary.totalValue ?? 0)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Number of Assets
                </h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {portfolioSummary.assetCount}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Last Updated
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {new Date(portfolioSummary.lastUpdated).toLocaleString(
                    "en-US"
                  )}
                </p>
              </div>
            </div>

            <AssetAllocation
              categoryTotals={portfolioSummary.categoryTotals}
              totalValue={portfolioSummary.totalValue}
            />

            <div className="mt-8">
              <PortfolioChart />
            </div>
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(groupedInvestments).map(([type, typeInvestments]) => (
            <div
              key={type}
              className="bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {getInvestmentTypeLabel(type)}
                </h2>
                {portfolioSummary?.categoryTotals[type] && (
                  <p className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                    {formatCurrency(portfolioSummary.categoryTotals[type])}
                  </p>
                )}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {typeInvestments.map((investment: Investment) => (
                  <div key={investment.id} className="px-6 py-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {investment.assetName}
                        </h3>
                        {investment.ticker && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {investment.ticker}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Quantity: {formatNumber(investment.quantity)}
                        </p>
                      </div>
                      <div className="text-right mr-4">
                        {pricesMap[investment.id]?.unitPrice ? (
                          <>
                            <p className="text-lg font-medium text-gray-900 dark:text-white">
                              {formatCurrency(
                                investment.quantity *
                                  pricesMap[investment.id].unitPrice,
                                pricesMap[investment.id].currency
                              )}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(
                                pricesMap[investment.id].unitPrice,
                                pricesMap[investment.id].currency
                              )}{" "}
                              per unit
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-medium text-gray-900 dark:text-white">
                              N/A
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No live price
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedInvestment(investment);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                          title="Edit investment"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            deleteInvestmentMutation.mutate(investment.id);
                          }}
                          disabled={deleteInvestmentMutation.isPending}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md disabled:opacity-50"
                          title="Delete investment"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedInvestments).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No investments yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Start building your portfolio by adding your first investment.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Add Investment
              </button>
            </div>
          )}
        </div>

        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            Add Investment
          </button>
        </div>

        <AddInvestmentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

        <EditInvestmentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedInvestment(null);
          }}
          investment={selectedInvestment}
        />
      </div>
    </div>
  );
}
