import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { light } from "@bonfire/ui-tokens";
import {
  Avatar,
  AvatarStack,
  BonfireScore,
  CTAButton,
  Card,
  Chip,
  EmptyState,
  IntentBadge,
  LiveDot,
  T,
} from "../components/ui";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
      <T
        variant="overline"
        color={light.smoke}
        style={{ letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}
      >
        {title}
      </T>
      <View style={{ rowGap: 14 }}>{children}</View>
    </View>
  );
}

export default function ComponentsPreview() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <T variant="displayXl">Components</T>
          <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
            Every base component, every variant.
          </T>
        </View>

        <Section title="Typography">
          <T variant="displayXl">Display XL — Build your bonfire</T>
          <T variant="displayLg">Display LG — 87</T>
          <T variant="title">Title — Your network</T>
          <T variant="bodyLg">Body LG — Five friends here now.</T>
          <T variant="body">Body — Out for drinks at Maxie&apos;s Supper Club.</T>
          <T variant="monoSm" color={light.smoke}>Mono SM — 2 min ago · 0.3 mi</T>
        </Section>

        <Section title="Live dot">
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 18 }}>
            <LiveDot />
            <LiveDot pulse />
            <LiveDot color={light.ember} pulse />
            <LiveDot size={12} pulse />
          </View>
        </Section>

        <Section title="Avatar">
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14 }}>
            <Avatar label="SP" color="#5E7FE5" size="xs" />
            <Avatar label="JP" color="#1A9E75" size="sm" />
            <Avatar label="M"  color="#9D5BC2" size="md" />
            <Avatar label="LK" color="#E2843D" size="lg" name="Lydia Kim" />
            <Avatar label="K"  color="#E2B33D" size="xl" />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14 }}>
            <Avatar label="SP" color="#5E7FE5" size="md" live />
            <Avatar label="K"  color="#E2B33D" size="md" live />
            <Avatar label="JP" color="#1A9E75" size="lg" live />
          </View>
        </Section>

        <Section title="Avatar stack">
          <AvatarStack
            avatars={[
              { label: "SP", color: "#5E7FE5" },
              { label: "JP", color: "#1A9E75" },
              { label: "M",  color: "#9D5BC2" },
              { label: "LK", color: "#E2843D" },
              { label: "K",  color: "#E2B33D" },
              { label: "A",  color: "#7BB968" },
            ]}
            max={4}
          />
        </Section>

        <Section title="Intent badge">
          <IntentBadge intent="available_now" />
          <IntentBadge intent="out_today" />
          <IntentBadge intent="out_tonight" />
        </Section>

        <Section title="Bonfire score">
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10 }}>
            <BonfireScore score={87} />
            <BonfireScore score={62} />
            <BonfireScore score={99} size="lg" />
            <BonfireScore score={0} size="sm" />
          </View>
        </Section>

        <Section title="Chip">
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8 }}>
            <Chip label="People" variant="solid" />
            <Chip label="Events" />
            <Chip label="Available now" />
            <Chip label="Ghost" variant="ghost" />
            <Chip label="Tinted spark" variant="tinted" tint={light.spark} />
            <Chip label="Tinted dusk" variant="tinted" tint={light.dusk} />
            <Chip label="Disabled" disabled />
          </View>
        </Section>

        <Section title="Card">
          <Card>
            <T variant="bodyLg">Static card. Hearth surface, ash border.</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
              Composes from tokens. No left-border accent anywhere.
            </T>
          </Card>
          <Card interactive onPress={() => {}}>
            <T variant="bodyLg">Interactive card — taps spring-scale.</T>
          </Card>
        </Section>

        <Section title="CTA button">
          <CTAButton label="Go live" onPress={() => {}} />
          <CTAButton label="Drop a pin" onPress={() => {}} variant="outline" />
          <CTAButton label="Ghost" onPress={() => {}} variant="ghost" />
          <CTAButton label="Disabled" onPress={() => {}} disabled />
        </Section>

        <Section title="Empty state">
          <Card padding={0} style={{ overflow: "hidden" }}>
            <EmptyState
              nextGesture="go-live"
              headline="Quiet out there."
              body="Be the first to go live. Your circles will see you on the map."
              cta={{ label: "Go live", onPress: () => {} }}
            />
          </Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
