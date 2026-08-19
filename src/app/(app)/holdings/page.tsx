"use client";

import { useState } from "react";
import { Button, Stack } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ConfirmDialog from "@/components/ConfirmDialog";
import HoldingFormModal from "@/components/HoldingFormModal";
import HoldingsTable from "@/components/HoldingsTable";
import PricingFailuresAlert from "@/components/PricingFailuresAlert";
import PageHeader from "@/components/shell/PageHeader";
import {
  PortfolioError,
  PortfolioSkeleton,
} from "@/components/PortfolioLoadState";
import type { PricedHolding } from "@/lib/api";
import { useDeleteHolding, usePlatforms } from "@/lib/hooks";
import { usePortfolioView } from "@/lib/usePortfolioView";
import { describeError } from "@/utils/describeError";

export default function HoldingsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [holdingBeingEdited, setHoldingBeingEdited] =
    useState<PricedHolding | null>(null);
  const [holdingPendingDeletion, setHoldingPendingDeletion] =
    useState<PricedHolding | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const { data, isLoading, error, money } = usePortfolioView();
  const { data: platformsData } = usePlatforms();
  const deleteHolding = useDeleteHolding();

  const openCreateForm = (): void => {
    setHoldingBeingEdited(null);
    setIsFormOpen(true);
  };

  const openEditForm = (holding: PricedHolding): void => {
    setHoldingBeingEdited(holding);
    setIsFormOpen(true);
  };

  const closeForm = (): void => {
    setIsFormOpen(false);
    setHoldingBeingEdited(null);
  };

  const requestDeletion = (holding: PricedHolding): void => {
    setDeletionError(null);
    setHoldingPendingDeletion(holding);
  };

  const confirmDeletion = async (): Promise<void> => {
    if (!holdingPendingDeletion) {
      return;
    }
    try {
      await deleteHolding.mutateAsync(holdingPendingDeletion.id);
      setHoldingPendingDeletion(null);
    } catch (deletionFailure) {
      setDeletionError(describeError(deletionFailure));
    }
  };

  const header = (
    <PageHeader
      title="Holdings"
      subtitle="Every position, its live price, and what it is worth today."
      action={
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={openCreateForm}
        >
          Add holding
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <PortfolioSkeleton rows={1} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <PortfolioError error={error} />
      </>
    );
  }

  return (
    <>
      {header}

      <Stack spacing={{ xs: 2, md: 3 }}>
        <PricingFailuresAlert failures={data.failures} />
        <HoldingsTable
          holdings={data.holdings}
          money={money}
          onEdit={openEditForm}
          onDelete={requestDeletion}
        />
      </Stack>

      {isFormOpen && (
        <HoldingFormModal
          holding={holdingBeingEdited}
          platforms={platformsData?.platforms ?? []}
          onClose={closeForm}
        />
      )}

      {holdingPendingDeletion && (
        <ConfirmDialog
          title="Delete holding"
          message={`Delete ${holdingPendingDeletion.assetName} and its snapshot history? This cannot be undone.`}
          confirmLabel="Delete"
          isPending={deleteHolding.isPending}
          errorMessage={deletionError}
          onConfirm={confirmDeletion}
          onCancel={() => setHoldingPendingDeletion(null)}
        />
      )}
    </>
  );
}
