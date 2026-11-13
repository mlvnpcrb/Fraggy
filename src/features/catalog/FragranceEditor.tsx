import React, { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import {
  customEntry,
  effectiveDetails,
  type CatalogFragrance,
  type CatalogSearchPage,
  type FragranceDetails,
  type FragranceEntry,
} from "../../../supabase/functions/_shared/catalog";
import type { BottleForm } from "../../beta/types";
import {
  Body,
  Button,
  Card,
  Field,
  Feedback,
  useAction,
  styles,
} from "../../beta/ui";
import { useBeta } from "../../beta/context";
import { createCatalogApi } from "./api";
export function FragranceSummary({ entry }: { entry?: FragranceEntry | null }) {
  if (!entry) return <Body>Collector-entered details</Body>;
  const d = effectiveDetails(entry);
  return (
    <Card>
      <Text style={styles.label}>FRAGRANCE PROFILE</Text>
      {!!d.concentration && <Body>{d.concentration}</Body>}
      {!!d.family && <Body>Family · {d.family}</Body>}
      {(["top", "heart", "base", "unstructuredNotes"] as const).map((k) =>
        d[k]?.length ? (
          <Body key={k}>
            {k === "unstructuredNotes"
              ? "Notes"
              : k === "heart"
                ? "Heart notes"
                : `${k[0].toUpperCase() + k.slice(1)} notes`}{" "}
            · {d[k].join(", ")}
          </Body>
        ) : null,
      )}
      {!d.top.length &&
        !d.heart.length &&
        !d.base.length &&
        !d.unstructuredNotes.length && (
          <Body>No fragrance notes supplied.</Body>
        )}
      {entry.source === "scento" && entry.reference ? (
        <>
          <Text
            accessibilityRole="link"
            onPress={() => void Linking.openURL(entry.reference!.sourceUrl)}
            style={[styles.body, { textDecorationLine: "underline" }]}
          >
            Fragrance details: Scento Perfume API, scento.com
          </Text>
          <Body>
            Retrieved {new Date(entry.reference.fetchedAt).toLocaleDateString()}
            {Object.keys(entry.overrides).length
              ? " · Collector-modified details"
              : ""}
          </Body>
        </>
      ) : (
        <Body>Collector-entered details</Body>
      )}
      <Body>
        Fragrance information does not verify this bottle’s authenticity or
        condition.
      </Body>
    </Card>
  );
}
export function FragranceEditor({
  value,
  onChange,
}: {
  value: BottleForm;
  onChange: (v: BottleForm) => void;
}) {
  const b = useBeta(),
    a = useAction();
  const catalog = createCatalogApi(b.mode, b.session!.user.id);
  const [query, setQuery] = useState(""),
    [page, setPage] = useState<CatalogSearchPage | null>(null),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(""),
    [lookup, setLookup] = useState(!value.fragrance),
    [candidate, setCandidate] = useState<CatalogFragrance | null>(null),
    [expand, setExpand] = useState(false);
  const generation = useRef(0),
    latest = useRef(value);
  latest.current = value;
  const source =
      value.fragrance || customEntry({ brand: value.brand, name: value.name }),
    details = effectiveDetails(source);
  const patch = (change: Partial<FragranceDetails>) => {
    const v = latest.current,
      entry = v.fragrance || customEntry({ brand: v.brand, name: v.name });
    const next = {
      ...entry,
      overrides:
        entry.source === "scento" ? { ...entry.overrides, ...change } : {},
      details:
        entry.source === "custom"
          ? { ...entry.details, ...change }
          : entry.details,
    };
    const effective = effectiveDetails(next);
    onChange({
      ...v,
      brand: effective.brand,
      name: effective.name,
      fragrance: next,
    });
  };
  useEffect(() => {
    const token = ++generation.current;
    setCandidate(null);
    setPage(null);
    setError("");
    if (!lookup || query.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      catalog
        .searchFragrances(query.trim())
        .then((result) => {
          if (generation.current === token) setPage(result);
        })
        .catch((error: unknown) => {
          if (generation.current === token)
            setError(
              error instanceof Error
                ? error.message
                : "Scento is unavailable. Try again or enter details yourself.",
            );
        })
        .finally(() => {
          if (generation.current === token) setSearching(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      ++generation.current;
    };
  }, [query, lookup, b.mode]);
  const preview = async (id: string, name?: string, brand?: string) => {
    const token = ++generation.current;
    await a.act(async () => {
      const result = await catalog.getFragrance(id, name, brand);
      if (generation.current === token) setCandidate(result);
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>Fragrance details</Text>
      <Body>Search Scento for notes, or enter your own fragrance.</Body>
      {!lookup && (
        <Button
          title="Find on Scento"
          secondary
          onPress={() => setLookup(true)}
        />
      )}
      <Button
        title={lookup ? "Enter details myself" : "Custom fragrance"}
        secondary
        onPress={() => {
          ++generation.current;
          setLookup(false);
          setCandidate(null);
          onChange({ ...value, fragrance: customEntry(details) });
        }}
      />
      {lookup && (
        <Card>
          <Field
            label="Search brand or fragrance"
            value={query}
            onChangeText={setQuery}
            maxLength={160}
            autoCorrect={false}
          />
          <Feedback busy={searching || a.busy} error={error || a.error} />
          {b.mode === "demo" && (
            <Body>
              Demo catalog only. Search “sample”. Live Scento search is
              available after signing in with a collector account.
            </Body>
          )}
          {page?.stale && (
            <Body>
              Showing a saved catalog response. Scento is unavailable.
            </Body>
          )}
          {!!page?.unavailableCount && (
            <Body>
              Some Scento results have no usable fragrance profile link. Showing
              available matches; custom entry is always available.
            </Body>
          )}
          {!!page?.results.length && (
            <Body>
              Search suggestions. Check the fragrance, house and concentration
              before choosing.
            </Body>
          )}
          {page?.results.map((item) => (
            <Button
              key={item.id}
              title={`${item.brand} · ${item.name}${item.concentration ? " · " + item.concentration : ""}`}
              secondary
              disabled={a.busy}
              onPress={() => void preview(item.id, item.name, item.brand)}
            />
          ))}
          {page && !page.results.length && !page.unavailableCount && (
            <Body>No match found. Try another name or add it yourself.</Body>
          )}
          {page?.continuation && (
            <Button
              title="More results"
              secondary
              disabled={a.busy}
              onPress={() => {
                const token = generation.current;
                void a.act(async () => {
                  const next = await catalog.searchFragrances(
                    query.trim(),
                    page.continuation || undefined,
                  );
                  if (token === generation.current)
                    setPage({
                      results: [
                        ...page.results,
                        ...next.results.filter(
                          (n) => !page.results.some((p) => p.id === n.id),
                        ),
                      ],
                      continuation: next.continuation,
                      unavailableCount:
                        (page.unavailableCount || 0) +
                        (next.unavailableCount || 0),
                    });
                });
              }}
            />
          )}
        </Card>
      )}
      {value.fragrance?.source === "scento" && value.fragrance.reference && (
        <Button
          title="Check for updated Scento details"
          secondary
          disabled={a.busy}
          onPress={() =>
            void preview(
              value.fragrance!.reference!.id,
              value.fragrance!.details.name,
              value.fragrance!.details.brand,
            )
          }
        />
      )}
      {candidate && (
        <>
          <FragranceSummary
            entry={{
              source: "scento",
              reference: candidate.reference,
              details: candidate.details,
              overrides: {},
            }}
          />
          {candidate.stale && (
            <Body>
              This is a saved profile; the provider could not be refreshed.
            </Body>
          )}
          <Body>
            Applying this match replaces the fragrance fields below. Your bottle
            condition and personal comments stay intact.
          </Body>
          <Button
            title="Use this fragrance"
            onPress={() => {
              onChange({
                ...latest.current,
                brand: candidate.details.brand,
                name: candidate.details.name,
                fragrance: {
                  source: "scento",
                  reference: candidate.reference,
                  details: candidate.details,
                  overrides: {},
                },
              });
              setLookup(false);
              setCandidate(null);
            }}
          />
        </>
      )}

      {(!lookup || value.fragrance) && (
        <>
          <Field
            label="Brand"
            value={value.brand}
            onChangeText={(brand) => patch({ brand })}
            maxLength={80}
          />
          <Field
            label="Fragrance"
            value={value.name}
            onChangeText={(name) => patch({ name })}
            maxLength={100}
          />
          <Button
            title={
              expand ? "Hide fragrance notes" : "Notes and fragrance details"
            }
            secondary
            onPress={() => setExpand(!expand)}
          />
          {expand && (
            <>
              <Field
                label="Concentration (optional)"
                value={details.concentration || ""}
                onChangeText={(concentration) => patch({ concentration })}
                maxLength={160}
              />
              <Field
                label="Scent family (optional)"
                value={details.family || ""}
                onChangeText={(family) => patch({ family })}
                maxLength={160}
              />
              {(["top", "heart", "base", "unstructuredNotes"] as const).map(
                (k) => (
                  <Field
                    key={k}
                    label={
                      k === "unstructuredNotes"
                        ? "Other notes · comma separated"
                        : `${k === "heart" ? "Heart" : k === "top" ? "Top" : "Base"} notes · comma separated`
                    }
                    value={details[k].join(",")}
                    onChangeText={(raw) =>
                      patch({ [k]: raw.split(",").slice(0, 24) })
                    }
                    maxLength={500}
                  />
                ),
              )}
            </>
          )}
          {value.fragrance && expand && (
            <FragranceSummary entry={value.fragrance} />
          )}
          {value.fragrance?.source === "scento" && !expand && (
            <Body>Matched with Scento · notes saved with this bottle.</Body>
          )}
        </>
      )}
    </View>
  );
}
