import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { getPulse, markAllRead } from "@/api/pulse";
import { acceptCrewRequest, skipCrewRequest } from "@/api/crew";
import type { Notification } from "@/api/types";

const FILTERS = ["All", "Cheers", "Crew", "Mentions"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(n: Notification, filter: Filter): boolean {
  if (filter === "All") return true;
  if (filter === "Cheers") return n.type === "CHEER";
  if (filter === "Crew") return n.type === "CREW_JOINED" || n.type === "CREW_REQUEST";
  return n.type === "MENTION";
}

function describe(n: Notification): string {
  const who = n.actor?.displayName ?? "Someone";
  switch (n.type) {
    case "CHEER":
      return `${who} cheered your drop.`;
    case "REPLY":
      return `${who} replied to your drop.`;
    case "CREW_JOINED":
      return `${who} joined your crew.`;
    case "CREW_REQUEST":
      return `${who} wants to join your crew.`;
    case "MENTION":
      return `${who} mentioned you.`;
  }
}

export function PulseScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getPulse();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load Pulse");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => items.filter((n) => matchesFilter(n, filter)), [items, filter]);

  async function onLetIn(n: Notification) {
    if (!n.crewId || !n.actorId) return;
    setResolvedIds((s) => new Set(s).add(n.id));
    try {
      await acceptCrewRequest(n.crewId, n.actorId);
    } catch {
      setResolvedIds((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  }

  async function onSkip(n: Notification) {
    if (!n.crewId || !n.actorId) return;
    setResolvedIds((s) => new Set(s).add(n.id));
    try {
      await skipCrewRequest(n.crewId, n.actorId);
    } catch {
      setResolvedIds((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pulse</Text>
        <Pressable
          onPress={async () => {
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            try {
              await markAllRead();
            } catch {
              // best-effort — a refresh will resync
            }
          }}
        >
          <Text style={styles.markAllRead}>Mark all read</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable onPress={() => setFilter(item)} style={[styles.chip, filter === item && styles.chipActive]}>
            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={load}
          refreshing={isLoading}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
          renderItem={({ item }) => {
            const resolved = resolvedIds.has(item.id);
            return (
              <View style={styles.row}>
                <Avatar
                  handle={item.actor?.handle ?? "?"}
                  displayName={item.actor?.displayName ?? "?"}
                  avatarUrl={item.actor?.avatarUrl}
                  size={40}
                  radius={14}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{describe(item)}</Text>
                  <Text style={styles.rowTime}>{dayjs(item.createdAt).fromNow()}</Text>
                </View>
                {item.type === "CREW_REQUEST" && !resolved ? (
                  <View style={styles.actions}>
                    <Pressable style={styles.letIn} onPress={() => onLetIn(item)}>
                      <Text style={styles.letInText}>Let in</Text>
                    </Pressable>
                    <Pressable style={styles.skip} onPress={() => onSkip(item)}>
                      <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  markAllRead: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accent, paddingBottom: 4 },
  filters: { paddingHorizontal: 16, gap: 8, paddingBottom: 18 },
  chip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.surfaceRaised, fontFamily: fonts.bodyBold },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 20, paddingVertical: 12 },
  rowText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 3 },
  actions: { flexDirection: "row", gap: 7 },
  letIn: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 11 },
  letInText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surfaceRaised },
  skip: { backgroundColor: "#F4F0E9", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 11 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  error: { color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 30 },
});
