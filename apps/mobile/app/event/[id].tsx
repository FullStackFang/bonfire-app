import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  AvatarStack,
  CTAButton,
  IconButton,
  LiveDot,
  T,
} from "../../components/ui";
import { light, radius } from "@bonfire/ui-tokens";
import {
  findMockEvent,
  getEventStatus,
  joinMockEvent,
  leaveMockEvent,
  removeMockEvent,
  updateMockEvent,
  type EventStatus,
  type MapEvent,
} from "../../lib/mockEventStore";
import { useMapEvents } from "../../lib/data";
import { useSession } from "../../lib/session";
import { MOCK_CENTER, mockCircles, mockUsers } from "../../lib/mockSeeds";
import { useUserLocation } from "../../lib/useUserLocation";

const TITLE_ACCESSORY_ID = "event-edit-title-accessory";
const ADDRESS_ACCESSORY_ID = "event-edit-address-accessory";
const DESC_ACCESSORY_ID = "event-edit-description-accessory";
const BRING_ACCESSORY_ID = "event-edit-bring-accessory";
const TITLE_MAX = 60;
const ADDRESS_MAX = 80;
const DESC_MAX = 220;
const BRING_MAX = 120;

// Deterministic weather palette — every event id maps to one stable variant
// so the detail tile doesn't churn between renders.
const WEATHER_VARIANTS = [
  { condition: "Clear", icon: "sunny" as const, tint: light.dusk, tempRange: [68, 78] as const },
  { condition: "Partly cloudy", icon: "partly-sunny" as const, tint: light.dusk, tempRange: [62, 74] as const },
  { condition: "Overcast", icon: "cloud" as const, tint: light.smoke, tempRange: [58, 68] as const },
  { condition: "Crisp & cool", icon: "snow" as const, tint: "#6a8db5", tempRange: [44, 56] as const },
];

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const userLocation = useUserLocation(MOCK_CENTER);
  // Subscribe so countdown re-renders every second and the screen reacts to
  // edits made elsewhere (e.g. the event expires while open).
  const events = useMapEvents();
  const event = useMemo(
    () => events.find((e) => e.id === id) ?? findMockEvent(id ?? ""),
    [events, id],
  );

  const isHost = !!user && !!event && event.host_id === user.id;
  const enrichment = useEnrichment(event, userLocation?.coords ?? null, user?.id ?? null);
  const going = !!user && !!event && event.attendee_ids.includes(user.id);

  const [editing, setEditing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const [title, setTitle] = useState(event?.title ?? "");
  const [address, setAddress] = useState(event?.address ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [bring, setBring] = useState(event?.what_to_bring ?? "");
  const [liveNow, setLiveNow] = useState(event?.live_now ?? false);

  // Hydrate the form once when we land on an event id. Subsequent ticks
  // (countdown re-renders) must not clobber in-flight edits.
  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setAddress(event.address ?? "");
    setDescription(event.description ?? "");
    setBring(event.what_to_bring ?? "");
    setLiveNow(event.live_now);
  }, [event?.id]);

  const status: EventStatus | null = event ? getEventStatus(event) : null;
  // Upcoming events count down to start; live/ended count down to expiry.
  const remainingLabel = useMemo(() => {
    if (!event || !status) return "";
    const target = status === "upcoming" ? event.starts_at : event.expires_at;
    const ms = new Date(target).getTime() - Date.now();
    return formatRemaining(ms);
  }, [event, status, events]);

  if (!event) {
    return <MissingEventScreen />;
  }

  const trimmedTitle = title.trim();
  const trimmedAddress = address.trim();
  const trimmedDesc = description.trim();
  const trimmedBring = bring.trim();
  const dirty =
    editing &&
    (trimmedTitle !== event.title ||
      (trimmedAddress || null) !== event.address ||
      (trimmedDesc || null) !== (event.description ?? null) ||
      (trimmedBring || null) !== (event.what_to_bring ?? null) ||
      liveNow !== event.live_now);
  const canSave = dirty && trimmedTitle.length > 0;

  const save = () => {
    if (!canSave) return;
    updateMockEvent(event.id, {
      title: trimmedTitle,
      address: trimmedAddress || null,
      description: trimmedDesc || null,
      what_to_bring: trimmedBring || null,
      live_now: liveNow,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setEditing(false);
  };

  const cancelEdit = () => {
    setTitle(event.title);
    setAddress(event.address ?? "");
    setDescription(event.description ?? "");
    setBring(event.what_to_bring ?? "");
    setLiveNow(event.live_now);
    setEditing(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      "End this event?",
      "Friends won't see it on the map anymore.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "End event",
          style: "destructive",
          onPress: () => {
            removeMockEvent(event.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            router.back();
          },
        },
      ],
    );
  };

  const shareEvent = async () => {
    Haptics.selectionAsync().catch(() => {});
    const window =
      status === "upcoming"
        ? `Starts in ${remainingLabel}.`
        : `${remainingLabel} left.`;
    try {
      await Share.share({
        message: `${event.title} — bonfire near ${event.address ?? "you"}. ${window}`,
      });
    } catch {
      // user cancelled or platform error — silent
    }
  };

  const toggleGoing = () => {
    if (!user || !event) return;
    if (going) {
      leaveMockEvent(event.id, user.id);
      Haptics.selectionAsync().catch(() => {});
    } else {
      joinMockEvent(event.id, user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const toggleBookmark = () => {
    Haptics.selectionAsync().catch(() => {});
    setBookmarked((b) => !b);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TopActions
            isHost={isHost}
            editing={editing}
            onBack={() => router.back()}
            onShare={shareEvent}
            onEdit={() => setEditing(true)}
            onCancelEdit={cancelEdit}
          />

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <TitleBlock
              event={event}
              editing={editing}
              title={title}
              onChangeTitle={setTitle}
              liveNow={liveNow}
              onToggleLive={() => {
                Haptics.selectionAsync().catch(() => {});
                setLiveNow((v) => !v);
              }}
              status={status ?? "live"}
              remainingLabel={remainingLabel}
              distance={enrichment?.distance ?? null}
              address={address}
              onChangeAddress={setAddress}
            />

            <StatsCard
              status={status ?? "live"}
              startsAt={event.starts_at}
              endsAt={event.expires_at}
              weather={enrichment?.weather ?? null}
              attendeeCount={enrichment?.attendeeCount ?? 0}
              attendees={enrichment?.attendees ?? []}
            />

            <DescriptionSection
              editing={editing}
              isHost={isHost}
              value={description}
              fallback={event.description}
              onChange={setDescription}
            />

            <BringSection
              editing={editing}
              isHost={isHost}
              value={bring}
              fallback={event.what_to_bring}
              onChange={setBring}
            />

            <InvitedSection invitedCircleIds={event.invited_circle_ids} />

            {/* Coordinates whisper: useful for sanity-checking the pin during
                the mock phase. Hidden once we wire real addresses end-to-end. */}
            <View
              style={{
                marginTop: 24,
                flexDirection: "row",
                alignItems: "center",
                columnGap: 6,
                opacity: 0.7,
              }}
            >
              <Ionicons name="location-outline" size={13} color={light.smoke} />
              <T variant="monoSm" color={light.smoke}>
                {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
              </T>
            </View>
          </View>
        </ScrollView>

        <BottomBar
          editing={editing}
          isHost={isHost}
          going={going}
          bookmarked={bookmarked}
          canSave={canSave}
          dirty={dirty}
          onGoing={toggleGoing}
          onBookmark={toggleBookmark}
          onSave={save}
          onCancel={cancelEdit}
          onDelete={confirmDelete}
        />
      </KeyboardAvoidingView>

      {Platform.OS === "ios" && editing ? (
        <>
          <InputAccessoryView nativeID={TITLE_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={title.length} max={TITLE_MAX} />
          </InputAccessoryView>
          <InputAccessoryView nativeID={ADDRESS_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={address.length} max={ADDRESS_MAX} />
          </InputAccessoryView>
          <InputAccessoryView nativeID={DESC_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={description.length} max={DESC_MAX} />
          </InputAccessoryView>
          <InputAccessoryView nativeID={BRING_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={bring.length} max={BRING_MAX} />
          </InputAccessoryView>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// --------------- Top actions ---------------

interface TopActionsProps {
  isHost: boolean;
  editing: boolean;
  onBack: () => void;
  onShare: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
}

function TopActions({
  isHost,
  editing,
  onBack,
  onShare,
  onEdit,
  onCancelEdit,
}: TopActionsProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <IconButton
        icon="close"
        variant="ghost"
        size={40}
        iconSize={22}
        onPress={editing ? onCancelEdit : onBack}
        accessibilityLabel={editing ? "Cancel edit" : "Close"}
      />
      {editing ? (
        <View style={{ width: 40 }} />
      ) : (
        <View style={{ flexDirection: "row", columnGap: 4 }}>
          <IconButton
            icon="share-outline"
            variant="ghost"
            size={40}
            iconSize={20}
            onPress={onShare}
            accessibilityLabel="Share event"
          />
          {isHost ? (
            <IconButton
              icon="create-outline"
              variant="ghost"
              size={40}
              iconSize={20}
              onPress={onEdit}
              accessibilityLabel="Edit event"
            />
          ) : (
            <IconButton
              icon="ellipsis-horizontal"
              variant="ghost"
              size={40}
              iconSize={20}
              onPress={() => {}}
              accessibilityLabel="More"
            />
          )}
        </View>
      )}
    </View>
  );
}

// --------------- Title block ---------------

interface TitleBlockProps {
  event: MapEvent;
  editing: boolean;
  title: string;
  onChangeTitle: (s: string) => void;
  liveNow: boolean;
  onToggleLive: () => void;
  status: EventStatus;
  remainingLabel: string;
  distance: { miles: number; walkMin: number } | null;
  address: string;
  onChangeAddress: (s: string) => void;
}

function TitleBlock({
  event,
  editing,
  title,
  onChangeTitle,
  liveNow,
  onToggleLive,
  status,
  remainingLabel,
  distance,
  address,
  onChangeAddress,
}: TitleBlockProps) {
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";
  const statusLabel = isLive ? "Live now" : isUpcoming ? "Upcoming" : "Ended";
  const statusColor = isLive ? light.spark : isUpcoming ? light.dusk : light.smoke;
  const timeSuffix = isUpcoming ? `starts in ${remainingLabel}` : `${remainingLabel} left`;
  return (
    <View>
      {editing ? (
        <TextInput
          value={title}
          onChangeText={onChangeTitle}
          placeholder="What's happening?"
          placeholderTextColor={light.ash}
          maxLength={TITLE_MAX}
          returnKeyType="done"
          keyboardAppearance="light"
          autoCapitalize="sentences"
          autoCorrect
          enablesReturnKeyAutomatically
          inputAccessoryViewID={TITLE_ACCESSORY_ID}
          style={{
            fontFamily: "SourceSerif4_500Medium",
            fontSize: 26,
            color: light.coal,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: light.ash,
          }}
        />
      ) : (
        <T variant="displayLg" style={{ lineHeight: 34 }}>
          {event.title}
        </T>
      )}

      {editing ? (
        <Pressable
          onPress={onToggleLive}
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 8,
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: liveNow ? light.ember : light.hearth,
            borderWidth: 1,
            borderColor: liveNow ? light.ember : light.ash,
          }}
        >
          <Ionicons
            name="flame"
            size={13}
            color={liveNow ? light.hearth : light.smoke}
          />
          <T
            variant="bodySm"
            color={liveNow ? light.hearth : light.smoke}
            style={{ fontFamily: "Onest_600SemiBold" }}
          >
            {liveNow ? "Live now" : "Tap to go live"}
          </T>
        </Pressable>
      ) : (
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 6,
          }}
        >
          <LiveDot color={statusColor} size={8} pulse={isLive} />
          <T
            variant="bodySm"
            color={statusColor}
            style={{ fontFamily: "Onest_600SemiBold" }}
          >
            {statusLabel}
          </T>
          <T variant="bodySm" color={light.smoke}>
            ·
          </T>
          <T variant="bodySm" color={light.smoke}>
            {timeSuffix}
          </T>
        </View>
      )}

      {/* Distance + walk subtitle — only when we have a real fix. */}
      {!editing && distance ? (
        <T variant="bodySm" color={light.smoke} style={{ marginTop: 6 }}>
          {formatDistance(distance.miles)} away · ~{distance.walkMin} min walk
        </T>
      ) : null}

      {/* Address: read-only line in view mode, editable input in edit mode. */}
      {editing ? (
        <View style={{ marginTop: 16 }}>
          <T
            variant="overline"
            color={light.smoke}
            style={{ letterSpacing: 1.1 }}
          >
            ADDRESS (OPTIONAL)
          </T>
          <TextInput
            value={address}
            onChangeText={onChangeAddress}
            placeholder="Park entrance, corner, room #..."
            placeholderTextColor={light.ash}
            maxLength={ADDRESS_MAX}
            returnKeyType="done"
            keyboardAppearance="light"
            autoCapitalize="words"
            autoCorrect={false}
            inputAccessoryViewID={ADDRESS_ACCESSORY_ID}
            style={{
              marginTop: 4,
              fontFamily: "Onest_400Regular",
              fontSize: 16,
              color: light.coal,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: light.ash,
            }}
          />
        </View>
      ) : event.address ? (
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 6,
          }}
        >
          <Ionicons name="navigate-outline" size={13} color={light.smoke} />
          <T variant="bodySm" color={light.smoke}>
            {event.address}
          </T>
        </View>
      ) : null}
    </View>
  );
}

// --------------- Stats card ---------------

interface StatsCardProps {
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  weather: Enrichment["weather"] | null;
  attendeeCount: number;
  attendees: { label: string; color: string; name: string }[];
}

function StatsCard({
  status,
  startsAt,
  endsAt,
  weather,
  attendeeCount,
  attendees,
}: StatsCardProps) {
  // Upcoming events haven't begun, so "Started" would lie. Switch the first
  // tile to "Starts" and shift the icon from flame (live) to time-outline.
  const isUpcoming = status === "upcoming";
  return (
    <View
      style={{
        marginTop: 20,
        backgroundColor: light.hearth,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: light.ash,
        overflow: "hidden",
      }}
    >
      {/* Attendees row */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          columnGap: 12,
        }}
      >
        <AvatarStack
          size="sm"
          max={3}
          avatars={attendees.map((a) => ({ label: a.label, color: a.color, name: a.name }))}
        />
        <View style={{ flex: 1 }}>
          <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
            {attendeeCount} {attendeeCount === 1 ? "person is" : "people are"} coming
          </T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={light.smoke} />
      </View>

      <View style={{ height: 1, backgroundColor: light.ash }} />

      {/* Three stat tiles */}
      <View style={{ flexDirection: "row", paddingVertical: 12 }}>
        <StatTile
          icon={isUpcoming ? "time-outline" : "flame"}
          iconTint={isUpcoming ? light.dusk : light.ember}
          label={isUpcoming ? "Starts" : "Started"}
          value={formatClock(startsAt)}
        />
        <Divider />
        <StatTile
          icon="time-outline"
          iconTint={light.smoke}
          label="Ends"
          value={formatClock(endsAt)}
        />
        <Divider />
        <StatTile
          icon={weather?.icon ?? "thermometer-outline"}
          iconTint={weather?.tint ?? light.smoke}
          label={weather?.condition ?? "Weather"}
          value={weather ? `${weather.temp}°` : "—"}
        />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  iconTint,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconTint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", rowGap: 4 }}>
      <Ionicons name={icon} size={18} color={iconTint} />
      <T
        variant="bodyLg"
        style={{ fontFamily: "Onest_600SemiBold", marginTop: 2 }}
      >
        {value}
      </T>
      <T variant="overline" color={light.smoke}>
        {label.toUpperCase()}
      </T>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={{
        width: 1,
        marginVertical: 4,
        backgroundColor: light.ash,
      }}
    />
  );
}

// --------------- Description / What to bring ---------------

function DescriptionSection({
  editing,
  isHost,
  value,
  fallback,
  onChange,
}: {
  editing: boolean;
  isHost: boolean;
  value: string;
  fallback: string | null;
  onChange: (s: string) => void;
}) {
  if (editing) {
    return (
      <View style={{ marginTop: 22 }}>
        <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1 }}>
          DESCRIPTION (OPTIONAL)
        </T>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Set the vibe — what's the night about?"
          placeholderTextColor={light.ash}
          maxLength={DESC_MAX}
          multiline
          keyboardAppearance="light"
          autoCapitalize="sentences"
          autoCorrect
          inputAccessoryViewID={DESC_ACCESSORY_ID}
          style={{
            marginTop: 6,
            minHeight: 70,
            fontFamily: "Onest_400Regular",
            fontSize: 15,
            lineHeight: 22,
            color: light.coal,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: light.ash,
            backgroundColor: light.hearth,
            textAlignVertical: "top",
          }}
        />
      </View>
    );
  }

  if (fallback) {
    return (
      <T variant="body" style={{ marginTop: 18, lineHeight: 22 }}>
        {fallback}
      </T>
    );
  }

  if (isHost) {
    return <AddHint label="Add a description" />;
  }

  return null;
}

function BringSection({
  editing,
  isHost,
  value,
  fallback,
  onChange,
}: {
  editing: boolean;
  isHost: boolean;
  value: string;
  fallback: string | null;
  onChange: (s: string) => void;
}) {
  if (editing) {
    return (
      <View style={{ marginTop: 16 }}>
        <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1 }}>
          WHAT TO BRING (OPTIONAL)
        </T>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Chair, snack to share, good vibes..."
          placeholderTextColor={light.ash}
          maxLength={BRING_MAX}
          multiline
          keyboardAppearance="light"
          autoCapitalize="sentences"
          autoCorrect
          inputAccessoryViewID={BRING_ACCESSORY_ID}
          style={{
            marginTop: 6,
            minHeight: 56,
            fontFamily: "Onest_400Regular",
            fontSize: 15,
            lineHeight: 22,
            color: light.coal,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: light.ash,
            backgroundColor: light.hearth,
            textAlignVertical: "top",
          }}
        />
      </View>
    );
  }

  if (fallback) {
    return (
      <View style={{ marginTop: 20 }}>
        <T
          variant="bodySm"
          color={light.coal}
          style={{ fontFamily: "Onest_600SemiBold" }}
        >
          What to bring
        </T>
        <T variant="body" color={light.smoke} style={{ marginTop: 4, lineHeight: 22 }}>
          {fallback}
        </T>
      </View>
    );
  }

  if (isHost) {
    return <AddHint label="Add what to bring" />;
  }

  return null;
}

// Read-only chip row of the circles invited at create time. Hidden when the
// event was dropped open-to-all. Editing the invited list lives in a future
// pass — host can re-share the event link in the meantime.
function InvitedSection({ invitedCircleIds }: { invitedCircleIds: string[] }) {
  const circles = useMemo(
    () =>
      invitedCircleIds
        .map((id) => mockCircles.find((c) => c.id === id))
        .filter((c): c is (typeof mockCircles)[number] => !!c),
    [invitedCircleIds],
  );

  if (circles.length === 0) return null;

  return (
    <View style={{ marginTop: 20 }}>
      <T
        variant="bodySm"
        color={light.coal}
        style={{ fontFamily: "Onest_600SemiBold" }}
      >
        Invited
      </T>
      <View
        style={{
          marginTop: 8,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {circles.map((c) => (
          <View
            key={c.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              columnGap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: light.hearth,
              borderWidth: 1,
              borderColor: light.ash,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: c.accent_color,
              }}
            />
            <T
              variant="bodySm"
              color={light.coal}
              style={{ fontFamily: "Onest_500Medium" }}
            >
              {c.name}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

function AddHint({ label }: { label: string }) {
  return (
    <View
      style={{
        marginTop: 16,
        flexDirection: "row",
        alignItems: "center",
        columnGap: 6,
        opacity: 0.7,
      }}
    >
      <Ionicons name="add-circle-outline" size={15} color={light.smoke} />
      <T variant="bodySm" color={light.smoke}>
        {label} — tap Edit
      </T>
    </View>
  );
}

// --------------- Bottom bar ---------------

interface BottomBarProps {
  editing: boolean;
  isHost: boolean;
  going: boolean;
  bookmarked: boolean;
  canSave: boolean;
  dirty: boolean;
  onGoing: () => void;
  onBookmark: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function BottomBar({
  editing,
  isHost,
  going,
  bookmarked,
  canSave,
  dirty,
  onGoing,
  onBookmark,
  onSave,
  onCancel,
  onDelete,
}: BottomBarProps) {
  if (editing) {
    return (
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 12,
          rowGap: 8,
          backgroundColor: light.cream,
          borderTopWidth: 1,
          borderTopColor: light.ash,
        }}
      >
        <CTAButton
          label={dirty ? "Save changes" : "No changes"}
          disabled={!canSave}
          haptic="success"
          onPress={onSave}
        />
        <View style={{ flexDirection: "row", columnGap: 8 }}>
          <View style={{ flex: 1 }}>
            <CTAButton label="Cancel" variant="outline" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <CTAButton
              label="End event"
              variant="ghost"
              haptic="warning"
              leftIcon={<Ionicons name="trash-outline" size={16} color={light.emberDeep} />}
              onPress={onDelete}
            />
          </View>
        </View>
      </View>
    );
  }

  // Host (view mode): destructive primary + bookmark.
  // Viewer: I'm going + bookmark.
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: light.cream,
        borderTopWidth: 1,
        borderTopColor: light.ash,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", columnGap: 10 }}>
        <View style={{ flex: 1 }}>
          {isHost ? (
            <CTAButton
              label="End event"
              variant="outline"
              haptic="warning"
              leftIcon={<Ionicons name="trash-outline" size={16} color={light.ember} />}
              onPress={onDelete}
            />
          ) : (
            <CTAButton
              label={going ? "You're in!" : "I'm going!"}
              haptic="success"
              leftIcon={
                going ? (
                  <Ionicons name="checkmark" size={18} color={light.hearth} />
                ) : undefined
              }
              onPress={onGoing}
            />
          )}
        </View>
        <BookmarkButton bookmarked={bookmarked} onPress={onBookmark} />
      </View>
    </View>
  );
}

function BookmarkButton({
  bookmarked,
  onPress,
}: {
  bookmarked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark event"}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: radius.lg,
        backgroundColor: bookmarked ? light.ember : light.hearth,
        borderWidth: 1.5,
        borderColor: bookmarked ? light.ember : light.warmShadow,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons
        name={bookmarked ? "bookmark" : "bookmark-outline"}
        size={22}
        color={bookmarked ? light.hearth : light.coal}
      />
    </Pressable>
  );
}

// --------------- Missing event screen ---------------

function MissingEventScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
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
        <View style={{ width: 40 }} />
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, padding: 20, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="flame-outline" size={36} color={light.ash} />
        <T variant="displayLg" style={{ marginTop: 12, textAlign: "center" }}>
          Event ended
        </T>
        <T variant="body" color={light.smoke} style={{ marginTop: 8, textAlign: "center" }}>
          This pin has expired or was deleted.
        </T>
      </View>
    </SafeAreaView>
  );
}

// --------------- Enrichment ---------------

type Enrichment = {
  attendeeCount: number;
  attendees: { label: string; color: string; name: string }[];
  weather: { condition: string; icon: React.ComponentProps<typeof Ionicons>["name"]; tint: string; temp: number };
  distance: { miles: number; walkMin: number } | null;
};

// Reads attendees straight off the event so every surface (home pin, "near
// you" footer, detail screen) agrees. Weather is still deterministic per
// event id during the mock phase — it's cosmetic and doesn't need a model.
// Distance/walk-time come from the live user location.
function useEnrichment(
  event: MapEvent | undefined,
  userCoords: { lat: number; lng: number } | null,
  viewerId: string | null,
): Enrichment | null {
  return useMemo(() => {
    if (!event) return null;
    const h = hashStr(event.id);

    const attendeeCount = event.attendee_ids.length;
    // Move the viewer to the front so once they tap "I'm going!" they show
    // up in the visible-three of the stack instead of being hidden by the
    // "+N" overflow.
    const orderedIds = viewerId && event.attendee_ids.includes(viewerId)
      ? [viewerId, ...event.attendee_ids.filter((id) => id !== viewerId)]
      : event.attendee_ids;
    const attendees: Enrichment["attendees"] = [];
    for (const uid of orderedIds) {
      const u = mockUsers.find((m) => m.id === uid);
      if (!u) continue;
      attendees.push({ label: u.letter_pair, color: u.avatar_color, name: u.display_name });
    }

    const wIdx = h % WEATHER_VARIANTS.length;
    const w = WEATHER_VARIANTS[wIdx];
    const span = w.tempRange[1] - w.tempRange[0];
    const temp = w.tempRange[0] + ((h >> 5) % (span + 1));

    let distance: Enrichment["distance"] = null;
    if (userCoords) {
      const miles = distanceMiles(userCoords, { lat: event.lat, lng: event.lng });
      const walkMin = Math.max(1, Math.round(miles * 20)); // 3 mph
      distance = { miles, walkMin };
    }

    return {
      attendeeCount,
      attendees,
      weather: { condition: w.condition, icon: w.icon, tint: w.tint, temp },
      distance,
    };
  }, [event, userCoords, viewerId]);
}

// --------------- Pure utils ---------------

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return "Right here";
  if (miles < 1) return `${(Math.round(miles * 10) / 10).toFixed(1)} mi`;
  if (miles < 10) return `${(Math.round(miles * 10) / 10).toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  let hours = d.getHours();
  const mins = d.getMinutes();
  const am = hours < 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${mins.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 10) return `${min}m`;
  if (min >= 1) return `${min}:${sec.toString().padStart(2, "0")}`;
  return `${sec}s`;
}

function KeyboardBar({ count, max }: { count: number; max: number }) {
  const nearLimit = count > max - 10;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderTopColor: light.ash,
        backgroundColor: light.hearth,
      }}
    >
      <T
        variant="bodySm"
        color={nearLimit ? light.emberDeep : light.smoke}
        style={{ fontFamily: "GeistMono_400Regular" }}
      >
        {count}/{max}
      </T>
      <Pressable hitSlop={12} onPress={() => Keyboard.dismiss()}>
        <T
          variant="bodySm"
          color={light.ember}
          style={{ fontFamily: "Onest_600SemiBold" }}
        >
          Done
        </T>
      </Pressable>
    </View>
  );
}
