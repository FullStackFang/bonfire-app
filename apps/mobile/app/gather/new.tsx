import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AvatarStack,
  CTAButton,
  Card,
  Chip,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { useMyCircles, useVenues } from "../../lib/data";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { useSession } from "../../lib/session";

type Step = 1 | 2 | 3;

const TITLE_PLACEHOLDERS = [
  "Dinner downtown",
  "Drinks somewhere warm",
  "Coffee + a walk",
  "Late-night ramen",
];

function startsAtFor(when: "tonight" | "tomorrow" | "friday"): string {
  const d = new Date();
  if (when === "tonight") {
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  } else if (when === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
  } else {
    // next Friday at 20:00
    const day = d.getDay();
    const delta = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + delta);
    d.setHours(20, 0, 0, 0);
  }
  return d.toISOString();
}

export default function GatherNew() {
  const { user } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState<"tonight" | "tomorrow" | "friday" | null>(null);
  const [venueIds, setVenueIds] = useState<Set<string>>(new Set());
  const [circleIds, setCircleIds] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const circles = useMyCircles();
  const venues = useVenues();

  const createGather = async () => {
    setError(null);
    if (!supabaseConfigured || !user) {
      router.replace("/gather/g-1");
      return;
    }

    setCommitting(true);
    const venueArr = Array.from(venueIds);
    const { data, error: err } = await supabase
      .from("gathers")
      .insert({
        host_id: user.id,
        title: title.trim(),
        starts_at: time ? startsAtFor(time) : null,
        primary_venue_id: venueArr[0] ?? null,
        candidate_venue_ids: venueArr,
        invited_circle_ids: Array.from(circleIds),
      })
      .select("id")
      .single();

    if (err || !data) {
      setCommitting(false);
      setError(err?.message ?? "Could not create gather.");
      return;
    }

    // Host is implicitly "in".
    await supabase.from("gather_responses").upsert({
      gather_id: data.id,
      user_id: user.id,
      response: "in",
    });

    setCommitting(false);
    router.replace(`/gather/${data.id}` as never);
  };

  const placeholder = TITLE_PLACEHOLDERS[Math.floor(Date.now() / 5000) % TITLE_PLACEHOLDERS.length];

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
        <Pressable
          onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}
          hitSlop={20}
          style={{ padding: 4 }}
        >
          <Ionicons name={step === 1 ? "close" : "chevron-back"} size={26} color={light.coal} />
        </Pressable>
        <View style={{ flexDirection: "row", columnGap: 6 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 24,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= step ? light.ember : light.ash,
              }}
            />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {step === 1 && (
          <>
            <T variant="displayXl">What&apos;s the call?</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
              Title + when. Keep it loose.
            </T>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={placeholder}
              placeholderTextColor={light.ash}
              autoFocus
              style={{
                marginTop: 28,
                fontFamily: "SourceSerif4_500Medium",
                fontSize: 26,
                color: light.coal,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: light.ash,
              }}
            />
            <T variant="overline" color={light.smoke} style={{ marginTop: 28, letterSpacing: 1.1 }}>
              WHEN
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8, marginTop: 12 }}>
              {(["tonight", "tomorrow", "friday"] as const).map((t) => (
                <Chip
                  key={t}
                  label={t.charAt(0).toUpperCase() + t.slice(1)}
                  variant={time === t ? "solid" : "outline"}
                  onPress={() => setTime(t)}
                />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <T variant="displayXl">Where, roughly?</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
              Pick 1–3 candidates. You can always decide later.
            </T>
            <View style={{ rowGap: 8, marginTop: 20 }}>
              {venues.slice(0, 6).map((v) => {
                const picked = venueIds.has(v.id);
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      const next = new Set(venueIds);
                      if (next.has(v.id)) next.delete(v.id);
                      else next.add(v.id);
                      setVenueIds(next);
                    }}
                  >
                    <Card
                      padding={12}
                      style={{
                        borderColor: picked ? light.ember : light.ash,
                        borderWidth: picked ? 2 : 1,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
                            {v.name}
                          </T>
                          <T variant="bodySm" color={light.smoke}>
                            {capitalize(v.category)}
                            {v.neighborhood ? ` · ${v.neighborhood}` : ""}
                          </T>
                        </View>
                        {picked ? (
                          <Ionicons name="checkmark-circle" size={24} color={light.ember} />
                        ) : (
                          <Ionicons name="ellipse-outline" size={24} color={light.ash} />
                        )}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <T variant="displayXl">Who&apos;s invited?</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
              Pick the circles that should see this.
            </T>
            <View style={{ rowGap: 8, marginTop: 20 }}>
              {circles.map((c) => {
                const picked = circleIds.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      const next = new Set(circleIds);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      setCircleIds(next);
                    }}
                  >
                    <Card
                      padding={14}
                      style={{
                        borderColor: picked ? light.ember : light.ash,
                        borderWidth: picked ? 2 : 1,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
                            {c.name}
                          </T>
                          <T variant="bodySm" color={light.smoke}>
                            {c.member_ids.length} people
                          </T>
                        </View>
                        {picked ? (
                          <Ionicons name="checkmark-circle" size={24} color={light.ember} />
                        ) : (
                          <Ionicons name="ellipse-outline" size={24} color={light.ash} />
                        )}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", left: 20, right: 20, bottom: 32 }}>
        {step === 3 ? (
          <>
            <CTAButton
              label={committing ? "Starting..." : "Start gather"}
              disabled={circleIds.size === 0 || committing}
              haptic="success"
              onPress={createGather}
            />
            {error ? (
              <T variant="bodySm" color={light.emberDeep} align="center" style={{ marginTop: 8 }}>
                {error}
              </T>
            ) : null}
          </>
        ) : (
          <CTAButton
            label="Continue"
            disabled={
              (step === 1 && (!title.trim() || !time)) ||
              (step === 2 && venueIds.size === 0)
            }
            onPress={() => setStep(((step as number) + 1) as Step)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
