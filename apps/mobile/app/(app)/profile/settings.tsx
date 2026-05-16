import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, IconButton, T } from "../../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { useSession } from "../../../lib/session";

export default function Settings() {
  const { signOut } = useSession();
  const [pause, setPause] = useState(false);
  const [dndStart, setDndStart] = useState("01:00");
  const [dndEnd, setDndEnd] = useState("08:00");
  const [pushFriendLive, setPushFriendLive] = useState(true);
  const [pushHeatmap, setPushHeatmap] = useState(true);
  const [pushGather, setPushGather] = useState(true);
  const [pushMilestone, setPushMilestone] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon="chevron-back"
          variant="ghost"
          iconSize={26}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <T variant="title">Settings</T>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, rowGap: 16, paddingBottom: 40 }}>
        <Section title="PRIVACY">
          <SwitchRow
            label="Pause Bonfire"
            hint="Hides you from everyone immediately."
            value={pause}
            onChange={setPause}
          />
          <Row label="Do-not-disturb hours" value={`${dndStart} – ${dndEnd}`} onPress={() => {}} />
          <Row label="Default visibility" value="Cornell crew, NYC" onPress={() => {}} />
        </Section>

        <Section title="NOTIFICATIONS">
          <SwitchRow label="Friend goes live" value={pushFriendLive} onChange={setPushFriendLive} />
          <SwitchRow label="Heatmap warms up nearby" value={pushHeatmap} onChange={setPushHeatmap} />
          <SwitchRow label="Gather invite" value={pushGather} onChange={setPushGather} />
          <SwitchRow label="Milestone badges" value={pushMilestone} onChange={setPushMilestone} />
        </Section>

        <Section title="CIRCLES">
          <Row label="Manage circles" onPress={() => router.push("/(app)/network")} />
        </Section>

        <Section title="ACCOUNT">
          <Row label="Phone number" value="+1 555 123 4567" />
          <Row label="Sign out" destructive onPress={signOut} />
          <Row label="Delete account" destructive onPress={() => {}} />
        </Section>

        <Section title="ABOUT">
          <Row label="Version" value="0.1.0" />
          <Row label="Privacy policy" onPress={() => {}} />
          <Row label="Terms" onPress={() => {}} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginBottom: 8, paddingHorizontal: 4 }}>
        {title}
      </T>
      <Card padding={0}>
        <View style={{ rowGap: 0 }}>{children}</View>
      </Card>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: light.ash,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <T variant="body" color={destructive ? light.emberDeep : light.coal}>
        {label}
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6 }}>
        {value ? (
          <T variant="bodySm" color={light.smoke}>
            {value}
          </T>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={light.smoke} /> : null}
      </View>
    </Pressable>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: light.ash,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        columnGap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {hint ? (
          <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: light.ash, true: light.ember }}
        thumbColor={light.hearth}
        ios_backgroundColor={light.ash}
      />
    </View>
  );
}
