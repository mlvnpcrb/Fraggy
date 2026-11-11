import React, { useId } from "react";
import { Image, Text, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Ellipse,
  Text as SvgText,
  Path,
} from "react-native-svg";
import type { Bottle as BottleType } from "../domain/types";
export function Bottle({
  bottle,
  size = 170,
  alignBase = false,
}: {
  bottle: BottleType;
  size?: number;
  alignBase?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const glass = `g${id}`,
    cap = `c${id}`;
  if (bottle.imageUri) {
    const width = size * 0.74;
    const ratio =
      bottle.imageWidth && bottle.imageHeight
        ? bottle.imageWidth / bottle.imageHeight
        : 0.74;
    const imageWidth = Math.min(width, size * ratio),
      imageHeight = Math.min(size, width / ratio);
    return (
      <View
        style={{
          width,
          height: size,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Image
          accessibilityLabel={`${bottle.name}, ${bottle.imageKind === "cutout" ? "background removed" : "original photo"}`}
          source={{ uri: bottle.imageUri }}
          style={{ width: imageWidth, height: imageHeight }}
          resizeMode="contain"
        />
      </View>
    );
  }
  if (bottle.imageKind !== "sample-cutout")
    return (
      <View
        style={{
          width: size * 0.74,
          height: size,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#C6D3BC", fontSize: 11 }}>
          Photo unavailable
        </Text>
      </View>
    );
  const blue = bottle.art === "blue",
    green = bottle.art === "green",
    rose = bottle.art === "rose";
  const tint = blue
    ? ["#102B40", "#436077", "#0B2435"]
    : green
      ? ["#3E4A21", "#A6B66E", "#454A25"]
      : rose
        ? ["#DDB39B", "#F6E8CB", "#B58464"]
        : ["#B58A4D", "#F0DDA7", "#B78A45"];
  return (
    <View
      accessible
      accessibilityLabel={`${bottle.name}, illustrated sample bottle`}
      style={{ width: size * 0.74, height: size }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={alignBase ? "0 0 160 204" : "0 0 160 220"}
        preserveAspectRatio={alignBase ? "none" : "xMidYMid meet"}
      >
        <Defs>
          <LinearGradient id={glass} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint[0]} />
            <Stop offset=".13" stopColor={tint[1]} />
            <Stop offset=".30" stopColor={tint[0]} />
            <Stop offset=".55" stopColor={tint[1]} />
            <Stop offset="1" stopColor={tint[2]} />
          </LinearGradient>
          <LinearGradient id={cap}>
            <Stop offset="0" stopColor="#121C18" />
            <Stop offset=".45" stopColor="#3A4139" />
            <Stop offset=".8" stopColor="#0E1613" />
            <Stop offset="1" stopColor="#29322B" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="80" cy="208" rx="57" ry="7" fill="#17291F" opacity=".10" />
        <Rect x="59" y="37" width="42" height="24" rx="3" fill="#A99E7A" />
        <Rect
          x={green ? 48 : 51}
          y="8"
          width={green ? 64 : 58}
          height="38"
          rx={rose ? 13 : 5}
          fill={`url(#${cap})`}
        />
        <Path
          d={
            green
              ? "M45 62 Q26 67 26 92 L26 190 Q26 203 40 203 L120 203 Q134 203 134 190 L134 92 Q134 67 115 62 Z"
              : "M38 60 L122 60 Q132 60 132 72 L132 189 Q132 203 119 203 L41 203 Q28 203 28 189 L28 72 Q28 60 38 60 Z"
          }
          fill={`url(#${glass})`}
          stroke={blue ? "#203C4D" : "#9C9375"}
          strokeWidth="1"
        />
        <Path
          d="M36 77 L36 184 Q36 193 44 193"
          fill="none"
          stroke="white"
          strokeWidth="3"
          opacity=".4"
        />
        <Path
          d="M124 78 L124 184"
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity=".22"
        />
        <Rect
          x="41"
          y="104"
          width="78"
          height="64"
          rx="1"
          fill={blue ? "#123046" : "#F3EFDF"}
          opacity={blue ? 0.55 : 0.96}
        />
        <SvgText
          x="80"
          y="125"
          textAnchor="middle"
          fontSize={bottle.brand.length > 12 ? 6 : 9}
          fontWeight="bold"
          fill={blue ? "#F8F4E9" : "#242C24"}
          letterSpacing="1"
        >
          {bottle.brand}
        </SvgText>
        <SvgText
          x="80"
          y="143"
          textAnchor="middle"
          fontSize={bottle.name.length > 13 ? 7 : 9}
          fill={blue ? "#F8F4E9" : "#242C24"}
        >
          {bottle.name.toUpperCase()}
        </SvgText>
        <SvgText
          x="80"
          y="157"
          textAnchor="middle"
          fontSize="4.5"
          letterSpacing="1"
          fill={blue ? "#CFDAD9" : "#6A6A5B"}
        >
          EAU DE PARFUM · {bottle.sizeMl} ML
        </SvgText>
        <Path
          d="M40 198 L120 198"
          stroke="white"
          strokeWidth="3"
          opacity=".3"
        />
      </Svg>
    </View>
  );
}
