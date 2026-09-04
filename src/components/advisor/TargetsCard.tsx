"use client";

import { memo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { Liquidity } from "@prisma/client";
import { useTargets } from "@/lib/hooks";
import {
  isTargetSumBalanced,
  sumTargetPercent,
} from "@/lib/targets/targetPercentRules";
import { getAssetClassLabel } from "@/utils/format";
import TargetsModal from "@/components/advisor/TargetsModal";
import type { PricedHolding } from "@/lib/api";

interface TargetsCardProps {
  holdings: PricedHolding[];
}

function TargetsCard({ holdings }: TargetsCardProps) {
  const { data: targets } = useTargets();
  const [isEditing, setIsEditing] = useState(false);

  const liquidHoldings = holdings.filter(
    (holding) => holding.liquidity === Liquidity.LIQUID
  );
  const classTargets = targets?.classTargets ?? [];
  const targetSum = sumTargetPercent(classTargets);
  const isBalanced = isTargetSumBalanced(targetSum);

  return (
    <>
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h4" component="h2">
              Targets
            </Typography>
            <Button
              size="small"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </Stack>

          {classTargets.length === 0 ? (
            <Alert severity="info">
              Set your asset class targets before asking for a plan — without
              them the advisor has nothing to aim at.
            </Alert>
          ) : (
            <Stack spacing={1}>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {classTargets.map((target) => (
                  <Chip
                    key={target.assetClass}
                    size="small"
                    variant="outlined"
                    label={`${getAssetClassLabel(
                      target.assetClass
                    )} ${target.targetPercent}%`}
                  />
                ))}
              </Stack>
              {!isBalanced && (
                <Alert severity="warning">
                  Targets sum to {targetSum.toFixed(1)}%, not 100% — the advisor
                  will refuse to plan until they balance.
                </Alert>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      {isEditing && (
        <TargetsModal
          open
          onClose={() => setIsEditing(false)}
          liquidHoldings={liquidHoldings}
          targets={targets}
        />
      )}
    </>
  );
}

// The chat re-renders on every streamed token; the targets do not change.
export default memo(TargetsCard);
