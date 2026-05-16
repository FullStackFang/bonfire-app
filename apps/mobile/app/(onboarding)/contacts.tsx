import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, CTAButton, Card, Chip, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { mockUsers } from "../../lib/mockSeeds";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { useSession } from "../../lib/session";

type Bucket = "matched" | "suggested";
const SUGGESTED_IDS = new Set(["u-lydia", "u-alex"]);

export default function Contacts() {
  const { user } = useSession();
  const [selected, setSelected] = useState<Record<string, boolean>>({
    "u-sarah": true,
    "u-josh": true,
    "u-maya": true,
    "u-kim": true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const finish = async () => {
    setError(null);

    if (!supabaseConfigured || !user) {
      router.replace("/(app)");
      return;
    }

    setSaving(true);
    // Create the user's first circle. Friend matching would happen here too in a real flow,
    // but since contact-match is mocked for now, we just create the circle shell.
    const { error: err } = await supabase.from("circles").insert({
      owner_id: user.id,
      name: "Crew",
      accent_color: light.ember,
    });
    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/(app)");
  };

  const candidates = useMemo(() => {
    return mockUsers
      .filter((u) => u.id !== "u-self")
      .map((u) => ({
        ...u,
        bucket: SUGGESTED_IDS.has(u.id) ? ("suggested" as Bucket) : ("matched" as Bucket),
      }));
  }, []);

  const matched = candidates.filter((c) => c.bucket === "matched");
  const suggested = candidates.filter((c) => c.bucket === "suggested");
  const anySelected = Object.values(selected).some(Boolean);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <T variant="displayXl">
            Build your{" "}
            <T variant="displayXl" color={light.ember}>
              bonfire
            </T>
          </T>
          <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
            Add people who&apos;ll see when you&apos;re out. Group them into circles.
          </T>
        </View>

        <Section title="Friends already on Bonfire">
          {matched.map((u) => (
            <ContactRow
              key={u.id}
              name={u.display_name}
              hint="Cornell · 3 mutual"
              label={u.letter_pair}
              color={u.avatar_color}
              value={!!selected[u.id]}
              onChange={() => toggle(u.id)}
            />
          ))}
        </Section>

        <Section title="Suggested · mutuals">
          {suggested.map((u) => (
            <ContactRow
              key={u.id}
              name={u.display_name}
              hint="4 mutual"
              label={u.letter_pair}
              color={u.avatar_color}
              value={!!selected[u.id]}
              onChange={() => toggle(u.id)}
            />
          ))}
        </Section>

        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          <T variant="overline" color={light.smoke} style={{ marginBottom: 12, letterSpacing: 1.1 }}>
            CIRCLES
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8 }}>
            <Chip
              label={`Cornell crew · ${Object.values(selected).filter(Boolean).length}`}
              variant="tinted"
              tint={light.ember}
            />
            <Chip label="New circle" leftIcon={<Ionicons name="add" size={14} color={light.smoke} />} variant="ghost" />
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 32,
        }}
      >
        <CTAButton
          label={saving ? "Saving..." : "Continue"}
          disabled={!anySelected || saving}
          onPress={finish}
        />
        {error ? (
          <T variant="bodySm" color={light.emberDeep} align="center" style={{ marginTop: 8 }}>
            {error}
          </T>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
      <T variant="overline" color={light.smoke} style={{ marginBottom: 12, letterSpacing: 1.1 }}>
        {title.toUpperCase()}
      </T>
      <View style={{ rowGap: 10 }}>{children}</View>
    </View>
  );
}

function ContactRow({
  name,
  hint,
  label,
  color,
  value,
  onChange,
}: {
  name: string;
  hint: string;
  label: string;
  color: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable onPress={onChange}>
      <Card padding={12}>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
          <Avatar label={label} color={color} size="md" />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg">{name}</T>
            <T variant="bodySm" color={light.smoke}>
              {hint}
            </T>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: light.ash, true: light.ember }}
            thumbColor={light.hearth}
            ios_backgroundColor={light.ash}
          />
        </View>
      </Card>
    </Pressable>
  );
}
