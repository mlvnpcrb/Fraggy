import React, { useId } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Ellipse,
} from "react-native-svg";
import { Bottle } from "./Bottle";
import { BottleEntrance } from "./Motion";
import type { Bottle as BottleType } from "../domain/types";
import { colors, fonts } from "../theme";

export function PerfumeCabinet({
  bottles,
  onBottle,
  onAdd,
}: {
  bottles: BottleType[];
  onBottle: (bottle: BottleType) => void;
  onAdd?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.5 ? 2 : 3;
  const count = Math.max(3, Math.ceil((bottles.length + 1) / columns));
  const artSize = Math.min(135, Math.floor((width - 68) / columns / 0.74) - 6);
  return (
    <View style={s.cabinet} testID="perfume-cabinet">
      <View style={s.crown}>
        <View style={s.crownLine} />
        <Text style={s.crownText}>THE FRAGGY COLLECTION</Text>
        <View style={s.crownLine} />
      </View>
      <View style={s.interior}>
        {Array.from({ length: count }, (_, row) => (
          <CabinetRow
            key={row}
            index={row}
            bottles={bottles.slice(row * columns, (row + 1) * columns)}
            columns={columns}
            artSize={artSize}
            onBottle={onBottle}
            onAdd={
              row === Math.floor(bottles.length / columns) ? onAdd : undefined
            }
          />
        ))}
      </View>
      <View style={s.plinth}>
        <Text style={s.plinthText}>GOOD SCENTS. YOUR SPACE.</Text>
        <View style={s.handle} />
      </View>
    </View>
  );
}
function CabinetRow({
  index,
  bottles,
  columns,
  artSize,
  onBottle,
  onAdd,
}: {
  index: number;
  bottles: BottleType[];
  columns: number;
  artSize: number;
  onBottle: (b: BottleType) => void;
  onAdd?: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const bg = `back${id}`,
    light = `light${id}`,
    edge = `edge${id}`,
    top = `top${id}`;
  return (
    <View style={s.row} testID={`cabinet-row-${index}`}>
      <View style={s.display}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 340 197"
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#102F25" />
                <Stop offset=".55" stopColor="#204A37" />
                <Stop offset="1" stopColor="#16392D" />
              </LinearGradient>
              <RadialGradient id={light} cx="50%" cy="0%" rx="65%" ry="85%">
                <Stop offset="0" stopColor="#F2E7BD" stopOpacity=".24" />
                <Stop offset=".6" stopColor="#DBDFAC" stopOpacity=".07" />
                <Stop offset="1" stopColor="#DFE4A5" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id={top} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#688271" />
                <Stop offset="1" stopColor="#A1AD91" />
              </LinearGradient>
              <LinearGradient id={edge} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#7F957D" />
                <Stop offset=".18" stopColor="#4C6B51" />
                <Stop offset="1" stopColor="#142D22" />
              </LinearGradient>
            </Defs>
            <Rect width="340" height="210" fill={`url(#${bg})`} />
            <Rect width="340" height="174" fill={`url(#${light})`} />
            <Rect
              x="28"
              y="1"
              width="284"
              height="2"
              rx="1"
              fill="#F5E8BB"
              opacity=".65"
            />
            <Rect x="10" width="1" height="172" fill="#071A14" opacity=".65" />
            <Rect x="329" width="1" height="172" fill="#071A14" opacity=".65" />
            <Path d="M11 169 H329 L340 180 H0 Z" fill={`url(#${top})`} />
            <Rect y="180" width="340" height="13" fill={`url(#${edge})`} />
            <Path d="M1 180 H339" stroke="#C7D3B2" opacity=".65" />
            <Rect y="193" width="340" height="4" fill="#071C15" opacity=".85" />
          </Svg>
        </View>
        <View style={s.bottles}>
          {Array.from({ length: columns }, (_, slot) => {
            const b = bottles[slot];
            return (
              <View key={b?.id ?? `empty-${slot}`} style={s.slot}>
                {b ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${b.name}${b.reservedTradeId ? ", reserved for trade" : ""}`}
                    onPress={() => onBottle(b)}
                    style={s.bottleTouch}
                  >
                    <View style={s.contactShadow} />
                    <BottleEntrance>
                      <Bottle bottle={b} size={artSize} alignBase />
                    </BottleEntrance>
                    {b.tradeAvailable && !b.reservedTradeId && (
                      <View style={s.swapDot}>
                        <Feather name="repeat" color={colors.green} size={9} />
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      onAdd && slot === bottles.length
                        ? "Add a bottle to this shelf"
                        : "Empty shelf space"
                    }
                    disabled={!onAdd || slot !== bottles.length}
                    onPress={slot === bottles.length ? onAdd : undefined}
                    style={[s.empty, { height: artSize }]}
                  >
                    <View style={s.emptyOutline}>
                      {onAdd && slot === bottles.length && (
                        <Feather name="plus" size={18} color="#A8B49A" />
                      )}
                    </View>
                    <Text style={s.emptyText}>
                      {onAdd && slot === bottles.length
                        ? "MAKE ROOM"
                        : "SHELF SPACE"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
        <Text style={s.rowNumber}>{String(index + 1).padStart(2, "0")}</Text>
      </View>
      <View style={s.labels}>
        {Array.from({ length: columns }, (_, slot) => {
          const b = bottles[slot];
          return (
            <View
              key={slot}
              style={{ flex: 1, alignItems: "center", paddingHorizontal: 3 }}
            >
              {b ? (
                <>
                  <Text style={s.name}>{b.name}</Text>
                  <Text style={s.details}>
                    {b.sizeMl} ml · {b.remainingPercent}%
                  </Text>
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  cabinet: {
    backgroundColor: "#143728",
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: "#49624A",
    boxShadow: "0 18px 30px #0A231E26",
    overflow: "hidden",
  },
  crown: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
  },
  crownLine: { height: 1, width: 25, backgroundColor: "#6B8061" },
  crownText: {
    fontFamily: fonts.medium,
    fontSize: 8,
    letterSpacing: 2,
    color: "#D2D9BD",
  },
  interior: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0B271D",
  },
  row: { backgroundColor: "#102E23" },
  display: { height: 197 },
  bottles: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 27,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bottleTouch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  contactShadow: {
    position: "absolute",
    bottom: 1,
    width: "80%",
    height: 7,
    backgroundColor: "#071A12",
    opacity: 0.35,
    borderRadius: 50,
    boxShadow: "0 0 7px #00140988",
  },
  swapDot: {
    position: "absolute",
    right: 1,
    bottom: 10,
    backgroundColor: colors.lime,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E402A",
  },
  empty: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
    gap: 9,
    minWidth: 44,
  },
  emptyOutline: {
    height: 55,
    width: 41,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#6B8061",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 6,
    letterSpacing: 1,
    color: "#A8B49A",
  },
  labels: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 32,
    flexDirection: "row",
    zIndex: 1,
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: "#D7DFC9",
    textAlign: "center",
  },
  details: {
    fontFamily: fonts.regular,
    fontSize: 7,
    color: "#9EB299",
    textAlign: "center",
    marginTop: 3,
  },
  rowNumber: {
    position: "absolute",
    top: 12,
    left: 15,
    fontFamily: fonts.regular,
    fontSize: 7,
    color: "#81967D",
    letterSpacing: 1,
  },
  plinth: {
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
  },
  plinthText: {
    fontFamily: fonts.medium,
    fontSize: 6,
    letterSpacing: 2,
    color: "#A8B89A",
  },
  handle: { width: 38, height: 3, borderRadius: 2, backgroundColor: "#839675" },
});
