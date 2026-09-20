import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ZapIcon, UserPlusIcon, ReplyIcon, MentionIcon, UserIcon } from "@/assets/icons";
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

function NotificationIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "CHEER":
      return (
        <View style={[styles.iconTile, { backgroundColor: colors.cheerTint }]}>
          <ZapIcon size={18} color={colors.cheer} />
        </View>
      );
    case "CREW_JOINED":
      return (
        <View style={[styles.iconTile, { backgroundColor: colors.accentTint }]}>
          <UserPlusIcon size={18} color={colors.accent} />
        </View>
      );
    case "REPLY":
      return (
        <View style={[styles.iconTile, { backgroundColor: "#E7F2EA" }]}>
          <ReplyIcon size={18} color="#2F6A50" strokeWidth={2} />
        </View>
      );
    case "MENTION":
      return (
        <View style={[styles.iconTile, { backgroundColor: "#FBF1DC" }]}>
          <MentionIcon size={18} color="#A97F21" />
        </View>
      );
    case "CREW_REQUEST":
      return (
        <View style={[styles.iconTile, { backgroundColor: colors.accentTint }]}>
          <UserIcon size={18} color={colors.accent} />
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

  const filtered = useMemo(() => items.filter((n) => matchesFilter(n, filter)), [items, filter]);
  const today = useMemo(() => filtered.filter((n) => dayjs(n.createdAt).isAfter(dayjs().startOf("day"))), [filtered]);
  const earlier = useMemo(() => filtered.filter((n) => !dayjs(n.createdAt).isAfter(dayjs().startOf("day"))), [filtered]);

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

  function renderGroup(label: string, group: Notification[]) {
    if (group.length === 0) return null;
    return (
      <View key={label}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.card}>
          {group.map((item, index) => {
            const resolved = resolvedIds.has(item.id);
            return (
              <View key={item.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                <NotificationIcon type={item.type} />
                <View style={{ flex: 1, minWidth: 0 }}>
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
                ) : item.actor && (item.type === "CHEER" || item.type === "REPLY") ? (
                  <Avatar handle={item.actor.handle} displayName={item.actor.displayName} avatarUrl={item.actor.avatarUrl} size={44} radius={13} />
                ) : item.type === "CREW_JOINED" ? (
                  <View style={styles.tuneIn}>
                    <Text style={styles.tuneInText}>Tune in</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
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
          data={[0]}
          keyExtractor={() => "pulse-body"}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: 24 }}
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
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, paddingHorizontal: 20, marginBottom: 10 },
  card: { marginHorizontal: 16, marginBottom: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 15, paddingVertical: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  iconTile: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 3 },
  actions: { flexDirection: "row", gap: 7 },
  letIn: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 11 },
  letInText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surfaceRaised },
  skip: { backgroundColor: colors.chipMuted, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 11 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  tuneIn: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 11 },
  tuneInText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surfaceRaised },
  error: { color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 30 },
});
