import type { NativeStackScreenProps } from "@react-navigation/native-stack";
export type RootStackParamList = {
  Tabs: undefined;
  AddBottle: undefined;
  BottleDetail: { id: string };
  TradeDetail: { id: string };
};
export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
