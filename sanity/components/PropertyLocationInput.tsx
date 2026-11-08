"use client";
/**
 * Studio input for the property "location" (geopoint) field. Stage B1: typed or pasted coordinates, no map yet.
 * Writes { _type: "geopoint", lat, lng } (6 decimals, no altitude) or removes the value. Replaces the input of THIS field only.
 */
import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { set, unset, type ObjectInputProps } from "sanity";
import { Box, Button, Card, Flex, Label, Stack, Text, TextInput } from "@sanity/ui";
import { isValidCoordinate } from "../../lib/geo.ts";
import { MESSAGES, formatCoord, parseCoordinate, parseCoordinatePair, readPoint, roundCoord, toGeopoint } from "../../lib/location-validation.ts";

export default function PropertyLocationInput(props: ObjectInputProps) {
  const { value, onChange, readOnly } = props;
  const point = readPoint(value);
  const hasValue = value !== undefined && value !== null;
  const id = useId();
  const [latText, setLatText] = useState(point ? formatCoord(point.lat) : "");
  const [lngText, setLngText] = useState(point ? formatCoord(point.lng) : "");
  const [touched, setTouched] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const lat = point?.lat, lng = point?.lng;

  // Keep the boxes in step when the stored value changes from outside (undo / redo / another editor),
  // but never rewrite what the editor is typing if it already means the same number.
  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setLatText((cur) => (parseCoordinate(cur) !== null ? "" : cur));
      setLngText((cur) => (parseCoordinate(cur) !== null ? "" : cur));
      return;
    }
    setLatText((cur) => (parseCoordinate(cur) === lat ? cur : formatCoord(lat)));
    setLngText((cur) => (parseCoordinate(cur) === lng ? cur : formatCoord(lng)));
  }, [lat, lng]);

  /** Writes the value only when both boxes hold a valid point; clears the field when both boxes are empty. */
  const apply = (a: string, b: string) => {
    if (a.trim() === "" && b.trim() === "") { if (hasValue) onChange(unset()); return; }
    const la = parseCoordinate(a), ln = parseCoordinate(b);
    if (la === null || ln === null || !isValidCoordinate(la, ln)) return;
    if (point && point.lat === roundCoord(la) && point.lng === roundCoord(ln)) return;
    onChange(set(toGeopoint(la, ln)));
  };

  const fieldError = (() => {
    const a = latText.trim(), b = lngText.trim();
    if (a === "" && b === "") return null;
    if (a === "" || b === "") return MESSAGES.incomplete;
    const la = parseCoordinate(a), ln = parseCoordinate(b);
    if (la === null || ln === null) return MESSAGES.fieldFormat;
    return isValidCoordinate(la, ln) ? null : MESSAGES.range;
  })();
  const showError = touched && fieldError !== null;

  const onLat = (e: ChangeEvent<HTMLInputElement>) => { const v = e.currentTarget.value; setLatText(v); apply(v, lngText); };
  const onLng = (e: ChangeEvent<HTMLInputElement>) => { const v = e.currentTarget.value; setLngText(v); apply(latText, v); };

  const applyPaste = () => {
    const r = parseCoordinatePair(pasteText);
    if (!r.ok) { setPasteError(r.reason === "empty" ? MESSAGES.pasteEmpty : r.reason === "range" ? MESSAGES.range : MESSAGES.pasteFormat); return; }
    setPasteError(null); setTouched(true); setPasteText("");
    setLatText(formatCoord(r.lat)); setLngText(formatCoord(r.lng));
    onChange(set(toGeopoint(r.lat, r.lng)));
  };
  const clear = () => {
    setLatText(""); setLngText(""); setPasteText(""); setPasteError(null); setTouched(false);
    if (hasValue) onChange(unset());
  };

  return (
    <Stack space={3} data-testid="location-input" data-status={point ? "set" : "empty"}>
      <Card padding={3} radius={2} border tone={point ? "positive" : "default"}>
        <Text size={1}>
          {point ? `Pin təyin olunub: ${formatCoord(point.lat)}, ${formatCoord(point.lng)}` : "Pin qoyulmayıb. Bu elan xəritə axtarışında görünməyəcək (saytda isə normal işləyir)."}
        </Text>
      </Card>

      <Flex gap={3}>
        <Stack space={2} flex={1}>
          <Label as="label" size={1} htmlFor={`${id}-lat`}>Enlik (latitude)</Label>
          <TextInput id={`${id}-lat`} value={latText} onChange={onLat} onBlur={() => setTouched(true)} readOnly={readOnly} inputMode="decimal"
            placeholder="40.409300" aria-invalid={showError} aria-describedby={showError ? `${id}-err` : undefined} />
        </Stack>
        <Stack space={2} flex={1}>
          <Label as="label" size={1} htmlFor={`${id}-lng`}>Uzunluq (longitude)</Label>
          <TextInput id={`${id}-lng`} value={lngText} onChange={onLng} onBlur={() => setTouched(true)} readOnly={readOnly} inputMode="decimal"
            placeholder="49.867100" aria-invalid={showError} aria-describedby={showError ? `${id}-err` : undefined} />
        </Stack>
      </Flex>
      {showError && (
        <Card id={`${id}-err`} role="alert" padding={2} radius={2} tone="critical"><Text size={1}>{fieldError}</Text></Card>
      )}

      <Stack space={2}>
        <Label as="label" size={1} htmlFor={`${id}-paste`}>Koordinatları birlikdə yapışdırın</Label>
        <Flex gap={2}>
          <Box flex={1}>
            <TextInput id={`${id}-paste`} value={pasteText} readOnly={readOnly} placeholder="40.4093, 49.8671"
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setPasteText(e.currentTarget.value); setPasteError(null); }}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); applyPaste(); } }}
              aria-invalid={pasteError !== null} aria-describedby={pasteError ? `${id}-paste-err` : undefined} />
          </Box>
          <Button text="Tətbiq et" mode="ghost" disabled={readOnly || pasteText.trim() === ""} onClick={applyPaste} />
        </Flex>
        {pasteError && <Card id={`${id}-paste-err`} role="alert" padding={2} radius={2} tone="critical"><Text size={1}>{pasteError}</Text></Card>}
      </Stack>

      <Flex>
        <Button text="Pini sil" tone="critical" mode="ghost" disabled={readOnly || (!hasValue && latText === "" && lngText === "")} onClick={clear} />
      </Flex>
      <Text size={1} muted>Koordinatları xəritə xidmətindən kopyalayıb yuxarıdakı xanaya yapışdıra bilərsiniz (əvvəl enlik, sonra uzunluq).</Text>
    </Stack>
  );
}
