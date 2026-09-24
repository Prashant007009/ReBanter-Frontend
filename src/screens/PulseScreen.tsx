import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { ScreenGradient } from "@/components/ScreenGradient";
import { StarOffIcon, ArrowUpLeftIcon, AtSignIcon, PlusCircleIcon, UserIcon } from "@/assets/icons";
import { getPulse, markAllRead } from "@/api/pulse";
import { acceptCrewRequest, skipCrewRequest } from "@/api/crew";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Notification } from "@/api/types";

const FILTERS = ["All", "Cheers", "Crew", "Mentions"] as const;
type Filter = (typeof FILTERS)[number];

// Icon-tile tints — 13% washes of the same brand colors used everywhere
// else (cheer orange, accent violet, ink), one per notification type.
const CHEER_TINT = "rgba(226,84,47,0.13)";
const ACCENT_TINT_13 = "rgba(91,60,255,0.13)";
const INK_TINT = "rgba(23,20,18,0.13)";

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
      return `${who} cheered your drop`;
    case "REPLY":
      return `${who} replied`;
    case "CREW_JOINED":
      return `${who} joined your crew`;
    case "CREW_REQUEST":
      return `${who} wants to join your crew`;
    case "MENTION":
      return `${who} mentioned you`;
  }
}

function NotificationIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "CHEER":
      return (
        <View style={[styles.iconTile, { backgroundColor: CHEER_TINT }]}>
          <StarOffIcon size={16} color={colors.cheer} />
        </View>
      );
    case "CREW_JOINED":
      return (
        <View style={[styles.iconTile, { backgroundColor: ACCENT_TINT_13 }]}>
          <UserIcon size={16} color={colors.accent} />
        </View>
      );
    case "REPLY":
      return (
        <View style={[styles.iconTile, { backgroundColor: ACCENT_TINT_13 }]}>
          <ArrowUpLeftIcon size={16} color={colors.accent} />
        </View>
      );
    case "MENTION":
      return (
        <View style={[styles.iconTile, { backgroundColor: INK_TINT }]}>
          <AtSignIcon size={16} color={colors.ink} />
        </View>
      );
    case "CREW_REQUEST":
      return (
        <View style={[styles.iconTile, { backgroundColor: CHEER_TINT }]}>
          <PlusCircleIcon size={16} color={colors.cheer} />
        </View>
      );
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
  useRefreshOnFocus(load);

  const filtered = useMemo(() => items.filter((n) => matchesFilter(n, filter)), [items, filter]);
  const today = useMemo(() => filtered.filter((n) => dayjs(n.createdAt).isAfter(dayjs().startOf("day"))), [filtered]);
  const earlier = useMemo(() => filtered.filter((n) => !dayjs(n.createdAt).isAfter(dayjs().startOf("day"))), [filtered]);

  async function onLetIn(n: Notification) {
    if (!n.actorId) return;
    setResolvedIds((s) => new Set(s).add(n.id));
    try {
      await acceptCrewRequest(n.actorId);
    } catch {
      setResolvedIds((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  }

  async function onSkip(n: Notification) {
    if (!n.actorId) return;
    setResolvedIds((s) => new Set(s).add(n.id));
    try {
      await skipCrewRequest(n.actorId);
    } catch {
      setResolvedIds((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  }

  function renderGroup(label: string, group: Notification[]) {
    if (group.length === 0) return null;
    return (
      <View key={label} style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.cardList}>
          {group.map((item) => {
            const resolved = resolvedIds.has(item.id);
            return (
              <View key={item.id} style={styles.card}>
                <NotificationIcon type={item.type} />
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <View style={{ gap: 2 }}>
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
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScreenGradient style={styles.container}>
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
        style={styles.filtersList}
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
          data={[0]}
          keyExtractor={() => "pulse-body"}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
          renderItem={() => (
            <View>
              {renderGroup("Today", today)}
              {renderGroup("Earlier", earlier)}
              {filtered.length === 0 ? <Text style={styles.empty}>Nothing here yet.</Text> : null}
            </View>
          )}
        />
      )}
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  markAllRead: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accent },
  filtersList: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
  chip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  chipTextActive: { color: "#fff" },
  section: { paddingHorizontal: 16, gap: 8 },
  sectionLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.inkMuted, textTransform: "uppercase" },
  cardList: { gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
  },
  iconTile: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rowText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
  actions: { flexDirection: "row", gap: 8 },
  letIn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  letInText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#fff" },
  skip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  error: { fontFamily: fonts.body, color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { fontFamily: fonts.body, color: colors.inkMuted, textAlign: "center", marginTop: 30 },
});
