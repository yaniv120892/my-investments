"use client";

import { useState } from "react";
import { Button, Stack } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import ConfirmDialog from "@/components/ConfirmDialog";
import HoldingFormModal from "@/components/HoldingFormModal";
import HoldingsTable from "@/components/HoldingsTable";
import ManualValuesModal from "@/components/ManualValuesModal";
import PortfolioPage from "@/components/PortfolioPage";
import PricingFailuresAlert from "@/components/PricingFailuresAlert";
import StaleManualValuesAlert from "@/components/StaleManualValuesAlert";
import type { PricedHolding } from "@/lib/api";
import { useDeleteHolding, usePlatforms } from "@/lib/hooks";
import { describeError } from "@/utils/describeError";

export default function HoldingsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManualValuesOpen, setIsManualValuesOpen] = useState(false);
  const [holdingBeingEdited, setHoldingBeingEdited] =
    useState<PricedHolding | null>(null);
  const [holdingPendingDeletion, setHoldingPendingDeletion] =
    useState<PricedHolding | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);

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

  return (
    <PortfolioPage
      title="Holdings"
      subtitle="Every position, its live price, and what it is worth today."
      skeletonRows={1}
      action={
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<EditNoteRoundedIcon />}
            onClick={() => setIsManualValuesOpen(true)}
          >
            Manual values
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreateForm}
          >
            Add holding
          </Button>
        </Stack>
      }
    >
      {({ data, money }) => (
        <>
          <Stack spacing={{ xs: 2, md: 3 }}>
            <PricingFailuresAlert failures={data.failures} />
            <StaleManualValuesAlert
              holdings={data.holdings}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setIsManualValuesOpen(true)}
                >
                  Review
                </Button>
              }
            />
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

          {isManualValuesOpen && (
            <ManualValuesModal
              holdings={data.holdings}
              onClose={() => setIsManualValuesOpen(false)}
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
      )}
    </PortfolioPage>
  );
}
