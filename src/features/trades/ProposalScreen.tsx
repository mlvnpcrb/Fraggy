import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BetaStack } from "../../beta/navigation";
import { useBeta } from "../../beta/context";
import {
  Body,
  Button,
  Card,
  Feedback,
  Page,
  Photo,
  useAction,
} from "../../beta/ui";
import { FragranceSummary } from "../catalog/FragranceEditor";
export function ProposalScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Proposal">) {
  const b = useBeta(),
    a = useAction(),
    o = b.state.bottles.find((x) => x.id === route.params.offeredId),
    r = b.state.bottles.find((x) => x.id === route.params.requestedId);
  return (
    <Page
      title="Review your swap."
      subtitle="One bottle for one bottle. No payments or cash top-ups."
      back={() => navigation.goBack()}
    >
      {o && r ? (
        <>
          {[o, r].map((x, index) => (
            <Card key={x.id}>
              <Body>{index === 0 ? "YOU OFFER" : "YOU REQUEST"}</Body>
              <Photo path={x.image_path} />
              <Body>
                {x.brand} · {x.name}
              </Body>
              <Body>
                {x.size_ml} ml · {x.remaining_percent}% · {x.condition} ·{" "}
                {x.has_cap ? "Cap included" : "No cap"} ·{" "}
                {x.has_box ? "Box included" : "No box"}
              </Body>
              <Body>{x.notes}</Body>
              <FragranceSummary entry={x.fragrance} />
            </Card>
          ))}
          <Body>
            Exchange · {route.params.method}. Both collectors must accept this
            same offer before reservation. Ownership changes only when both
            separately confirm receipt.
          </Body>
          <Feedback {...a} />
          <Button
            title="Send proposal and open chat"
            disabled={
              a.busy ||
              b.offline ||
              !!o.reserved_trade_id ||
              !!r.reserved_trade_id
            }
            onPress={() =>
              void a.act(async () => {
                const id = await b.run<string>(
                  b.mode === "demo"
                    ? "propose_trade"
                    : "reviewed_propose_trade",
                  {
                    p_offered: o.id,
                    p_requested: r.id,
                    p_method: route.params.method,
                    ...(b.mode === "live"
                      ? {
                          p_offered_version: o.version,
                          p_requested_version: r.version,
                        }
                      : {}),
                  },
                );
                navigation.replace("Trade", { id });
              })
            }
          />
        </>
      ) : (
        <Body>
          One of these bottles is unavailable. Return to Discover to choose
          another.
        </Body>
      )}
    </Page>
  );
}
