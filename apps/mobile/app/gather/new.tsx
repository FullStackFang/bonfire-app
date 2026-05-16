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

type Step = 1 | 2 | 3;

const TITLE_PLACEHOLDERS = [
  "Dinner downtown",
  "Drinks somewhere warm",
  "Coffee + a walk",
  "Late-night ramen",
];

export default function GatherNew() {
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState<"tonight" | "tomorrow" | "friday" | null>(null);
  const [venueIds, setVenueIds] = useState<Set<string>>(new Set());
  const [circleIds, setCircleIds] = useState<Set<string>>(new Set());

  const circles = useMyCircles();
  const venues = useVenues();

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
          <CTAButton
            label="Start gather"
            disabled={circleIds.size === 0}
            haptic="success"
            onPress={() => router.replace("/gather/g-1")}
          />
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
