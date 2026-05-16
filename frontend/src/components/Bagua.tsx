import React from "react";
import Svg, { Circle, G, Path, Defs, RadialGradient, Stop } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  glowColor?: string;
};

// Earlier Heaven (Fu Xi) sequence — clockwise from top.
// 1 = solid (yang), 0 = broken (yin). Read bottom→top.
const TRIGRAMS: Array<[number, number, number]> = [
  [1, 1, 1],
  [1, 1, 0],
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
];

export const Bagua: React.FC<Props> = ({
  size = 520,
  color = "#FFFFFF",
  opacity = 0.16,
  glowColor = "#E8DCC4",
}) => {
  const cx = size / 2;
  const cy = size / 2;

  const rOuter = size * 0.48;
  const rOuterInner = size * 0.44;
  const rInner = size * 0.30;
  const rInnerInner = size * 0.275;
  const rTaiji = size * 0.105;

  const lineWidth = size * 0.16;
  const lineThickness = size * 0.022;
  const gapBetween = size * 0.018;
  const halfSolid = lineWidth / 2;
  const brokenSegW = (lineWidth - size * 0.034) / 2;
  const trigramTrackInner = size * 0.32;
  const lineRadii = [
    trigramTrackInner + lineThickness / 2,
    trigramTrackInner + lineThickness / 2 + (lineThickness + gapBetween),
    trigramTrackInner + lineThickness / 2 + 2 * (lineThickness + gapBetween),
  ];

  const makeRectPath = (centerX: number, centerY: number, w: number, t: number, cosθ: number, sinθ: number) => {
    const radX = sinθ;
    const radY = -cosθ;
    const perpX = cosθ;
    const perpY = sinθ;
    const hw = w / 2;
    const ht = t / 2;
    const ax = centerX + perpX * -hw + radX * -ht;
    const ay = centerY + perpY * -hw + radY * -ht;
    const bx = centerX + perpX * hw + radX * -ht;
    const by = centerY + perpY * hw + radY * -ht;
    const cx2 = centerX + perpX * hw + radX * ht;
    const cy2 = centerY + perpY * hw + radY * ht;
    const dx = centerX + perpX * -hw + radX * ht;
    const dy = centerY + perpY * -hw + radY * ht;
    return `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}L${cx2.toFixed(2)} ${cy2.toFixed(2)}L${dx.toFixed(2)} ${dy.toFixed(2)}Z`;
  };

  const lineOpacity = Math.min(1, opacity * 2.2);
  const ringOpacity = Math.min(1, opacity * 1.4);
  const ringSoftOpacity = Math.min(1, opacity);
  const innerRingOpacity = Math.min(1, opacity * 1.3);
  const innerRingSoftOpacity = Math.min(1, opacity * 0.7);
  const taijiOpacity = Math.min(1, opacity * 1.6);
  const taijiDotOpacity = Math.min(1, opacity * 2.6);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={glowColor} stopOpacity={opacity * 0.55} />
          <Stop offset="65%" stopColor={glowColor} stopOpacity={opacity * 0.22} />
          <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Circle cx={cx} cy={cy} r={rOuter * 1.05} fill="url(#halo)" />

      <Circle cx={cx} cy={cy} r={rOuter} stroke={color} strokeOpacity={ringOpacity} strokeWidth={size * 0.0035} fill="none" />
      <Circle cx={cx} cy={cy} r={rOuterInner} stroke={color} strokeOpacity={ringSoftOpacity} strokeWidth={size * 0.0025} fill="none" />
      <Circle cx={cx} cy={cy} r={rInner} stroke={color} strokeOpacity={innerRingOpacity} strokeWidth={size * 0.003} fill="none" />
      <Circle cx={cx} cy={cy} r={rInnerInner} stroke={color} strokeOpacity={innerRingSoftOpacity} strokeWidth={size * 0.002} fill="none" />

      {TRIGRAMS.map((trig, i) => {
        const angle = i * 45;
        const θ = (angle * Math.PI) / 180;
        const cosθ = Math.cos(θ);
        const sinθ = Math.sin(θ);
        return (
          <G key={`trig-${i}`}>
            {trig.map((seg, j) => {
              const r = lineRadii[j];
              const baseCx = cx + sinθ * r;
              const baseCy = cy - cosθ * r;
              if (seg === 1) {
                return (
                  <Path
                    key={`s-${i}-${j}`}
                    d={makeRectPath(baseCx, baseCy, lineWidth, lineThickness, cosθ, sinθ)}
                    fill={color}
                    fillOpacity={lineOpacity}
                  />
                );
              }
              const offset = halfSolid - brokenSegW / 2;
              const leftCx = baseCx + cosθ * -offset;
              const leftCy = baseCy + sinθ * -offset;
              const rightCx = baseCx + cosθ * offset;
              const rightCy = baseCy + sinθ * offset;
              return (
                <G key={`b-${i}-${j}`}>
                  <Path
                    d={makeRectPath(leftCx, leftCy, brokenSegW, lineThickness, cosθ, sinθ)}
                    fill={color}
                    fillOpacity={lineOpacity}
                  />
                  <Path
                    d={makeRectPath(rightCx, rightCy, brokenSegW, lineThickness, cosθ, sinθ)}
                    fill={color}
                    fillOpacity={lineOpacity}
                  />
                </G>
              );
            })}
          </G>
        );
      })}

      {/* Taijitu — simplified */}
      <Circle cx={cx} cy={cy} r={rTaiji} stroke={color} strokeOpacity={taijiOpacity} strokeWidth={size * 0.0035} fill="none" />
      <Path
        d={`M ${cx} ${cy - rTaiji} A ${rTaiji / 2} ${rTaiji / 2} 0 0 1 ${cx} ${cy} A ${rTaiji / 2} ${rTaiji / 2} 0 0 0 ${cx} ${cy + rTaiji}`}
        stroke={color}
        strokeOpacity={taijiOpacity}
        strokeWidth={size * 0.0028}
        fill="none"
      />
      <Circle cx={cx} cy={cy - rTaiji / 2} r={size * 0.008} fill={color} fillOpacity={taijiDotOpacity} />
      <Circle cx={cx} cy={cy + rTaiji / 2} r={size * 0.008} fill={color} fillOpacity={taijiDotOpacity} />
    </Svg>
  );
};
