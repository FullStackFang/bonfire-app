// Group = faces + hooks + the vouch. (spec §Screens 4)
// Ask-me-about hooks are conversation starters designed to be used in person,
// not browsed. No profiles — this screen is the whole social surface.

import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { light } from "@bonfire/ui-tokens";
import { T, Card, CTAButton, Avatar } from "../../components/ui";
import { group, members } from "../../lib/mockV2";

export default function GroupScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: light.cream }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 32,
        paddingHorizontal: 20,
      }}
    >
      <T variant="displayXl">{group.name}</T>
      <T variant="body" color={light.smoke} style={{ marginTop: 6 }}>
        {group.litSinceLabel} · {members.length} of {group.capacity}
      </T>

      <View style={{ marginTop: 24 }}>
        <Card padding={20}>
          <T variant="bodyLg">Bring someone in</T>
          <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
            A vouch is the only door. You have {group.vouchesAvailable} available.
          </T>
          <View style={{ marginTop: 14 }}>
            <CTAButton label="Vouch someone in" variant="outline" onPress={() => {}} />
          </View>
        </Card>
      </View>

      <T
        variant="overline"
        color={light.smoke}
        style={{ letterSpacing: 1.1, textTransform: "uppercase", marginTop: 28, marginBottom: 6 }}
      >
        The faces
      </T>
      {members.map((p) => (
        <View
          key={p.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: light.ash,
          }}
        >
          <Avatar label={p.name} color={p.color} size="md" name={p.name} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T variant="bodyLg">{p.name}</T>
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 1 }}>
              ask about {p.hook}
            </T>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
