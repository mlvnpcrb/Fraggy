import React from "react";
import { BetaProvider } from "./Provider";
import { useBeta } from "./context";
import { BetaNavigator } from "./Navigator";
import { AuthScreen } from "./AuthScreen";
function Root({ onExit }: { onExit?: () => void }) {
  const b = useBeta();
  return !b.loading && !b.session ? (
    <AuthScreen onBack={onExit} />
  ) : (
    <BetaNavigator />
  );
}
export function BetaApp({ onExit }: { onExit?: () => void }) {
  return (
    <BetaProvider>
      <Root onExit={onExit} />
    </BetaProvider>
  );
}
