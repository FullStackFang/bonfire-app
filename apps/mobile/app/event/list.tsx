import { Fragment, useCallback, useMemo } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { User } from "@bonfire/shared";
import { Avatar, ChunkyPressable, CTAButton, IconButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { useMapEvents, usePeople } from "../../lib/data";
import { useSession } from "../../lib/session";
import { useUserLocation } from "../../lib/useUserLocation";
import { MOCK_CENTER } from "../../lib/mockSeeds";
import { distanceKm } from "../../lib/geo";
import { getEventStatus, type EventStatus, type MapEvent } from "../../lib/mockEventStore";

// Same radius as the home-screen footer pill. Keeping them in lockstep so
// the count in the pill and the count on this screen always match.
const NEARBY_RADIUS_KM = 8;

type Row = MapEvent & {
  distanceKm: number;
  isHost: boolean;
  status: EventStatus;
  host: User | undefined;
};

export default function EventList() {
  const { user } = useSession();
  const events = useMapEvents();
  const { byId } = usePeople();
  const userLocation = useUserLocation(MOCK_CENTER);
  const userCenter = userLocation?.coords ?? null;

  const rows = useMemo<Row[]>(() => {
    if (!userCenter) return [];
    return events
      .map((e) => ({
        ...e,
        distanceKm: distanceKm(userCenter, { lat: e.lat, lng: e.lng }),
        isHost: !!user && e.host_id === user.id,
        status: getEventStatus(e),
        host: byId.get(e.host_id),
      }))
      .filter((e) => e.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [events, userCenter, user?.id, byId]);

  // replace, not push: opening the detail modal on top of the list modal
  // would stack two slide-from-bottom presentations and feel sticky.
  const open = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.replace(`/event/${id}`);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 4,
          paddingBottom: 8,
          alignItems: "flex-end",
        }}
      >
        <IconButton
          icon="close"
          variant="ghost"
          size={40}
          iconSize={22}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 40,
          // 6pt gap + the chunky-press 5pt under-shadow = ~11pt visual
          // rhythm between rows.
          rowGap: 6,
        }}
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 ? (
          <EmptyBlock />
        ) : (
          rows.map((row, idx) => (
            <Fragment key={row.id}>
              <EventRow row={row} onPress={() => open(row.id)} />
              {idx === 3 && rows.length > 4 ? <EllipsisRest /> : null}
            </Fragment>
          ))
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          backgroundColor: light.cream,
        }}
      >
        <CTAButton
          label="Drop a new bonfire"
          leftIcon={<Ionicons name="add" size={18} color={light.hearth} />}
          haptic="success"
          onPress={() => {
            if (!userCenter) return;
            router.replace({
              pathname: "/event/new",
              params: { lat: String(userCenter.lat), lng: String(userCenter.lng) },
            });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function EllipsisRest() {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
      }}
    >
      <T
        style={{
          fontFamily: "SourceSerif4_400Regular_Italic",
          fontSize: 28,
          lineHeight: 28,
          color: light.smoke,
          letterSpacing: 4,
        }}
      >
        ...
      </T>
    </View>
  );
}

function EventRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const { host } = row;
  const isLive = row.status === "live";
  const isUpcoming = row.status === "upcoming";
  // Upcoming events count down to start; live/ended count down to expiry.
  const countdownTarget = isUpcoming ? row.starts_at : row.expires_at;
  const remainingLabel = formatRemaining(countdownTarget);
  const distanceLabel = formatDistance(row.distanceKm);

  // Hosted rows wear the brand accent on the shadow underneath instead of
  // an inline chip; the face's hairline border matches so the depth reads
  // as one intentional layer.
  const shadowColor = row.isHost ? light.emberDeep : light.warmShadow;

  return (
    <ChunkyPressable
      onPress={onPress}
      shadowColor={shadowColor}
      depth={5}
      radius={16}
      haptic="selection"
      accessibilityLabel={`${row.title}, ${distanceLabel} away, ${isUpcoming ? "starts in" : ""} ${remainingLabel}${row.isHost ? ", you are hosting" : ""}`}
    >
      <View
        style={{
          backgroundColor: light.hearth,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: shadowColor,
          paddingHorizontal: 14,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          columnGap: 12,
        }}
      >
        {host ? (
          <Avatar
            label={host.letter_pair}
            color={host.avatar_color}
            name={host.display_name}
            size="md"
            live={isLive}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: light.cream,
              borderWidth: 1,
              borderColor: light.ash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="flame" size={18} color={light.smoke} />
          </View>
        )}

        <View style={{ flex: 1, rowGap: 4, minWidth: 0 }}>
          {row.isHost ? (
            <T
              variant="overline"
              color={light.ember}
              style={{ fontFamily: "Onest_600SemiBold", letterSpacing: 1.2 }}
            >
              HOSTING
            </T>
          ) : null}
          <T
            variant="bodyLg"
            numberOfLines={1}
            style={{ fontFamily: "Onest_600SemiBold" }}
          >
            {row.title}
          </T>
          {row.address ? (
            <View style={{ flexDirection: "row", alignItems: "center", columnGap: 5 }}>
              <Ionicons name="location-outline" size={12} color={light.smoke} />
              <T
                variant="bodySm"
                color={light.smoke}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {row.address}
              </T>
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end", rowGap: 4, minWidth: 64 }}>
          <T
            style={{
              fontFamily: "SourceSerif4_400Regular_Italic",
              fontSize: 18,
              lineHeight: 22,
              color: light.coal,
            }}
          >
            {distanceLabel}
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 4 }}>
            {isLive ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: light.ember,
                }}
              />
            ) : null}
            <T
              style={{
                fontFamily: "GeistMono_400Regular",
                fontSize: 12,
                lineHeight: 14,
                color: isLive ? light.ember : light.smoke,
                letterSpacing: 0.2,
              }}
            >
              {isUpcoming ? `in ${remainingLabel}` : remainingLabel}
            </T>
          </View>
        </View>
      </View>
    </ChunkyPressable>
  );
}

function EmptyBlock() {
  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 32,
        alignItems: "center",
        rowGap: 14,
      }}
    >
      <Ionicons name="flame-outline" size={32} color={light.smoke} />
      <T
        style={{
          fontFamily: "SourceSerif4_400Regular_Italic",
          fontSize: 28,
          lineHeight: 32,
          color: light.coal,
          textAlign: "center",
        }}
      >
        nothing burning.
      </T>
      <T variant="bodySm" color={light.smoke} align="center">
        Long-press anywhere on the map to drop a bonfire your circles can find.
      </T>
    </View>
  );
}

function formatDistance(km: number): string {
  if (km < 0.1) return "nearby";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function formatRemaining(targetIso: string): string {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const min = Math.floor(ms / 60_000);
  if (min >= 60) return `${Math.floor(min / 60)}h`;
  if (min >= 1) return `${min}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}
