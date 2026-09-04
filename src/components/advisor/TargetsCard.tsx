"use client";

import { useState } from "react";
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
import { getAssetClassLabel } from "@/utils/format";
import TargetsModal from "@/components/advisor/TargetsModal";
import type { PricedHolding } from "@/lib/api";

const TOTAL_TARGET_PERCENT = 100;
const TARGET_SUM_TOLERANCE = 0.01;

interface TargetsCardProps {
  holdings: PricedHolding[];
}

export default function TargetsCard({ holdings }: TargetsCardProps) {
  const { data: targets } = useTargets();
  const [isEditing, setIsEditing] = useState(false);

  const liquidHoldings = holdings.filter(
    (holding) => holding.liquidity === Liquidity.LIQUID
  );
  const classTargets = targets?.classTargets ?? [];
  const targetSum = classTargets.reduce(
    (total, target) => total + target.targetPercent,
    0
  );
  const isBalanced =
    Math.abs(targetSum - TOTAL_TARGET_PERCENT) <= TARGET_SUM_TOLERANCE;

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
